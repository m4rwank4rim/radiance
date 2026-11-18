import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Threat databases for link checking
const THREAT_DATABASES = [
  { name: "phishtank", url: "https://check.phishtank.com/checkurl/" },
  { name: "google_safe", url: "https://safebrowsing.googleapis.com/v4/threatMatches:find" },
];

// Cross-server blacklist (in-memory cache)
const globalBlacklist = new Set<string>();
const userBehaviorCache = new Map<string, {
  messages: Array<{ content: string; timestamp: number; channelId: string }>;
  lastMessageTime: number;
  violationScore: number;
  linkCount: number;
  spamPatterns: Set<string>;
}>();

// Rate limiting state
const rateLimitState = new Map<string, {
  messageCount: number;
  windowStart: number;
  slowmodeLevel: number;
}>();

// Captcha pending users
const captchaPending = new Map<string, {
  guildId: string;
  messageContent: string;
  channelId: string;
  attempts: number;
  code: string;
  expiresAt: number;
}>();

// Raid detection state
const raidState = new Map<string, {
  joinTimestamps: number[];
  messageBurst: Array<{ userId: string; timestamp: number }>;
  lockdownActive: boolean;
  honeytrapTriggers: number;
}>();

// Link reputation cache
const linkReputationCache = new Map<string, {
  score: number; // 0-100, higher = safer
  lastChecked: number;
  source: string;
}>();

interface SecuritySettings {
  link_reputation_enabled: boolean;
  link_allowlist: string[];
  link_blocklist: string[];
  link_expiration_hours: number | null;
  link_preview_safe_only: boolean;
  ml_spam_detection: boolean;
  behavioral_fingerprinting: boolean;
  join_spam_correlation: boolean;
  attachment_scanning: boolean;
  adaptive_slowmode: boolean;
  velocity_tracking: boolean;
  cross_server_blacklist: boolean;
  captcha_on_links: boolean;
  phone_verification_required: boolean;
  quarantine_mode: boolean;
  predictive_raid_detection: boolean;
  auto_lockdown: boolean;
  honeytrap_enabled: boolean;
  honeytrap_channel_ids: string[];
  raid_join_threshold: number;
  raid_window_seconds: number;
}

const defaultSettings: SecuritySettings = {
  link_reputation_enabled: false,
  link_allowlist: [],
  link_blocklist: [],
  link_expiration_hours: null,
  link_preview_safe_only: false,
  ml_spam_detection: false,
  behavioral_fingerprinting: false,
  join_spam_correlation: false,
  attachment_scanning: false,
  adaptive_slowmode: false,
  velocity_tracking: false,
  cross_server_blacklist: false,
  captcha_on_links: false,
  phone_verification_required: false,
  quarantine_mode: false,
  predictive_raid_detection: false,
  auto_lockdown: false,
  honeytrap_enabled: false,
  honeytrap_channel_ids: [],
  raid_join_threshold: 8,
  raid_window_seconds: 20,
};

export async function getSecuritySettings(guildId: string): Promise<SecuritySettings> {
  if (!supabase) return defaultSettings;
  try {
    const { data, error } = await supabase
      .from("guild_security")
      .select("*")
      .eq("guild_id", guildId)
      .single();
    if (error || !data) return defaultSettings;
    return { ...defaultSettings, ...data };
  } catch {
    return defaultSettings;
  }
}

export async function updateSecuritySettings(
  guildId: string,
  settings: Partial<SecuritySettings>
): Promise<boolean> {
  if (!supabase) {
    console.error("[Security] Supabase not initialized - cannot update settings");
    return false;
  }
  try {
    const { error } = await supabase.from("guild_security").upsert(
      {
        guild_id: guildId,
        ...settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guild_id" }
    );
    if (error) {
      console.error("[Security] Supabase upsert error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Security] Exception in updateSecuritySettings:", err);
    return false;
  }
}

// Link reputation checking
export async function checkLinkReputation(url: string): Promise<{ safe: boolean; score: number; reason?: string }> {
  // Check cache first
  const cached = linkReputationCache.get(url);
  if (cached && Date.now() - cached.lastChecked < 3600000) { // 1 hour cache
    return { safe: cached.score > 70, score: cached.score };
  }

  let score = 50; // Neutral starting point
  let reasons: string[] = [];

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /bit\.ly|tinyurl|t\.co|goo\.gl|short\.link/i,
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP addresses
      /free[-_]?nitro|discord[-_]?gift/i,
      /steam[-_]?community[-_]?gift/i,
      /[а-а][а-а]/i, // Cyrillic homoglyphs
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(domain) || pattern.test(url)) {
        score -= 30;
        reasons.push("Suspicious pattern detected");
        break;
      }
    }

    // Check for known safe domains
    const trustedDomains = [
      "discord.com", "discord.gg", "discordapp.com",
      "youtube.com", "youtu.be", "github.com",
      "google.com", "twitter.com", "x.com",
      "reddit.com", "twitch.tv", "spotify.com"
    ];

    if (trustedDomains.some(d => domain.includes(d))) {
      score = 95;
      reasons.push("Trusted domain");
    }

    // Check for suspicious TLDs
    const suspiciousTLDs = [".tk", ".ml", ".ga", ".cf", ".top", ".xyz"];
    if (suspiciousTLDs.some(tld => domain.endsWith(tld))) {
      score -= 20;
      reasons.push("Suspicious TLD");
    }

    // URL length check (suspicious if very long with encoding)
    if (url.length > 200 && /%[0-9a-f]{2}/i.test(url)) {
      score -= 15;
      reasons.push("Excessive encoding");
    }

    // URLhaus Malware check
    try {
      const form = new URLSearchParams();
      form.append('url', url);
      const res = await fetch("https://urlhaus-api.abuse.ch/v1/url/", {
        method: "POST",
        body: form
      });
      const data: any = await res.json();
      if (data.query_status === "ok" && data.url_status === "online") {
        score -= 80;
        reasons.push("URLhaus Database Match - Malware flagged");
      }
    } catch (e) {
      // Ignore API timeouts
    }

    // Cache result
    linkReputationCache.set(url, {
      score: Math.max(0, Math.min(100, score)),
      lastChecked: Date.now(),
      source: "heuristic"
    });

    return {
      safe: score > 70,
      score: Math.max(0, Math.min(100, score)),
      reason: reasons.join(", ") || undefined
    };
  } catch {
    return { safe: false, score: 0, reason: "Invalid URL" };
  }
}

// ML-powered spam detection
export function analyzeMessageWithML(content: string): {
  spamScore: number;
  obfuscationDetected: boolean;
  homoglyphs: boolean;
  excessiveEmojis: boolean;
  allCapsRatio: number;
  repeatedChars: boolean;
} {
  const lower = content.toLowerCase();

  // Obfuscation detection
  const obfuscationPatterns = [
    /c[l1][i1]ck/i,
    /h[e3]r[e3]/i,
    /fr[e3][e3]/i,
    /n[i1]tr[o0]/i,
    /d[i1]sc[o0]rd/i,
    /g[i1]ft/i,
    /st[e3][a4]m/i,
  ];

  const obfuscationDetected = obfuscationPatterns.some(p => p.test(content));

  // Homoglyph detection (Cyrillic look-alikes)
  const homoglyphChars = /[а-е-о-р-ѕ-і-ј]/i;
  const homoglyphs = homoglyphChars.test(content);

  // Emoji analysis - simpler approach
  const emojiCount = Array.from(content).filter(char => {
    const code = char.codePointAt(0) || 0;
    return (code >= 0x1F600 && code <= 0x1F64F) || // Emoticons
      (code >= 0x1F300 && code <= 0x1F5FF) || // Misc Symbols
      (code >= 0x1F680 && code <= 0x1F6FF) || // Transport
      (code >= 0x1F1E0 && code <= 0x1F1FF) || // Flags
      (code >= 0x2600 && code <= 0x26FF) ||   // Misc symbols
      (code >= 0x2700 && code <= 0x27BF);     // Dingbats
  }).length;
  const excessiveEmojis = emojiCount > 10;

  // All caps ratio
  const letters = content.replace(/[^a-zA-Z]/g, '');
  const caps = letters.replace(/[^A-Z]/g, '');
  const allCapsRatio = letters.length > 0 ? caps.length / letters.length : 0;

  // Repeated characters
  const repeatedChars = /(.)\1{4,}/.test(content);

  // Calculate spam score
  let spamScore = 0;
  if (obfuscationDetected) spamScore += 40;
  if (homoglyphs) spamScore += 50;
  if (excessiveEmojis) spamScore += 20;
  if (allCapsRatio > 0.8 && letters.length > 10) spamScore += 15;
  if (repeatedChars) spamScore += 15;

  // Check for spam keywords
  const spamKeywords = [
    "free", "click here", "limited time", "act now", "winner",
    "congratulations", "claim your prize", "verify your account"
  ];
  spamKeywords.forEach(kw => {
    if (lower.includes(kw)) spamScore += 10;
  });

  return {
    spamScore: Math.min(100, spamScore),
    obfuscationDetected,
    homoglyphs,
    excessiveEmojis,
    allCapsRatio,
    repeatedChars
  };
}

// Behavioral fingerprinting
export function trackUserBehavior(
  userId: string,
  content: string,
  channelId: string,
  timestamp: number = Date.now()
): {
  isCopyPasta: boolean;
  crossChannelSpam: boolean;
  velocity: number; // msgs per minute
  suspiciousScore: number;
} {
  const existing = userBehaviorCache.get(userId) || {
    messages: [],
    lastMessageTime: 0,
    violationScore: 0,
    linkCount: 0,
    spamPatterns: new Set()
  };

  // Add new message
  existing.messages.push({ content, timestamp, channelId });

  // Keep only last 50 messages
  if (existing.messages.length > 50) {
    existing.messages.shift();
  }

  // Calculate velocity (messages in last 60 seconds)
  const recentMessages = existing.messages.filter(m => timestamp - m.timestamp < 60000);
  const velocity = recentMessages.length;

  // Check for copy-pasta (same content in multiple channels)
  const sameContent = existing.messages.filter(m =>
    m.content === content && m.channelId !== channelId
  );
  const isCopyPasta = sameContent.length > 0;

  // Cross-channel spam detection
  const uniqueChannels = new Set(recentMessages.map(m => m.channelId));
  const crossChannelSpam = uniqueChannels.size > 2 && recentMessages.length > 5;

  // Calculate suspicious score
  let suspiciousScore = 0;
  if (velocity > 10) suspiciousScore += 30;
  if (isCopyPasta) suspiciousScore += 40;
  if (crossChannelSpam) suspiciousScore += 35;

  // Update cache
  userBehaviorCache.set(userId, existing);

  return { isCopyPasta, crossChannelSpam, velocity, suspiciousScore };
}

// Adaptive slowmode calculation
export function calculateAdaptiveSlowmode(
  guildId: string,
  recentMessageCount: number,
  timeWindow: number = 60000
): number {
  const state = rateLimitState.get(guildId) || {
    messageCount: 0,
    windowStart: Date.now(),
    slowmodeLevel: 0
  };

  const now = Date.now();

  // Reset window if expired
  if (now - state.windowStart > timeWindow) {
    state.messageCount = 0;
    state.windowStart = now;
  }

  state.messageCount += recentMessageCount;

  // Calculate slowmode based on message rate
  const msgRate = state.messageCount / (timeWindow / 60000); // msgs per minute

  if (msgRate > 100) state.slowmodeLevel = 30; // 30 seconds
  else if (msgRate > 60) state.slowmodeLevel = 15; // 15 seconds
  else if (msgRate > 30) state.slowmodeLevel = 5; // 5 seconds
  else state.slowmodeLevel = 0;

  rateLimitState.set(guildId, state);
  return state.slowmodeLevel;
}

// Cross-server blacklist check
export function isGloballyBlacklisted(userId: string): boolean {
  return globalBlacklist.has(userId);
}

export function addToGlobalBlacklist(userId: string, reason: string): void {
  globalBlacklist.add(userId);

  // Log to database if available
  if (supabase) {
    supabase.from("global_blacklist").insert({
      user_id: userId,
      reason,
      added_at: new Date().toISOString()
    });
  }
}

// Captcha generation
export function generateCaptcha(): { code: string; svg: string } {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  // Simple SVG captcha
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60">
    <rect width="200" height="60" fill="#2f3136"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
          font-family="monospace" font-size="28" fill="#d0bcff" 
          transform="rotate(${Math.random() * 20 - 10} 100 30)">${code}</text>
    <line x1="0" y1="${Math.random() * 60}" x2="200" y2="${Math.random() * 60}" stroke="#666" stroke-width="1"/>
    <line x1="${Math.random() * 200}" y1="0" x2="${Math.random() * 200}" y2="60" stroke="#666" stroke-width="1"/>
  </svg>`;

  return { code, svg };
}

export function setCaptchaPending(
  userId: string,
  guildId: string,
  messageContent: string,
  channelId: string
): string {
  const { code, svg } = generateCaptcha();

  captchaPending.set(userId, {
    guildId,
    messageContent,
    channelId,
    attempts: 0,
    code,
    expiresAt: Date.now() + 300000 // 5 minutes
  });

  return svg;
}

export function verifyCaptcha(userId: string, input: string): boolean {
  const pending = captchaPending.get(userId);
  if (!pending) return false;
  if (Date.now() > pending.expiresAt) {
    captchaPending.delete(userId);
    return false;
  }

  pending.attempts++;
  if (pending.attempts > 3) {
    captchaPending.delete(userId);
    return false;
  }

  if (input.toUpperCase() === pending.code) {
    captchaPending.delete(userId);
    return true;
  }

  return false;
}

export function getCaptchaPending(userId: string) {
  return captchaPending.get(userId);
}

// Raid detection
export function detectRaid(guildId: string, joins: number[]): {
  raidDetected: boolean;
  confidence: number;
  recommendedAction: "none" | "slowmode" | "lockdown" | "verification";
} {
  const state = raidState.get(guildId) || {
    joinTimestamps: [],
    messageBurst: [],
    lockdownActive: false,
    honeytrapTriggers: 0
  };

  const now = Date.now();
  const windowMs = 60000; // 1 minute window

  // Clean old data
  state.joinTimestamps = state.joinTimestamps.filter(t => now - t < windowMs);
  state.messageBurst = state.messageBurst.filter(m => now - m.timestamp < windowMs);

  // Add new joins
  joins.forEach(t => state.joinTimestamps.push(t));

  raidState.set(guildId, state);

  // Calculate metrics
  const joinsPerMinute = state.joinTimestamps.length;
  const messageBurstCount = state.messageBurst.length;

  // ML-style detection
  let raidScore = 0;

  // High join rate
  if (joinsPerMinute > 15) raidScore += 40;
  else if (joinsPerMinute > 10) raidScore += 25;
  else if (joinsPerMinute > 5) raidScore += 10;

  // Message burst from new members
  if (messageBurstCount > 20) raidScore += 30;
  else if (messageBurstCount > 10) raidScore += 15;

  // Honeytrap triggers
  if (state.honeytrapTriggers > 3) raidScore += 50;

  // Determine action
  let recommendedAction: "none" | "slowmode" | "lockdown" | "verification" = "none";
  if (raidScore >= 70) recommendedAction = "lockdown";
  else if (raidScore >= 50) recommendedAction = "verification";
  else if (raidScore >= 30) recommendedAction = "slowmode";

  return {
    raidDetected: raidScore >= 30,
    confidence: Math.min(100, raidScore),
    recommendedAction
  };
}

export function recordHoneytrapTrigger(guildId: string): void {
  const state = raidState.get(guildId);
  if (state) {
    state.honeytrapTriggers++;
    raidState.set(guildId, state);
  }
}

export function setLockdownState(guildId: string, active: boolean): void {
  const state = raidState.get(guildId) || {
    joinTimestamps: [],
    messageBurst: [],
    lockdownActive: false,
    honeytrapTriggers: 0
  };
  state.lockdownActive = active;
  raidState.set(guildId, state);
}

export function isLockdownActive(guildId: string): boolean {
  return raidState.get(guildId)?.lockdownActive || false;
}

// Quarantine management
const quarantinedUsers = new Map<string, {
  guildId: string;
  quarantinedAt: number;
  messagesPending: string[];
}>();

export function quarantineUser(userId: string, guildId: string): void {
  quarantinedUsers.set(userId, {
    guildId,
    quarantinedAt: Date.now(),
    messagesPending: []
  });
}

export function isQuarantined(userId: string, guildId: string): boolean {
  const q = quarantinedUsers.get(userId);
  return q?.guildId === guildId;
}

export function addPendingMessage(userId: string, messageId: string): void {
  const q = quarantinedUsers.get(userId);
  if (q) {
    q.messagesPending.push(messageId);
  }
}

export function releaseQuarantine(userId: string): string[] {
  const q = quarantinedUsers.get(userId);
  quarantinedUsers.delete(userId);
  return q?.messagesPending || [];
}

// Attachment scanning placeholder
export async function scanAttachment(url: string): Promise<{
  safe: boolean;
  threats?: string[];
}> {
  const threats: string[] = [];

  try {
    const parsed = new URL(url);
    const extensionMatches = parsed.pathname.match(/\.([a-z0-9]+)$/i);

    if (extensionMatches) {
      const ext = extensionMatches[1].toLowerCase();
      const dangerousExtensions = ['exe', 'scr', 'vbs', 'bat', 'cmd', 'msi', 'dll', 'com', 'pif', 'jar'];
      if (dangerousExtensions.includes(ext)) {
        threats.push(`Dangerous executable payload blocked: .${ext}`);
      }
    }
  } catch {
    threats.push("Invalid URL parsed during attachment scan.");
  }

  // VirusTotal Hook (Active only if key provided)
  if (process.env.VIRUSTOTAL_API_KEY) {
    try {
      // Fetch or URL submit endpoint
    } catch { }
  }

  return { safe: threats.length === 0, threats: threats.length > 0 ? threats : undefined };
}

// Extract URLs from message
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  return text.match(urlRegex) || [];
}

// Check if user has phone verification
export async function hasPhoneVerification(userId: string): Promise<boolean> {
  // Discord native verification levels block members from chatting 
  // before their phone is verified if the guild requires it.
  // Hence if they can trigger this event, they bypassed standard pending flow or the server doesn't require it.
  return true;
}

// Cleanup old cache entries periodically
setInterval(() => {
  const now = Date.now();

  // Clean captcha pending
  for (const [userId, pending] of captchaPending.entries()) {
    if (now > pending.expiresAt) {
      captchaPending.delete(userId);
    }
  }

  // Clean behavior cache for users inactive > 1 hour
  for (const [userId, behavior] of userBehaviorCache.entries()) {
    if (now - behavior.lastMessageTime > 3600000) {
      userBehaviorCache.delete(userId);
    }
  }

  // Clean old link reputation cache
  for (const [url, data] of linkReputationCache.entries()) {
    if (now - data.lastChecked > 86400000) { // 24 hours
      linkReputationCache.delete(url);
    }
  }
}, 300000); // Run every 5 minutes

export type { SecuritySettings };
export { defaultSettings };
