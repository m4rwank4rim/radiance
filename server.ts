import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import cron from "node-cron";
import crypto from "node:crypto";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, OverwriteType, PermissionFlagsBits } from "discord.js";
import Groq from "groq-sdk";

import { startBot, bot } from "./bot.js";
import { createClient } from "@supabase/supabase-js";
import {
  getSecuritySettings,
  updateSecuritySettings,
  checkLinkReputation,
  analyzeMessageWithML,
  trackUserBehavior,
  calculateAdaptiveSlowmode,
  isGloballyBlacklisted,
  setCaptchaPending,
  verifyCaptcha,
  getCaptchaPending,
  detectRaid,
  recordHoneytrapTrigger,
  setLockdownState,
  isLockdownActive,
  quarantineUser,
  isQuarantined,
  addPendingMessage,
  releaseQuarantine,
  extractUrls,
  SecuritySettings
} from "./security.js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const DEFAULT_ACTIVE_MODULES = { moderation: true, commands: true, leveling: true } as const;

function normalizeActiveModules(input: any = null) {
  const modules = { ...DEFAULT_ACTIVE_MODULES, ...(input || {}) } as Record<string, any>;
  delete modules.gambling;
  return modules;
}

const DEFAULT_ENTITLEMENTS = {
  ai_moderation: false,
  ticket_intelligence: false,
  backup_restore: false,
  executive_analytics: false,
  white_label: false
};
const PLAN_ORDER = ["free", "business", "enterprise"] as const;
const processedIdempotencyKeys = new Map<string, number>();

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function logPlatformEvent(
  guildId: string,
  eventType: string,
  severity: "info" | "warning" | "critical" = "info",
  metadata: Record<string, any> = {},
  source: "bot" | "dashboard" | "system" = "dashboard"
) {
  if (!supabase || !guildId) return;
  await supabase.from("event_logs").insert({
    guild_id: guildId,
    source,
    event_type: eventType,
    severity,
    metadata
  });
}

async function getGuildEntitlements(guildId: string): Promise<Record<string, boolean>> {
  if (!supabase || !guildId) return { ...DEFAULT_ENTITLEMENTS };
  const { data } = await supabase.from("entitlements").select("features").eq("guild_id", guildId).maybeSingle();
  return { ...DEFAULT_ENTITLEMENTS, ...(data?.features || {}) };
}

async function requireEntitlement(
  req: express.Request,
  res: express.Response,
  feature: keyof typeof DEFAULT_ENTITLEMENTS
): Promise<boolean> {
  const features = await getGuildEntitlements(req.params.id);
  if (!features[feature]) {
    res.status(403).json({ error: `Feature '${feature}' requires an upgraded plan.` });
    return false;
  }
  return true;
}

function serializeChannel(channel: any) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId || null,
    position: channel.position ?? 0,
    topic: channel.topic ?? null,
    nsfw: !!channel.nsfw,
    rateLimitPerUser: channel.rateLimitPerUser ?? 0,
    bitrate: channel.bitrate ?? null,
    userLimit: channel.userLimit ?? null,
    rtcRegion: channel.rtcRegion ?? null,
    videoQualityMode: channel.videoQualityMode ?? null,
    permissionOverwrites: (channel.permissionOverwrites?.cache?.map((ow: any) => ({
      id: ow.id,
      type: ow.type,
      allow: ow.allow?.bitfield?.toString?.() || "0",
      deny: ow.deny?.bitfield?.toString?.() || "0"
    })) || [])
  };
}

function serializeRole(role: any) {
  return {
    id: role.id,
    name: role.name,
    color: role.hexColor,
    permissions: role.permissions?.bitfield?.toString?.() || "0",
    position: role.position ?? 0,
    hoist: !!role.hoist,
    mentionable: !!role.mentionable
  };
}

async function buildGuildSnapshotPayload(guildId: string) {
  if (!supabase) return null;
  const guild = bot.guilds.cache.get(guildId);
  if (!guild) return null;

  const channels = guild.channels.cache.map((ch: any) => serializeChannel(ch));
  const roles = guild.roles.cache
    .filter((r: any) => r.name !== "@everyone")
    .map((r: any) => serializeRole(r));
  const emojis = guild.emojis.cache.map((e: any) => ({
    id: e.id,
    name: e.name,
    animated: !!e.animated
  }));
  const stickers = guild.stickers.cache.map((s: any) => ({
    id: s.id,
    name: s.name,
    description: s.description || null
  }));
  const { data: config } = await supabase.from("guilds").select("prefix,active_modules,xp_rate").eq("id", guildId).maybeSingle();
  const guildSettings = {
    afkTimeout: guild.afkTimeout,
    afkChannelId: guild.afkChannelId || null,
    systemChannelId: guild.systemChannelId || null,
    rulesChannelId: guild.rulesChannelId || null,
    publicUpdatesChannelId: guild.publicUpdatesChannelId || null,
    verificationLevel: guild.verificationLevel,
    explicitContentFilter: guild.explicitContentFilter,
    defaultMessageNotifications: guild.defaultMessageNotifications,
    preferredLocale: guild.preferredLocale
  };
  return { channels, roles, emojis, stickers, guildSettings, config: config || {} };
}

function computeRestorePlan(payload: any) {
  const channels = payload?.channels || [];
  const roles = payload?.roles || [];
  const overwriteCount = channels.reduce((acc: number, ch: any) => acc + Number(ch.permissionOverwrites?.length || 0), 0);
  return {
    roles_total: roles.length,
    channels_total: channels.length,
    categories_total: channels.filter((c: any) => c.type === ChannelType.GuildCategory).length,
    overwrites_total: overwriteCount,
    emojis_total: (payload?.emojis || []).length,
    stickers_total: (payload?.stickers || []).length,
    has_guild_settings: !!payload?.guildSettings,
    has_config: !!payload?.config
  };
}

function normalizePlan(input: string | undefined): "free" | "business" | "enterprise" {
  const value = String(input || "").toLowerCase();
  if (value === "enterprise") return "enterprise";
  if (value === "business") return "business";
  return "free";
}

function buildCheckoutUrl(guildId: string, plan: "business" | "enterprise"): string | null {
  const businessLink = process.env.STRIPE_BUSINESS_PAYMENT_LINK || "";
  const enterpriseLink = process.env.STRIPE_ENTERPRISE_PAYMENT_LINK || "";
  const fallbackBase = process.env.STRIPE_CHECKOUT_BASE_URL || "";
  const selected = plan === "enterprise" ? enterpriseLink : businessLink;
  const baseUrl = selected || fallbackBase;
  if (!baseUrl) return null;
  const url = new URL(baseUrl);
  url.searchParams.set("guild_id", guildId);
  url.searchParams.set("plan", plan);
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  url.searchParams.set("success_url", `${appUrl}/billing/success?guildId=${guildId}&plan=${plan}`);
  url.searchParams.set("cancel_url", `${appUrl}/billing/cancel?guildId=${guildId}&plan=${plan}`);
  return url.toString();
}

function getDefaultBackupScheduler() {
  return {
    enabled: true,
    cadence: "daily", // daily | weekly
    weekday: 1, // Monday (UTC) for weekly
    hour: 3,
    minute: 15,
    retention: 30,
    last_run_at: null as string | null
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const HEALTH_BODY = "Bot is online";

  app.use(cors());
  app.use(express.json());

  // --- Render / UptimeRobot keep-alive health checks ---
  // Registered before the request logger and all API/SPA middleware so probes
  // are answered immediately and never touch the Discord client or Supabase.
  app.get("/health", (_req, res) => {
    res.status(200).type("text/plain").send(HEALTH_BODY);
  });

  app.get("/", (req, res, next) => {
    // Health probes (Render port check, UptimeRobot, curl) don't request HTML.
    // Real browser navigations still get the dashboard landing page.
    if ((req.headers.accept || "").includes("text/html")) return next();
    res.status(200).type("text/plain").send(HEALTH_BODY);
  });

  app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
  });

  // Lightweight idempotency cache cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of processedIdempotencyKeys.entries()) {
      if (now - ts > 15 * 60 * 1000) processedIdempotencyKeys.delete(key);
    }
  }, 60 * 1000);

  app.get("/test", (req, res) => {
    res.send("Test successful");
  });

  app.get("/api/health", (req, res) => {
    console.log("[API] Health check accessed");
    res.json({
      status: "ok",
      botStatus: bot.isReady() ? "online" : "offline",
      ping: bot.ws.ping,
      supabaseConfigured: !!supabase
    });
  });

  app.get("/api/bot-config", (req, res) => {
    console.log("[API] Bot config accessed");
    res.json({
      discordClientId: process.env.DISCORD_CLIENT_ID
    });
  });

  // --- Dynamic Voice APIs ---
  app.get("/api/guilds/:id/dynamic-voice", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      console.log(`[DynamicVoice] Requesting settings for guild: ${req.params.id}`);
      let result = await supabase
        .from('guilds')
        .select('dynamic_voice_enabled, dynamic_voice_hub_id, dynamic_voice_naming, dynamic_voice_menu')
        .eq('id', req.params.id)
        .single();

      let data = result.data;
      let error = result.error;

      if (error && error.code === '42703') { // Column doesn't exist
        console.warn(`[DynamicVoice] Column 'dynamic_voice_menu' missing, falling back.`);
        const retry = await supabase
          .from('guilds')
          .select('dynamic_voice_enabled, dynamic_voice_hub_id, dynamic_voice_naming')
          .eq('id', req.params.id)
          .single();
        data = retry.data ? { ...retry.data, dynamic_voice_menu: true } as any : null;
        error = retry.error;
      }

      if (error && error.code !== 'PGRST116') {
        console.error(`[DynamicVoice] Supabase Error for ${req.params.id}:`, error);
        throw error;
      }

      if (!data) {
        console.log(`[DynamicVoice] Guild ${req.params.id} not found in DB, using defaults.`);
        return res.json({
          dynamic_voice_enabled: false,
          dynamic_voice_hub_id: "",
          dynamic_voice_naming: "🔊 {user}'s Channel",
          dynamic_voice_menu: true
        });
      }

      console.log(`[DynamicVoice] Success for ${req.params.id}`);
      res.json(data);
    } catch (err: any) {
      console.error(`[DynamicVoice] Catch:`, err);
      res.status(500).json({ error: err.message || "Internal Server Error" });
    }
  });

  app.post("/api/guilds/:id/dynamic-voice", async (req, res) => {
    const { enabled, hub_id, naming_format, menu_enabled } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      console.log(`[DynamicVoice] Saving settings for guild ${req.params.id}:`, req.body);

      const updateData: any = {
        dynamic_voice_enabled: enabled,
        dynamic_voice_hub_id: hub_id,
        dynamic_voice_naming: naming_format
      };

      // Try to save with menu_enabled first
      let { error } = await supabase.from('guilds').update({ ...updateData, dynamic_voice_menu: menu_enabled }).eq('id', req.params.id);

      if (error && error.code === '42703') {
        // Column doesn't exist, try without it
        console.warn(`[DynamicVoice] Column 'dynamic_voice_menu' missing, saving without it.`);
        const result = await supabase.from('guilds').update(updateData).eq('id', req.params.id);
        error = result.error;
      }

      if (error) {
        console.error(`[DynamicVoice] Save failed for guild ${req.params.id}:`, error);
        return res.status(500).json({ error: "Failed to save dynamic voice settings", details: error.message });
      }

      console.log(`[DynamicVoice] Settings saved successfully for guild ${req.params.id}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`[DynamicVoice] Exception saving settings for guild ${req.params.id}:`, err);
      res.status(500).json({ error: "Failed to update dynamic voice settings", details: err.message });
    }
  });

  // --- Command Permissions APIs ---
  app.get("/api/guilds/:id/command-permissions", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { data, error } = await supabase.from('command_permissions').select('*').eq('guild_id', req.params.id);
      if (error) throw error;
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch command permissions" });
    }
  });

  app.post("/api/guilds/:id/command-permissions", async (req, res) => {
    const { permissions } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      // Upsert permissions
      for (const p of permissions) {
        const { error } = await supabase
          .from('command_permissions')
          .upsert({ guild_id: req.params.id, ...p }, { onConflict: 'guild_id,command_name' });
        if (error) throw error;
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save command permissions" });
    }
  });

  // --- Core API Priority Routes ---
  app.get("/api/guilds/:id/channels", (req, res) => {
    const guildId = req.params.id;
    if (bot.isReady()) {
      const guild = bot.guilds.cache.get(guildId);
      if (guild) {
        const channels = guild.channels.cache.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type
        }));
        return res.json(channels);
      }
    }
    res.json([]);
  });

  app.get("/api/guilds/:id/emojis", (req, res) => {
    const guildId = req.params.id;
    if (bot.isReady()) {
      const guild = bot.guilds.cache.get(guildId);
      if (guild) {
        const emojis = guild.emojis.cache.map((e: any) => ({
          id: e.id,
          name: e.name,
          animated: !!e.animated,
          url: e.imageURL({ size: 64 }) || `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? 'gif' : 'png'}?size=64`
        }));
        return res.json([...emojis]);
      }
    }
    res.json([]);
  });

  app.get("/api/guilds/:id/members", async (req, res) => {
    const guildId = req.params.id;
    const query = String(req.query.query || "").toLowerCase().trim();
    if (!bot.isReady()) return res.json([]);
    const guild = bot.guilds.cache.get(guildId);
    if (!guild) return res.json([]);

    try {
      await guild.members.fetch().catch(() => { });
      const members = guild.members.cache
        .filter(m => !m.user.bot)
        .filter(m => {
          if (!query) return true;
          return (
            m.user.username.toLowerCase().includes(query) ||
            m.displayName.toLowerCase().includes(query) ||
            m.user.id.includes(query)
          );
        })
        .first(20)
        .map(m => ({
          id: m.user.id,
          username: m.user.username,
          displayName: m.displayName
        }));
      res.json(members);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  app.get("/api/guilds/:id/analytics", async (req, res) => {
    if (!supabase) {
      return res.json({
        history: [
          { date: '2024-04-01', total_members: 1200, messages_24h: 450, commands_used: 120 },
          { date: '2024-04-02', total_members: 1215, messages_24h: 580, commands_used: 145 },
          { date: '2024-04-03', total_members: 1228, messages_24h: 390, commands_used: 110 },
          { date: '2024-04-04', total_members: 1245, messages_24h: 620, commands_used: 180 },
          { date: '2024-04-05', total_members: 1260, messages_24h: 710, commands_used: 210 },
        ]
      });
    }
    try {
      const { data, error } = await supabase
        .from('historical_stats')
        .select('*')
        .eq('guild_id', req.params.id)
        .order('date', { ascending: true })
        .limit(30);

      if (error) throw error;
      res.json({ history: data || [] });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/guilds/:id/leaderboard", async (req, res) => {
    if (!supabase) return res.json([]);
    try {
      const { data, error } = await supabase
        .from('levels')
        .select('user_id, xp, level')
        .eq('guild_id', req.params.id)
        .order('xp', { ascending: false })
        .limit(20);

      if (error) throw error;

      const resolved = await Promise.all((data || []).map(async (entry, index) => {
        let username = `User_${entry.user_id.slice(-4)}`;
        let avatar = null;
        if (bot.isReady()) {
          try {
            const user = await bot.users.fetch(entry.user_id);
            if (user) {
              username = user.username;
              avatar = user.displayAvatarURL();
            }
          } catch (e) { }
        }
        return { ...entry, username, avatar, rank: index + 1 };
      }));

      res.json(resolved);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // --- AI Server Architect Feature ---
  app.post("/api/guilds/:id/ai/architect/generate", async (req, res) => {
    const { prompt } = req.body;

    try {

      const SYSTEM_PROMPT = `You are a MASTER Discord Server Architect.
### GOAL: Build ELITE, NICHE-SPECIFIC Discord infrastructure.
### STYLE: Emoji + Professional Divider (e.g., 👋│welcome-logs), lowercase-with-dashes channels.
### RULES: RESPONSE MUST BE ONLY JSON. NO MARKDOWN. NO CODE FENCES.

JSON FORMAT:
{
  "categories": [
    {
      "name": "Category Name",
      "channels": [
        { "name": "emoji│chan-name", "type": "text" | "voice" }
      ]
    }
  ],
  "roles": [
    { "name": "Role Name", "color": "#HEX", "permissions": ["ADMINISTRATOR", "MANAGE_MESSAGES", etc] }
  ]
}

Role Hierarchy: Include 15+ roles with visual dividers (─── STAFF ───).`;

      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt || "A general community Discord server" }
        ],
        model: "llama-3.3-70b-versatile",
      });
      const response = chatCompletion.choices[0]?.message?.content || "";

      const cleanText = response.replace(/```json|```/g, "").trim();

      if (!cleanText) {
        throw new Error("Puter returned an empty response");
      }

      const json = JSON.parse(cleanText);
      res.json(json);
    } catch (err: any) {
      console.error("[Architect Generate Error]:", err);
      res.status(500).json({ error: err.message || "Failed to generate structure" });
    }
  });

  app.post("/api/guilds/:id/ai/architect/execute", async (req, res) => {
    const { template, mode = 'purge' } = req.body;
    const guildId = req.params.id;

    console.log(`[Architect] Execution requested for guild ${guildId}. Mode: ${mode}`);
    if (!bot.isReady()) {
      console.error("[Architect] Bot not ready for execution.");
      return res.status(503).json({ error: "Bot is not ready" });
    }

    try {
      console.log("[Architect] Importing executeArchitectTemplate...");
      const { executeArchitectTemplate } = await import('./bot.js');
      console.log("[Architect] Executing template...");
      const summary = await executeArchitectTemplate(guildId, template, mode);
      console.log("[Architect] Execution complete:", summary);

      // --- Persistence: Record Deployment ---
      if (supabase) {
        try {
          const { prompt } = req.body;
          await supabase.from('ai_architect_deployments').insert({
            guild_id: guildId,
            prompt: prompt || 'Direct Template Execution',
            template,
            summary,
            mode
          });

          // Increment runs in historical stats
          const today = new Date().toISOString().split('T')[0];
          const { data: stats } = await supabase.from('historical_stats').select('ai_architect_runs').eq('guild_id', guildId).eq('date', today).single();
          await supabase.from('historical_stats').upsert({
            guild_id: guildId,
            date: today,
            ai_architect_runs: (stats?.ai_architect_runs || 0) + 1
          }, { onConflict: 'guild_id,date' });
        } catch (dbErr) {
          console.error("Failed to log architect deployment:", dbErr);
        }
      }

      res.json({ success: true, result: summary });
    } catch (err: any) {
      console.error("Architect Execution Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Start Discord Bot Engine
  startBot();

  // Nightly statistics cron job (at midnight)
  cron.schedule('0 0 * * *', async () => {
    if (!bot.isReady() || !supabase) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      for (const [guildId, guild] of bot.guilds.cache) {
        // Fetch moderation total for today
        const { count: modsToday } = await supabase
          .from('moderation_logs')
          .select('*', { count: 'exact', head: true })
          .eq('guild_id', guildId)
          .gte('created_at', `${today}T00:00:00.000Z`);

        await supabase.from('historical_stats').upsert({
          guild_id: guildId,
          date: today,
          total_members: guild.memberCount,
          messages_24h: (modsToday || 0) * 10 // rough heuristic for total messages if not tracking universally
        }, { onConflict: 'guild_id,date' });
      }
      console.log(`[Cron] Inserted nightly stats for ${bot.guilds.cache.size} guilds.`);
    } catch (err) {
      console.error("[Cron] Failed to insert nightly stats:", err);
    }
  });

  // API Routes
  type DiagnosticCheck = {
    id: string;
    label: string;
    ok: boolean;
    details: string;
    tip?: string;
    severity: "info" | "warning" | "error";
    route?: string;
  };

  const computeDiagnostics = async (guildId: string) => {
    const checks: DiagnosticCheck[] = [];
    const pushCheck = (check: DiagnosticCheck) => checks.push(check);

    const botReady = bot.isReady();
    pushCheck({
      id: "bot_ready",
      label: "Bot Gateway",
      ok: botReady,
      details: botReady ? "Connected and ready." : "Bot is offline or still initializing.",
      tip: botReady ? undefined : "Start the bot process and verify DISCORD_BOT_TOKEN is valid.",
      severity: botReady ? "info" : "error"
    });

    if (!botReady) {
      const failedCount = checks.filter(c => !c.ok).length;
      return { status: "warning", failedCount, checks };
    }

    const guild = bot.guilds.cache.get(guildId);
    if (!guild) {
      pushCheck({
        id: "guild_membership",
        label: "Guild Access",
        ok: false,
        details: "Bot is not present in this guild cache.",
        tip: "Re-invite the bot to this server with the correct scopes and permissions.",
        severity: "error"
      });
      const failedCount = checks.filter(c => !c.ok).length;
      return { status: "error", failedCount, checks };
    }

    pushCheck({
      id: "guild_membership",
      label: "Guild Access",
      ok: true,
      details: `Connected to ${guild.name}.`,
      severity: "info"
    });

    const me = guild.members.me;
    if (!me) {
      pushCheck({
        id: "bot_member_state",
        label: "Bot Member State",
        ok: false,
        details: "Unable to resolve bot member permissions in guild.",
        tip: "Reopen Discord and refresh guild member cache, then retry diagnostics.",
        severity: "error"
      });
      const failedCount = checks.filter(c => !c.ok).length;
      return { status: "error", failedCount, checks };
    }

    const permissionChecks = [
      { id: "perm_view_channel", label: "View Channels", perm: PermissionFlagsBits.ViewChannel, details: "Needed for channel discovery." },
      { id: "perm_send_messages", label: "Send Messages", perm: PermissionFlagsBits.SendMessages, details: "Needed for bot replies and ticket responses." },
      { id: "perm_manage_channels", label: "Manage Channels", perm: PermissionFlagsBits.ManageChannels, details: "Needed for tickets and dynamic voice channel management." },
      { id: "perm_manage_roles", label: "Manage Roles", perm: PermissionFlagsBits.ManageRoles, details: "Needed for role panels and reward roles." },
      { id: "perm_moderate_members", label: "Moderate Members", perm: PermissionFlagsBits.ModerateMembers, details: "Recommended for timeout/mod actions." },
    ];

    for (const p of permissionChecks) {
      const hasPerm = me.permissions.has(p.perm);
      pushCheck({
        id: p.id,
        label: p.label,
        ok: hasPerm,
        details: p.details,
        tip: hasPerm ? undefined : "Server Settings -> Roles -> Radiance -> enable this permission.",
        severity: hasPerm ? "info" : "warning"
      });
    }

    let guildConfig: any = null;
    if (supabase) {
      try {
        const { data } = await supabase
          .from('guilds')
          .select('active_modules, logging_enabled, logging_channel_id, welcome_enabled, welcome_channel, farewell_enabled, farewell_channel, ai_enabled, ai_channel_id, dynamic_voice_enabled, dynamic_voice_hub_id, level_up_channel')
          .eq('id', guildId)
          .single();
        guildConfig = data;
      } catch {
        pushCheck({
          id: "db_config_read",
          label: "Guild Config Read",
          ok: false,
          details: "Could not load guild configuration from Supabase.",
          tip: "Verify Supabase connectivity and that a guild row exists.",
          severity: "error"
        });
      }
    }

    const modules = guildConfig?.active_modules || {};
    const configuredChannels: Array<{ id: string; label: string; channelId?: string | null; requiredPermission?: bigint; moduleEnabled?: boolean; route?: string }> = [
      { id: "log_channel", label: "Logging Channel", channelId: guildConfig?.logging_channel_id, requiredPermission: PermissionFlagsBits.SendMessages, moduleEnabled: !!guildConfig?.logging_enabled, route: `/dashboard/${guildId}/logging` },
      { id: "welcome_channel", label: "Welcome Channel", channelId: guildConfig?.welcome_channel, requiredPermission: PermissionFlagsBits.SendMessages, moduleEnabled: !!guildConfig?.welcome_enabled, route: `/dashboard/${guildId}/welcome` },
      { id: "farewell_channel", label: "Farewell Channel", channelId: guildConfig?.farewell_channel, requiredPermission: PermissionFlagsBits.SendMessages, moduleEnabled: !!guildConfig?.farewell_enabled, route: `/dashboard/${guildId}/welcome` },
      { id: "ai_channel", label: "AI Support Channel", channelId: guildConfig?.ai_channel_id, requiredPermission: PermissionFlagsBits.SendMessages, moduleEnabled: !!guildConfig?.ai_enabled, route: `/dashboard/${guildId}/ai` },
      { id: "levelup_channel", label: "Level Up Channel", channelId: guildConfig?.level_up_channel, requiredPermission: PermissionFlagsBits.SendMessages, moduleEnabled: modules.leveling !== false, route: `/dashboard/${guildId}/levels` },
      { id: "voice_hub_channel", label: "Dynamic Voice Hub", channelId: guildConfig?.dynamic_voice_hub_id, requiredPermission: PermissionFlagsBits.ManageChannels, moduleEnabled: !!guildConfig?.dynamic_voice_enabled, route: `/dashboard/${guildId}/voice` },
    ];

    for (const cc of configuredChannels) {
      if (!cc.moduleEnabled) continue;
      if (!cc.channelId) {
        pushCheck({
          id: `${cc.id}_configured`,
          label: `${cc.label} Configured`,
          ok: false,
          details: `${cc.label} is enabled but no channel is configured.`,
          tip: "Open dashboard module settings and pick a channel.",
          severity: "warning",
          route: cc.route
        });
        continue;
      }

      const channel = guild.channels.cache.get(cc.channelId);
      if (!channel) {
        pushCheck({
          id: `${cc.id}_exists`,
          label: `${cc.label} Exists`,
          ok: false,
          details: `Configured channel (${cc.channelId}) is missing from this guild.`,
          tip: "Select a valid channel in dashboard settings.",
          severity: "warning",
          route: cc.route
        });
        continue;
      }

      const channelPerms = channel.permissionsFor(me);
      const hasPerm = cc.requiredPermission ? !!channelPerms?.has(cc.requiredPermission) : true;
      pushCheck({
        id: `${cc.id}_permission`,
        label: `${cc.label} Permission`,
        ok: hasPerm,
        details: hasPerm ? `Bot can access ${cc.label.toLowerCase()}.` : `Bot lacks required permission in #${(channel as any).name}.`,
        tip: hasPerm ? undefined : "Grant channel-level permissions for the Radiance role.",
        severity: hasPerm ? "info" : "warning",
        route: cc.route
      });
    }

    if (modules.moderation !== false) {
      const hasPerm = me.permissions.has(PermissionFlagsBits.ModerateMembers);
      pushCheck({
        id: "module_moderation_ready",
        label: "Moderation Module Readiness",
        ok: hasPerm,
        details: "Moderation is enabled and expects timeout/moderation permissions.",
        tip: hasPerm ? undefined : "Enable Moderate Members for reliable moderation actions.",
        severity: hasPerm ? "info" : "warning",
        route: `/dashboard/${guildId}/moderation`
      });
    }

    if (modules.commands !== false) {
      const hasPerm = me.permissions.has(PermissionFlagsBits.SendMessages);
      pushCheck({
        id: "module_commands_ready",
        label: "Custom Commands Readiness",
        ok: hasPerm,
        details: "Custom commands require reply permissions in target channels.",
        tip: hasPerm ? undefined : "Enable Send Messages for the Radiance role.",
        severity: hasPerm ? "info" : "warning",
        route: `/dashboard/${guildId}/commands`
      });
    }

    const failedCount = checks.filter(c => !c.ok).length;
    const status = failedCount === 0 ? "ok" : "warning";
    return { status, failedCount, checks };
  };

  app.get("/api/guilds/:id/diagnostics", async (req, res) => {
    const result = await computeDiagnostics(req.params.id);
    res.json(result);
  });

  app.post("/api/guilds/:id/diagnostics/snapshot", async (req, res) => {
    const guildId = req.params.id;
    const { action = "manual_snapshot", note = null, targetCheckId = null } = req.body || {};
    const result = await computeDiagnostics(guildId);

    if (!supabase) {
      return res.status(500).json({ error: "Supabase not initialized" });
    }

    const targetCheck = targetCheckId
      ? result.checks.find((c: any) => c.id === targetCheckId)
      : null;

    const payload = {
      guild_id: guildId,
      status: result.status,
      failed_count: result.failedCount,
      action,
      note,
      target_check_id: targetCheckId,
      target_check_ok: targetCheck ? targetCheck.ok : null,
      checks: result.checks,
    };

    const { data, error } = await supabase
      .from('diagnostics_history')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error("[Diagnostics] Failed to save snapshot:", error);
      return res.status(500).json({ error: "Failed to save diagnostics snapshot" });
    }

    res.json({ success: true, snapshot: data, diagnostics: result });
  });

  app.get("/api/guilds/:id/diagnostics/history", async (req, res) => {
    const guildId = req.params.id;
    if (!supabase) return res.json([]);

    const { data, error } = await supabase
      .from('diagnostics_history')
      .select('id, created_at, status, failed_count, action, note, target_check_id, target_check_ok')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(15);

    if (error) {
      console.error("[Diagnostics] Failed to fetch history:", error);
      return res.status(500).json({ error: "Failed to fetch diagnostics history" });
    }

    res.json(data || []);
  });

  app.get("/api/global-stats", (req, res) => {
    const isReady = bot.isReady();
    const guildCount = isReady ? bot.guilds.cache.size : 0;
    const userCount = isReady ? bot.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0) : 0;

    res.json({
      activeServers: guildCount,
      uptime: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
      weeklyUsers: userCount,
      supportStatus: isReady ? "Online" : "Starting"
    });
  });

  // Mock Data for fallback - used only when Discord API fails or no token
  const mockGuilds = [
    { id: "123456789012345678", name: "Radiance Support", icon: null, memberCount: 1500, active: true },
    { id: "876543210987654321", name: "Community Hub", icon: null, memberCount: 850, active: false },
  ];

  // In-memory store for when Supabase is not configured
  const mockDb = {
    configs: new Map<string, any>(),
    commands: new Map<string, any[]>(),
    logs: new Map<string, any[]>(),
    music: new Map<string, { isPlaying: boolean, volume: number, queue: any[] }>()
  };

  app.get("/api/guilds", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.json(mockGuilds); // Fallback to mock if no token
    }

    const token = authHeader.split(" ")[1];

    try {
      // Fetch guilds from Discord
      const discordRes = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!discordRes.ok) {
        const errText = await discordRes.text();
        console.error("Discord API error:", discordRes.status, errText);
        return res.status(discordRes.status).json({ error: "Discord API error", details: errText });
      }

      const discordGuilds = await discordRes.json();

      // Filter for MANAGE_GUILD (0x20) or ADMINISTRATOR (0x8)
      const managedGuilds = discordGuilds.filter((g: any) => {
        const perms = BigInt(g.permissions);
        return (perms & 0x20n) === 0x20n || (perms & 0x8n) === 0x8n;
      });

      // Fetch active guilds from Supabase if configured, fallback to bot cache
      let activeGuildIds = new Set<string>();
      if (supabase) {
        try {
          const guildIds = managedGuilds.map((g: any) => g.id);
          const { data: activeGuilds } = await supabase
            .from('guilds')
            .select('id')
            .in('id', guildIds);
          activeGuildIds = new Set(activeGuilds?.map(g => g.id) || []);
        } catch (err) {
          console.error("Failed to fetch active guilds from Supabase:", err);
        }
      }
      // Fallback: mark guilds the bot is actually in as active
      if (bot.isReady()) {
        for (const g of managedGuilds) {
          if (bot.guilds.cache.has(g.id)) {
            activeGuildIds.add(g.id);
          }
        }
      }

      const result = managedGuilds.map((g: any) => {
        // Try to get real member count if bot is in the guild
        let memberCount: any = "N/A";
        if (bot.isReady()) {
          const cachedGuild = bot.guilds.cache.get(g.id);
          if (cachedGuild) {
            memberCount = cachedGuild.memberCount;
          }
        }

        return {
          id: g.id,
          name: g.name,
          icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
          memberCount: memberCount,
          active: activeGuildIds.has(g.id)
        };
      });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch guilds" });
    }
  });

  // Force-sync: upsert all bot-cached guilds into Supabase so they show as "active"
  app.post("/api/guilds/sync", async (req, res) => {
    if (!bot.isReady()) {
      return res.status(503).json({ error: "Bot is not ready. Cannot sync guilds." });
    }
    if (!supabase) {
      return res.status(503).json({ error: "Supabase is not configured." });
    }

    const results: { id: string; name: string; ok: boolean; error?: string }[] = [];

    for (const [id, guild] of bot.guilds.cache) {
      try {
        const { error } = await supabase.from('guilds').upsert({
          id,
          name: guild.name,
          icon: guild.iconURL({ extension: 'png' }) || null,
          owner_id: guild.ownerId
        }, { onConflict: 'id' });

        results.push({ id, name: guild.name, ok: !error, error: error?.message });
      } catch (err: any) {
        results.push({ id, name: guild.name, ok: false, error: err?.message });
      }
    }

    const successCount = results.filter(r => r.ok).length;
    console.log(`[Sync] Force-synced ${successCount}/${results.length} guilds to Supabase.`);
    res.json({ success: true, synced: successCount, total: results.length, results });
  });

  app.get("/api/stats/:id", async (req, res) => {
    const guildId = req.params.id;
    console.log(`[API] Fetching stats for guild ID: ${guildId}`);

    // Try to get actual member count if bot is running
    let memberCount = 0;
    let activeVoice = 0;
    let guildName = "Unknown Server";
    let region = "Unknown";

    if (bot.isReady()) {
      const guild = bot.guilds.cache.get(guildId);
      if (guild) {
        memberCount = guild.memberCount;
        activeVoice = guild.voiceStates.cache.size;
        guildName = guild.name;
        region = guild.preferredLocale || "en-US";
        console.log(`[API] Found guild in bot cache: ${guildName}`);
      } else {
        console.log(`[API] Guild ${guildId} not found in bot cache.`);
      }
    } else {
      console.log(`[API] Bot not ready yet.`);
    }

    // Try to get guild name from Supabase if bot cache fails
    if (guildName === "Unknown Server" && supabase) {
      try {
        const { data } = await supabase
          .from('guilds')
          .select('name')
          .eq('id', guildId)
          .single();
        if (data?.name) {
          guildName = data.name;
          console.log(`[API] Found guild name in Supabase: ${guildName}`);
        }
      } catch (err) {
        // Ignore error
      }
    }

    const baseCount = memberCount ?? 0;

    let memberGrowth = [
      { name: "Mon", members: baseCount }, { name: "Tue", members: baseCount },
      { name: "Wed", members: baseCount }, { name: "Thu", members: baseCount },
      { name: "Fri", members: baseCount }, { name: "Sat", members: baseCount },
      { name: "Sun", members: baseCount }
    ];

    if (supabase) {
      try {
        const { data: dbStats } = await supabase
          .from('historical_stats')
          .select('date, total_members')
          .eq('guild_id', guildId)
          .order('date', { ascending: false })
          .limit(7);

        if (dbStats && dbStats.length > 0) {
          // Re-map with actual database records sorted chronologically
          const ordered = [...dbStats].reverse();
          memberGrowth = ordered.map(stat => ({
            name: new Date(stat.date).toLocaleDateString('en-US', { weekday: 'short' }),
            members: stat.total_members
          }));

          // Pad to 7 days if records exist but < 7
          while (memberGrowth.length < 7) {
            memberGrowth.unshift({ name: "...", members: memberGrowth[0].members });
          }
        }
      } catch (err) { }
    }

    // Fetch real stats from Supabase if available
    let messages24h = 0;
    let commandsUsed = 0;
    const now = new Date().toISOString().split('T')[0];

    if (supabase) {
      try {
        const { data: todayStats } = await supabase
          .from('historical_stats')
          .select('messages_24h, commands_used')
          .eq('guild_id', guildId)
          .eq('date', now)
          .single();

        if (todayStats) {
          messages24h = todayStats.messages_24h || 0;
          commandsUsed = todayStats.commands_used || 0;
        }
      } catch (err) { }
    }

    const voiceUsers = 0; // Music engine removed

    const firstDayMembers = memberGrowth[0].members;
    const lastDayMembers = memberGrowth[memberGrowth.length - 1].members;
    const memberTrendValue = firstDayMembers > 0 ? ((lastDayMembers - firstDayMembers) / firstDayMembers) * 100 : 0;
    const memberTrend = `${memberTrendValue >= 0 ? '+' : ''}${memberTrendValue.toFixed(1)}%`;

    const statsResponse = {
      name: guildName,
      region: region,
      memberGrowth,
      messages: messages24h,
      commandsUsed: commandsUsed,
      activeVoice: activeVoice, // Keep the raw connection count from Discord
      systemStatus: {
        apiLatency: `${bot.isReady() ? bot.ws.ping : 24}ms`,
        uptime: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
        voiceNodes: `0 Active` // Music engine removed
      },
      trends: {
        members: memberTrend,
        messages: "0.0%",
        commands: "Stable",
        voice: "0.0%"
      },
      lastDeploy: "Recently"
    };

    res.json(statsResponse);
    console.log(`[API] Stats sent for ${guildName} (Msg: ${messages24h}, Cmd: ${commandsUsed})`);
  });


  // Fetch Guild Config
  app.get("/api/guilds/:id/config", async (req, res) => {
    if (!supabase) {
      const config = mockDb.configs.get(req.params.id) || { prefix: "!", active_modules: DEFAULT_ACTIVE_MODULES };
      config.active_modules = normalizeActiveModules(config.active_modules);
      return res.json(config);
    }

    try {
      const { data, error } = await supabase
        .from('guilds')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found

      if (!data) {
        return res.json({ prefix: "!", active_modules: DEFAULT_ACTIVE_MODULES });
      }

      data.active_modules = normalizeActiveModules(data.active_modules);
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  // Update Guild Config
  app.post("/api/guilds/:id/config", async (req, res) => {
    const { prefix, active_modules, name, icon } = req.body;
    const normalizedModules = normalizeActiveModules(active_modules);

    if (!supabase) {
      mockDb.configs.set(req.params.id, { prefix, active_modules: normalizedModules, name, icon });
      return res.json({ success: true, message: "Mock config updated successfully." });
    }

    try {
      const { error } = await supabase
        .from('guilds')
        .upsert({
          id: req.params.id,
          prefix,
          active_modules: normalizedModules,
          name: name || 'Unknown Server',
          icon: icon || null
        }, { onConflict: 'id' });

      if (error) throw error;

      res.json({ success: true, message: "Configuration updated successfully." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  // Send Custom Embed
  app.post("/api/guilds/:id/channels/:channelId/embeds", async (req, res) => {
    try {
      const { channelId } = req.params;

      if (!bot.isReady()) {
        return res.status(503).json({ error: "Bot is not ready" });
      }

      if (!req.body || !req.body.embedData) {
        return res.status(400).json({ error: "Missing embedData in request body" });
      }

      const { embedData } = req.body;
      const channel = bot.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) {
        return res.status(404).json({ error: "Channel not found or is not text-based" });
      }

      const embeds = [];

      if (embedData.imagePosition === "top" && embedData.imageUrl) {
        // Embed 1: Header + Image
        const embed1 = new EmbedBuilder();
        if (embedData.authorName) {
            embed1.setAuthor({
                name: embedData.authorName,
                iconURL: embedData.authorIcon || undefined,
                url: embedData.authorUrl || undefined
            });
        }
        if (embedData.title) embed1.setTitle(embedData.title);
        if (embedData.titleUrl) embed1.setURL(embedData.titleUrl);
        if (embedData.description) embed1.setDescription(embedData.description);
        if (embedData.color) embed1.setColor(embedData.color);
        embed1.setImage(embedData.imageUrl);
        embeds.push(embed1);

        // Embed 2: Body + Fields + Footer
        const embed2 = new EmbedBuilder();
        if (embedData.color) embed2.setColor(embedData.color);
        if (embedData.bodyText) embed2.setDescription(embedData.bodyText);
        if (embedData.thumbnailUrl) embed2.setThumbnail(embedData.thumbnailUrl);
        
        if (embedData.fields && Array.isArray(embedData.fields)) {
            embed2.addFields(embedData.fields.filter((f: any) => f.name && f.value));
        }

        if (embedData.footerText) {
            embed2.setFooter({
                text: embedData.footerText,
                iconURL: embedData.footerIcon || undefined
            });
        }

        if (embedData.timestamp) {
            const t = String(embedData.timestamp);
            const date = t === "now" ? new Date() : new Date(t);
            if (!Number.isNaN(date.getTime())) {
                embed2.setTimestamp(date);
            }
        }
        
        const hasEmbed2Content = embedData.bodyText || embedData.thumbnailUrl || (embedData.fields && embedData.fields.length > 0) || embedData.footerText || embedData.timestamp;
        if (hasEmbed2Content) {
           embeds.push(embed2);
        }
      } else {
        const embed = new EmbedBuilder();
        if (embedData.title) embed.setTitle(embedData.title);
        if (embedData.titleUrl) embed.setURL(embedData.titleUrl);
        const fullDesc = [embedData.description, embedData.bodyText].filter(Boolean).join("\n\n");
        if (fullDesc) embed.setDescription(fullDesc);
        if (embedData.color) embed.setColor(embedData.color);
        if (embedData.imageUrl) embed.setImage(embedData.imageUrl);
        if (embedData.thumbnailUrl) embed.setThumbnail(embedData.thumbnailUrl);

        if (embedData.authorName) {
          embed.setAuthor({
            name: embedData.authorName,
            iconURL: embedData.authorIcon || undefined,
            url: embedData.authorUrl || undefined
          });
        }

        if (embedData.footerText) {
          embed.setFooter({
            text: embedData.footerText,
            iconURL: embedData.footerIcon || undefined
          });
        }

        if (embedData.timestamp) {
          const t = String(embedData.timestamp);
          const date = t === "now" ? new Date() : new Date(t);
          if (!Number.isNaN(date.getTime())) {
            embed.setTimestamp(date);
          }
        }

        if (embedData.fields && Array.isArray(embedData.fields)) {
          embed.addFields(embedData.fields.filter((f: any) => f.name && f.value));
        }
        embeds.push(embed);
      }

      await (channel as any).send({ embeds });
      res.json({ success: true, message: "Embed sent successfully" });
    } catch (err) {
      console.error("[Embed API] Error:", err);
      res.status(500).json({ error: "Failed to send embed" });
    }
  });

  // --- Command Mappings APIs ---
  app.get("/api/guilds/:id/command-mappings", async (req, res) => {
    if (!supabase) return res.json([]);
    try {
      const { data, error } = await supabase
        .from('command_mappings')
        .select('*')
        .eq('guild_id', req.params.id);
      if (error) throw error;
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch command mappings" });
    }
  });

  app.post("/api/guilds/:id/command-mappings/bulk", async (req, res) => {
    const { mappings } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      // Delete existing mappings for this guild
      await supabase.from('command_mappings').delete().eq('guild_id', req.params.id);

      // Insert new mappings
      const { data, error } = await supabase
        .from('command_mappings')
        .insert(mappings.map((m: any) => ({ guild_id: req.params.id, ...m })));

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save command mappings" });
    }
  });

  // Fetch Custom Commands
  app.get("/api/guilds/:id/commands", async (req, res) => {
    if (!supabase) {
      const commands = mockDb.commands.get(req.params.id) || [
        { id: "1", trigger: "rules", response: "Welcome! Please ensure you've read and accepted our community guidelines in the rules channel.", cooldown: 10, category: "Information" },
        { id: "2", trigger: "status", response: "All systems are currently operational. Check our status page for more details.", cooldown: 30, category: "System" },
      ];
      return res.json(commands);
    }

    try {
      const { data, error } = await supabase
        .from('custom_commands')
        .select('*')
        .eq('guild_id', req.params.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch commands" });
    }
  });

  // Create Custom Command
  app.post("/api/guilds/:id/commands", async (req, res) => {
    const { trigger, response, cooldown, category, is_embed, embed_title, embed_color } = req.body;

    if (!supabase) {
      const newCmd = { id: Math.random().toString(), trigger, response, cooldown, category: category || 'General', guild_id: req.params.id };
      const existing = mockDb.commands.get(req.params.id) || [
        { id: "1", trigger: "rules", response: "Welcome! Please ensure you've read and accepted our community guidelines in the rules channel.", cooldown: 10, category: "Information" },
        { id: "2", trigger: "status", response: "All systems are currently operational. Check our status page for more details.", cooldown: 30, category: "System" },
      ];
      mockDb.commands.set(req.params.id, [newCmd, ...existing]);
      return res.json(newCmd);
    }

    try {
      const { data, error } = await supabase
        .from('custom_commands')
        .insert({ guild_id: req.params.id, trigger, response, cooldown, category: category || 'General', is_embed, embed_title, embed_color })
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create command" });
    }
  });

  // Delete Custom Command
  app.delete("/api/guilds/:id/commands/:cmdId", async (req, res) => {
    if (!supabase) {
      const existing = mockDb.commands.get(req.params.id) || [];
      mockDb.commands.set(req.params.id, existing.filter(c => c.id !== req.params.cmdId));
      return res.json({ success: true });
    }

    try {
      const { error } = await supabase
        .from('custom_commands')
        .delete()
        .eq('id', req.params.cmdId)
        .eq('guild_id', req.params.id); // Ensure it belongs to the guild

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete command" });
    }
  });

  // Fetch Server Levels/Leaderboard
  app.get("/api/guilds/:id/levels", async (req, res) => {
    if (!supabase) {
      return res.json([]);
    }

    try {
      const { data, error } = await supabase
        .from('levels')
        .select('*')
        .eq('guild_id', req.params.id)
        .order('xp', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Resolve user details if bot is available
      const resolvedData = await Promise.all(data.map(async (entry) => {
        let username = `User_${entry.user_id.slice(-4)}`;
        let avatar = null;
        if (bot.isReady()) {
          try {
            const user = await bot.users.fetch(entry.user_id);
            if (user) {
              username = user.username;
              avatar = user.displayAvatarURL();
            }
          } catch (e) {
            console.error(`Failed to fetch user ${entry.user_id}:`, e);
          }
        }
        return { ...entry, username, avatar };
      }));

      res.json(resolvedData);
    } catch (err) {
      console.error("Failed to fetch levels:", err);
      res.status(500).json({ error: "Failed to fetch levels" });
    }
  });

  // Moderation Logs Endpoint
  app.get("/api/guilds/:id/moderation-logs", async (req, res) => {
    const guildId = req.params.id;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('moderation_logs')
          .select('*')
          .eq('guild_id', guildId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;
        const resolvedLogs = await Promise.all((data || []).map(async log => {
          let user_id = `User_${log.user_id.slice(-4)}`;
          let moderator_id = `Mod_${log.moderator_id.slice(-4)}`;
          if (bot.isReady()) {
            try {
              const u = await bot.users.fetch(log.user_id);
              if (u) user_id = u.username;
            } catch (e) { }
            try {
              if (log.moderator_id && log.moderator_id !== 'system') {
                const m = await bot.users.fetch(log.moderator_id);
                if (m) moderator_id = m.username;
              }
            } catch (e) { }
          }
          return { ...log, user_id, moderator_id };
        }));
        return res.json(resolvedLogs);
      } catch (err) {
        console.error("Failed to fetch logs from Supabase:", err);
      }
    }

    const mockLogs = [
      { id: "1", user_id: "User_8842", action: "Warned", reason: "Bad Language", created_at: new Date().toISOString() },
      { id: "2", user_id: "User_1293", action: "Muted", reason: "Spamming Links", created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: "3", user_id: "User_4421", action: "Kicked", reason: "Repeated Caps Lock", created_at: new Date(Date.now() - 7200000).toISOString() },
    ];
    res.json(mockLogs);
  });

  app.get("/api/guilds/:id/moderation-cases", async (req, res) => {
    if (!supabase) return res.json([]);
    try {
      const { data, error } = await supabase
        .from('moderation_cases')
        .select('*')
        .eq('guild_id', req.params.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch moderation cases" });
    }
  });

  app.get("/api/guilds/:id/moderation-appeals", async (req, res) => {
    if (!supabase) return res.json([]);
    try {
      const { data, error } = await supabase
        .from('moderation_appeals')
        .select('*')
        .eq('guild_id', req.params.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch moderation appeals" });
    }
  });

  app.get("/api/guilds/:id/warnings/:userId", async (req, res) => {
    if (!supabase) return res.json([]);
    try {
      const { data, error } = await supabase
        .from('user_warnings')
        .select('*')
        .eq('guild_id', req.params.id)
        .eq('user_id', req.params.userId)
        .order('created_at', { ascending: false })
        .limit(25);
      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch warnings" });
    }
  });

  app.delete("/api/guilds/:id/warnings/:userId", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { error } = await supabase
        .from('user_warnings')
        .delete()
        .eq('guild_id', req.params.id)
        .eq('user_id', req.params.userId);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to clear warnings" });
    }
  });

  app.get("/api/guilds/:id/warnings-summary", async (req, res) => {
    if (!supabase) return res.json([]);
    try {
      const { data, error } = await supabase
        .from('user_warnings')
        .select('user_id, reason, created_at')
        .eq('guild_id', req.params.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const grouped = new Map<string, { count: number; latest_reason: string; latest_created_at: string }>();
      for (const row of data || []) {
        const existing = grouped.get(row.user_id);
        if (!existing) {
          grouped.set(row.user_id, {
            count: 1,
            latest_reason: row.reason,
            latest_created_at: row.created_at
          });
        } else {
          existing.count += 1;
        }
      }

      const rows = await Promise.all(Array.from(grouped.entries()).map(async ([userId, info]) => {
        let username = `User_${userId.slice(-4)}`;
        if (bot.isReady()) {
          const user = await bot.users.fetch(userId).catch(() => null);
          if (user) username = user.username;
        }
        return {
          user_id: userId,
          username,
          warning_count: info.count,
          latest_reason: info.latest_reason,
          latest_created_at: info.latest_created_at
        };
      }));

      rows.sort((a, b) => b.warning_count - a.warning_count);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch warning summary" });
    }
  });

  app.get("/api/guilds/:id/security", async (req, res) => {
    if (!supabase) return res.json({ raid_mode_enabled: false, raid_join_threshold: 8, raid_window_seconds: 20 });
    try {
      const { data, error } = await supabase
        .from('guild_security')
        .select('*')
        .eq('guild_id', req.params.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      res.json(data || { guild_id: req.params.id, raid_mode_enabled: false, raid_join_threshold: 8, raid_window_seconds: 20 });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch security settings" });
    }
  });

  app.post("/api/guilds/:id/security", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const { raid_mode_enabled, raid_join_threshold, raid_window_seconds } = req.body;
    try {
      const { error } = await supabase
        .from('guild_security')
        .upsert({
          guild_id: req.params.id,
          raid_mode_enabled: !!raid_mode_enabled,
          raid_join_threshold: Math.max(2, Number(raid_join_threshold || 8)),
          raid_window_seconds: Math.max(5, Number(raid_window_seconds || 20))
        }, { onConflict: 'guild_id' });
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update security settings" });
    }
  });

  app.post("/api/guilds/:id/moderation/action", async (req, res) => {
    const { action, userId, reason, minutes, amount, channelId, seconds } = req.body || {};
    if (!bot.isReady()) return res.status(503).json({ error: "Bot is not ready" });
    const guild = bot.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: "Guild not found in bot cache" });
    try {
      if (action === 'ban' || action === 'kick' || action === 'timeout' || action === 'untimeout' || action === 'warn' || action === 'clear_warnings') {
        if (!userId) return res.status(400).json({ error: "userId is required" });
      }

      if (action === 'warn') {
        if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
        const reasonText = reason || "No reason provided";
        const { error } = await supabase.from('user_warnings').insert({
          guild_id: req.params.id,
          user_id: userId,
          moderator_id: 'dashboard',
          reason: reasonText
        });
        if (error) throw error;
        await supabase.from('moderation_logs').insert({
          guild_id: req.params.id,
          user_id: userId,
          action: 'Warned',
          reason: reasonText,
          moderator_id: 'dashboard'
        });
        return res.json({ success: true });
      }

      if (action === 'clear_warnings') {
        if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
        const { error: deleteError } = await supabase.from('user_warnings').delete().eq('guild_id', req.params.id).eq('user_id', userId);
        if (deleteError) {
          console.error("[Clear Warnings] Delete error:", deleteError);
          return res.status(500).json({ error: "Failed to clear warnings: " + deleteError.message });
        }
        await supabase.from('moderation_logs').insert({
          guild_id: req.params.id,
          user_id: userId,
          action: 'Clear Warnings',
          reason: reason || "Cleared from dashboard",
          moderator_id: 'dashboard'
        });
        return res.json({ success: true });
      }

      if (action === 'purge') {
        const ch = guild.channels.cache.get(channelId || "") as any;
        if (!ch || !ch.isTextBased()) return res.status(400).json({ error: "Valid text channel required" });
        const deleted = await ch.bulkDelete(Math.min(100, Math.max(1, Number(amount || 1))), true);
        return res.json({ success: true, deleted: deleted?.size || 0 });
      }

      if (action === 'lock' || action === 'unlock' || action === 'slowmode') {
        const ch = guild.channels.cache.get(channelId || "") as any;
        if (!ch || !ch.isTextBased()) return res.status(400).json({ error: "Valid text channel required" });
        if (action === 'lock') await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        if (action === 'unlock') await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
        if (action === 'slowmode') await ch.setRateLimitPerUser(Math.max(0, Math.min(21600, Number(seconds || 0))));
        return res.json({ success: true });
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return res.status(404).json({ error: "Member not found" });
      const reasonText = reason || "No reason provided";

      if (action === 'ban') {
        if (!member.bannable) return res.status(400).json({ error: "Member is not bannable" });
        await member.ban({ reason: reasonText });
      } else if (action === 'kick') {
        if (!member.kickable) return res.status(400).json({ error: "Member is not kickable" });
        await member.kick(reasonText);
      } else if (action === 'timeout') {
        if (!member.moderatable) return res.status(400).json({ error: "Member is not moderatable" });
        await member.timeout(Math.max(1, Number(minutes || 10)) * 60 * 1000, reasonText);
      } else if (action === 'untimeout') {
        if (!member.moderatable) return res.status(400).json({ error: "Member is not moderatable" });
        await member.timeout(null, reasonText);
      } else {
        return res.status(400).json({ error: "Unknown action" });
      }

      if (supabase) {
        await supabase.from('moderation_logs').insert({
          guild_id: req.params.id,
          user_id: userId,
          action: action === 'untimeout' ? 'Untimeout' : action.charAt(0).toUpperCase() + action.slice(1),
          reason: reasonText,
          moderator_id: 'dashboard'
        });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Action failed" });
    }
  });

  app.post("/api/guilds/:id/moderation-appeals/:appealId/status", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const { status } = req.body || {};
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    try {
      const { error } = await supabase
        .from('moderation_appeals')
        .update({ status })
        .eq('id', req.params.appealId)
        .eq('guild_id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update appeal status" });
    }
  });

  // --- Leveling Rewards & Roles ---
  app.get("/api/guilds/:id/roles", (req, res) => {
    const guildId = req.params.id;
    if (bot.isReady()) {
      const guild = bot.guilds.cache.get(guildId);
      if (guild) {
        const roles = guild.roles.cache
          .filter(r => r.name !== '@everyone' && !r.managed)
          .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));
        return res.json(roles);
      }
    }
    res.json([]);
  });

  app.get("/api/guilds/:id/rewards", async (req, res) => {
    if (!supabase) return res.json([]);
    try {
      const { data, error } = await supabase
        .from('level_rewards')
        .select('*')
        .eq('guild_id', req.params.id)
        .order('level', { ascending: true });

      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      console.error("Failed to fetch rewards:", err);
      res.status(500).json({ error: "Failed to fetch rewards" });
    }
  });

  app.post("/api/guilds/:id/rewards", async (req, res) => {
    const { level, role_id } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { error } = await supabase.from('level_rewards').upsert({
        guild_id: req.params.id,
        level: parseInt(level),
        role_id
      }, { onConflict: 'guild_id,level' });

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to add reward:", err);
      res.status(500).json({ error: "Failed to add reward" });
    }
  });

  app.delete("/api/guilds/:id/rewards/:rewardId", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { error } = await supabase
        .from('level_rewards')
        .delete()
        .eq('id', req.params.rewardId);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete reward:", err);
      res.status(500).json({ error: "Failed to delete reward" });
    }
  });

  app.post("/api/guilds/:id/levels/settings", async (req, res) => {
    const {
      xp_rate,
      level_up_message,
      level_up_channel,
      level_up_background_url,
      level_up_text_color,
      level_up_accent_color
    } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { data: current } = await supabase.from('guilds').select('active_modules').eq('id', req.params.id).single();
      const modules = normalizeActiveModules(current?.active_modules);

      modules.canvas = {
        ...(modules.canvas || {}),
        level_up_background_url,
        level_up_text_color,
        level_up_accent_color
      };

      const { error } = await supabase.from('guilds').update({
        xp_rate: xp_rate ? parseFloat(xp_rate) : 1.0,
        level_up_message,
        level_up_channel,
        active_modules: modules
      }).eq('id', req.params.id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to update level settings:", err);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.post("/api/guilds/:id/welcome/settings", async (req, res) => {
    const {
      welcome_enabled, welcome_message, welcome_channel,
      farewell_enabled, farewell_message, farewell_channel,
      canvas // New: receiving the entire canvas object
    } = req.body;

    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { data: current } = await supabase.from('guilds').select('active_modules').eq('id', req.params.id).single();
      const modules = normalizeActiveModules(current?.active_modules);

      modules.canvas = {
        ...(modules.canvas || {}),
        ...(canvas || {}) // Merge all canvas styling fields
      };

      const { error } = await supabase.from('guilds').update({
        welcome_enabled,
        welcome_message,
        welcome_channel,
        farewell_enabled,
        farewell_message,
        farewell_channel,
        active_modules: modules
      }).eq('id', req.params.id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to update welcome settings:", err);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // --- Role Panel Endpoints ---
  const getButtonStyle = (style: string): ButtonStyle => {
    switch (style.toLowerCase()) {
      case 'primary': return ButtonStyle.Primary;
      case 'secondary': return ButtonStyle.Secondary;
      case 'success': return ButtonStyle.Success;
      case 'danger': return ButtonStyle.Danger;
      default: return ButtonStyle.Primary;
    }
  };

  app.get("/api/guilds/:id/role-panels", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { data, error } = await supabase
        .from('role_panels')
        .select('*, role_panel_buttons(*)')
        .eq('guild_id', req.params.id);
      if (error) throw error;
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch role panels" });
    }
  });

  app.post("/api/guilds/:id/role-panels", async (req, res) => {
    const { title, description, color, channel_id, author_name, author_icon, image_url, buttons } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      // 1. Create Panel
      const { data: panel, error: pError } = await supabase
        .from('role_panels')
        .insert({ guild_id: req.params.id, title, description, color, channel_id, author_name, author_icon_url: author_icon, image_url })
        .select()
        .single();
      if (pError) throw pError;

      // 2. Create Buttons
      if (buttons && buttons.length > 0) {
        const buttonsToInsert = buttons.map((b: any) => ({
          panel_id: panel.id,
          role_id: b.role_id,
          label: b.label,
          emoji: b.emoji,
          style: b.style
        }));
        const { error: bError } = await supabase.from('role_panel_buttons').insert(buttonsToInsert);
        if (bError) throw bError;
      }

      res.json(panel);
    } catch (err) {
      res.status(500).json({ error: "Failed to create role panel" });
    }
  });

  app.delete("/api/guilds/:id/role-panels/:panelId", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { error } = await supabase.from('role_panels').delete().eq('id', req.params.panelId);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete panel" });
    }
  });

  app.post("/api/guilds/:id/role-panels/:panelId/deploy", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { data: panel, error } = await supabase
        .from('role_panels')
        .select('*, role_panel_buttons(*)')
        .eq('id', req.params.panelId)
        .single();
      if (error || !panel) throw new Error("Panel not found");

      const guild = bot.guilds.cache.get(req.params.id);
      const channel = guild?.channels.cache.get(panel.channel_id);
      if (!channel?.isTextBased()) throw new Error("Invalid channel or bot missing permissions");

      const embed = new EmbedBuilder()
        .setTitle(panel.title)
        .setDescription(panel.description || null)
        .setColor(panel.color as any || '#d0bcff');

      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      let currentRow = new ActionRowBuilder<ButtonBuilder>();

      panel.role_panel_buttons.forEach((b: any, index: number) => {
        if (index > 0 && index % 5 === 0) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder<ButtonBuilder>();
        }

        const btn = new ButtonBuilder()
          .setCustomId(`role_btn_${b.id}`)
          .setLabel(b.label)
          .setStyle(getButtonStyle(b.style));

        if (b.emoji) {
          try {
            btn.setEmoji(b.emoji);
          } catch (e) {
            console.error("Invalid emoji:", b.emoji);
          }
        }

        currentRow.addComponents(btn);
      });

      if (currentRow.components.length > 0) {
        rows.push(currentRow);
      }

      const message = await (channel as any).send({ embeds: [embed], components: rows });

      await supabase.from('role_panels').update({ message_id: message.id }).eq('id', panel.id);

      res.json({ success: true, messageId: message.id });
    } catch (err: any) {
      console.error("Deployment error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/guilds/:id/logging/settings", async (req, res) => {
    const { enabled, channel_id, log_messages, log_members, log_voice, log_server } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { error } = await supabase
        .from('guilds')
        .update({
          logging_enabled: enabled,
          logging_channel_id: channel_id,
          log_messages,
          log_members,
          log_voice,
          log_server
        })
        .eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update logging settings" });
    }
  });

  // --- Shop Endpoints ---
  app.get("/api/guilds/:id/shop", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { data, error } = await supabase
        .from('shop_items')
        .select('*')
        .eq('guild_id', req.params.id);
      if (error) throw error;
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch shop items" });
    }
  });

  app.post("/api/guilds/:id/shop", async (req, res) => {
    const { name, description, price, role_id, icon, stock } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { data, error } = await supabase
        .from('shop_items')
        .insert({ guild_id: req.params.id, name, description, price, role_id, icon, stock })
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Failed to create shop item" });
    }
  });

  app.delete("/api/guilds/:id/shop/:itemId", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { error } = await supabase.from('shop_items').delete().eq('id', req.params.itemId);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  app.post("/api/guilds/:id/shop/:itemId/buy", async (req, res) => {
    const { userId } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      // 1. Get Item
      const { data: item, error: iError } = await supabase
        .from('shop_items')
        .select('*')
        .eq('id', req.params.itemId)
        .single();
      if (iError || !item) throw new Error("Item not found");

      // 2. Check Stock
      if (item.stock !== -1 && item.stock <= 0) throw new Error("Item out of stock");

      // 3. Get User Balance (XP)
      const { data: levelUser, error: lError } = await supabase
        .from('levels')
        .select('xp')
        .eq('guild_id', req.params.id)
        .eq('user_id', userId)
        .single();

      const currentXp = levelUser?.xp || 0;
      if (currentXp < item.price) throw new Error(`Insufficient XP! You need ${item.price} XP.`);

      // 4. Deduct XP
      const { error: uError } = await supabase
        .from('levels')
        .update({ xp: currentXp - item.price })
        .eq('guild_id', req.params.id)
        .eq('user_id', userId);
      if (uError) throw uError;

      // 5. Update Stock
      if (item.stock !== -1) {
        await supabase.from('shop_items').update({ stock: item.stock - 1 }).eq('id', item.id);
      }

      // 6. Record in Inventory
      await supabase.from('user_inventory').insert({ guild_id: req.params.id, user_id: userId, item_id: item.id });

      // 7. Give Role if applicable
      if (item.role_id) {
        const guild = bot.guilds.cache.get(req.params.id);
        const member = await guild?.members.fetch(userId);
        const role = guild?.roles.cache.get(item.role_id);
        if (member && role) await member.roles.add(role);
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/guilds/:id/ai/settings", async (req, res) => {
    const { enabled, channel_id, knowledge_base } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { error } = await supabase
        .from('guilds')
        .update({
          ai_enabled: enabled,
          ai_channel_id: channel_id,
          ai_knowledge_base: knowledge_base
        })
        .eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update AI settings" });
    }
  });

  // Ticket Endpoints
  app.post("/api/guilds/:id/tickets/deploy", async (req, res) => {
    if (!(await requireEntitlement(req, res, "ticket_intelligence"))) return;
    const { channelId } = req.body;
    if (bot.isReady()) {
      const guild = bot.guilds.cache.get(req.params.id);
      const channel = guild?.channels.cache.get(channelId) as any;
      if (channel && channel.isTextBased()) {
        try {
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = await import('discord.js');
          const embed = new EmbedBuilder()
            .setTitle("🎫 Support Tickets")
            .setDescription("Need help? Click the button below to open a private ticket with our moderation team.")
            .setColor("#8B5CF6");

          const row = new ActionRowBuilder<any>().addComponents(
            new ButtonBuilder()
              .setCustomId('create_ticket')
              .setLabel('Open Ticket')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🎫')
          );

          await channel.send({ embeds: [embed], components: [row] });
          return res.json({ success: true });
        } catch (err) {
          console.error("Failed to post ticket embed:", err);
        }
      }
    }
    res.status(500).json({ error: "Failed to deploy interface" });
  });

  app.get("/api/guilds/:id/tickets", async (req, res) => {
    if (!(await requireEntitlement(req, res, "ticket_intelligence"))) return;
    if (!supabase) return res.json([]);
    const { data } = await supabase.from('tickets').select('*').eq('guild_id', req.params.id).order('created_at', { ascending: false });

    // Resolve usernames
    const resolved = await Promise.all((data || []).map(async t => {
      let username = `User_${t.user_id.slice(-4)}`;
      if (bot.isReady()) {
        try {
          const user = await bot.users.fetch(t.user_id);
          if (user) username = user.username;
        } catch (e) { }
      }
      return { ...t, username };
    }));

    res.json(resolved);
  });

  app.post("/api/guilds/:id/tickets/:threadId/reply", async (req, res) => {
    if (!(await requireEntitlement(req, res, "ticket_intelligence"))) return;
    const { message } = req.body;
    if (bot.isReady()) {
      try {
        const guild = bot.guilds.cache.get(req.params.id);
        const channel = guild?.channels.cache.get(req.params.threadId) as any;
        if (channel && channel.isTextBased && channel.isTextBased()) {
          await channel.send(`**[Mod Support]**: ${message}`);
          return res.json({ success: true });
        }
      } catch (err) {
        console.error("Failed to post Mod reply:", err);
      }
    }
    res.status(500).json({ error: "Failed to send reply" });
  });

  app.get("/api/guilds/:id/tickets/:threadId/messages", async (req, res) => {
    if (!(await requireEntitlement(req, res, "ticket_intelligence"))) return;
    if (!supabase) return res.json([]);
    try {
      // Find the internal ticket ID first
      const { data: ticket } = await supabase
        .from('tickets')
        .select('id')
        .eq('channel_thread_id', req.params.threadId)
        .single();

      if (!ticket) return res.json([]);

      const { data: messages } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });

      res.json(messages || []);
    } catch (err) {
      console.error("Failed to fetch ticket messages:", err);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/guilds/:id/tickets/:ticketId/close", async (req, res) => {
    if (!(await requireEntitlement(req, res, "ticket_intelligence"))) return;
    if (supabase) {
      try {
        // Fetch ticket info to get channel ID
        const { data: ticket } = await supabase
          .from('tickets')
          .select('channel_thread_id')
          .eq('id', req.params.ticketId)
          .single();

        if (ticket?.channel_thread_id && bot.isReady()) {
          const guild = bot.guilds.cache.get(req.params.id);
          const channel = guild?.channels.cache.get(ticket.channel_thread_id);
          if (channel) {
            await channel.delete('Ticket closed via dashboard').catch(err => console.error("Failed to delete channel:", err));
          }
        }

        await supabase.from('tickets').update({ status: 'closed' }).eq('id', req.params.ticketId);
        res.json({ success: true });
      } catch (err) {
        console.error("Error closing ticket:", err);
        res.status(500).json({ error: "Failed to close ticket" });
      }
    } else {
      res.status(500).json({ error: "Supabase not initialized" });
    }
  });

  // --- Premium Security Features API ---

  // Get security settings
  app.get("/api/guilds/:id/security/advanced", async (req, res) => {
    try {
      const settings = await getSecuritySettings(req.params.id);
      res.json(settings);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch security settings" });
    }
  });

  // Update security settings
  app.post("/api/guilds/:id/security/advanced", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      console.log(`[Security] Updating settings for guild ${req.params.id}:`, req.body);
      const success = await updateSecuritySettings(req.params.id, req.body);
      if (success) {
        res.json({ success: true });
      } else {
        console.error(`[Security] updateSecuritySettings returned false for guild ${req.params.id}`);
        res.status(500).json({ error: "Failed to update settings - check server logs" });
      }
    } catch (err: any) {
      console.error(`[Security] Error updating settings for guild ${req.params.id}:`, err);
      res.status(500).json({ error: err.message || "Failed to update security settings" });
    }
  });

  // Check link reputation (for testing)
  app.post("/api/guilds/:id/security/check-link", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });
    try {
      const result = await checkLinkReputation(url);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to check link" });
    }
  });

  // Analyze message for spam (for testing)
  app.post("/api/guilds/:id/security/analyze-message", async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "Content required" });
    try {
      const result = analyzeMessageWithML(content);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to analyze message" });
    }
  });

  // Get raid status
  app.get("/api/guilds/:id/security/raid-status", async (req, res) => {
    try {
      const isLocked = isLockdownActive(req.params.id);
      res.json({ lockdownActive: isLocked });
    } catch (err) {
      res.status(500).json({ error: "Failed to get raid status" });
    }
  });

  // Toggle lockdown manually
  app.post("/api/guilds/:id/security/lockdown", async (req, res) => {
    const { active } = req.body;
    if (!bot.isReady()) return res.status(503).json({ error: "Bot not ready" });

    try {
      const guild = bot.guilds.cache.get(req.params.id);
      if (!guild) return res.status(404).json({ error: "Guild not found" });

      setLockdownState(req.params.id, active);

      // Lock/unlock all text channels
      const textChannels = guild.channels.cache.filter(c => c.isTextBased());
      for (const [, channel] of textChannels) {
        try {
          const everyone = guild.roles.everyone;
          if (active) {
            await (channel as any).permissionOverwrites.edit(everyone, { SendMessages: false });
          } else {
            await (channel as any).permissionOverwrites.edit(everyone, { SendMessages: null });
          }
        } catch (e) {
          console.error(`Failed to ${active ? 'lock' : 'unlock'} channel:`, e);
        }
      }

      res.json({ success: true, lockdownActive: active });
    } catch (err) {
      res.status(500).json({ error: "Failed to toggle lockdown" });
    }
  });

  // Get quarantined users
  app.get("/api/guilds/:id/security/quarantine", async (req, res) => {
    // This would need to return from database in production
    res.json([]);
  });

  // Release user from quarantine
  app.post("/api/guilds/:id/security/quarantine/:userId/release", async (req, res) => {
    try {
      const pendingMessages = releaseQuarantine(req.params.userId);
      res.json({ success: true, pendingMessages });
    } catch (err) {
      res.status(500).json({ error: "Failed to release quarantine" });
    }
  });

  // Get honeytrap channels
  app.get("/api/guilds/:id/security/honeytraps", async (req, res) => {
    const settings = await getSecuritySettings(req.params.id);
    res.json({
      enabled: settings.honeytrap_enabled,
      channelIds: settings.honeytrap_channel_ids
    });
  });

  // Set honeytrap channels
  app.post("/api/guilds/:id/security/honeytraps", async (req, res) => {
    const { enabled, channelIds } = req.body;
    try {
      const success = await updateSecuritySettings(req.params.id, {
        honeytrap_enabled: enabled,
        honeytrap_channel_ids: channelIds
      });
      res.json({ success });
    } catch (err) {
      res.status(500).json({ error: "Failed to update honeytraps" });
    }
  });


  // --- Economy & Store API ---
  app.get("/api/guilds/:id/economy/balance/:userId", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Supabase not initialized' });
    try {
      const { data, error } = await supabase
        .from('economy_profiles')
        .select('*')
        .eq('guild_id', req.params.id)
        .eq('user_id', req.params.userId)
        .maybeSingle();

      if (error) throw error;
      res.json(data || { balance: 0, bank: 0 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/guilds/:id/store", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Supabase not initialized' });
    const { data, error } = await supabase.from('shop_items').select('*').eq('guild_id', req.params.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  app.post("/api/guilds/:id/store", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Supabase not initialized' });
    const { name, description, price, role_id, icon, stock } = req.body;
    const { data, error } = await supabase.from('shop_items').insert({
      guild_id: req.params.id, name, description, price: price || 100, role_id, icon, stock: stock ?? -1
    }).select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/guilds/:id/store/:itemId", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Supabase not initialized' });
    const { error } = await supabase.from('shop_items').delete().eq('id', req.params.itemId).eq('guild_id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.post("/api/guilds/:id/store/:itemId/purchase", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Supabase not initialized' });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    try {
      // Get item
      const { data: item, error: itemErr } = await supabase.from('shop_items').select('*').eq('id', req.params.itemId).single();
      if (itemErr || !item) return res.status(404).json({ error: 'Item not found' });

      // Check stock
      if (item.stock === 0) return res.status(400).json({ error: 'Out of stock' });

      // Check user balance from economy_profiles table
      const { data: profile } = await supabase
        .from('economy_profiles')
        .select('*')
        .eq('guild_id', req.params.id)
        .eq('user_id', userId)
        .maybeSingle();

      const userBalance = profile?.balance || 0;
      if (userBalance < item.price) return res.status(400).json({ error: 'Insufficient funds in wallet' });

      // Deduct balance
      const { error: deductErr } = await supabase
        .from('economy_profiles')
        .update({ balance: userBalance - item.price })
        .eq('guild_id', req.params.id)
        .eq('user_id', userId);

      if (deductErr) throw deductErr;

      // Reduce stock
      if (item.stock > 0) await supabase.from('shop_items').update({ stock: item.stock - 1 }).eq('id', req.params.itemId);

      // Add to inventory
      await supabase.from('user_inventory').insert({ guild_id: req.params.id, user_id: userId, item_id: req.params.itemId });

      // Give role if set
      if (item.role_id) {
        const guild = bot.guilds.cache.get(req.params.id);
        const member = guild?.members.cache.get(userId) || await guild?.members.fetch(userId).catch(() => null);
        if (member) await member.roles.add(item.role_id).catch(() => { });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Activity Log API ---
  app.get("/api/guilds/:id/activity-logs", async (req, res) => {
    const guildId = req.params.id;
    if (!supabase) return res.json([]);
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  // --- Plugin/Module System API ---
  app.get("/api/guilds/:id/plugins", async (req, res) => {
    const guildId = req.params.id;
    if (!supabase) return res.json(DEFAULT_ACTIVE_MODULES);
    try {
      const { data, error } = await supabase
        .from('guilds')
        .select('active_modules')
        .eq('id', guildId)
        .single();
      if (error) throw error;
      res.json(normalizeActiveModules(data?.active_modules));
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch plugins" });
    }
  });

  app.post("/api/guilds/:id/plugins/toggle", async (req, res) => {
    const guildId = req.params.id;
    const { pluginId, enabled } = req.body;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    try {
      const { data: current } = await supabase.from('guilds').select('active_modules').eq('id', guildId).single();
      const modules = normalizeActiveModules(current?.active_modules);
      if (pluginId === 'gambling') {
        return res.status(400).json({ error: "Plugin 'gambling' no longer exists." });
      }
      modules[pluginId] = enabled;

      const { error } = await supabase
        .from('guilds')
        .update({ active_modules: modules })
        .eq('id', guildId);
      if (error) throw error;
      res.json({ success: true, modules });
    } catch (err) {
      res.status(500).json({ error: "Failed to toggle plugin" });
    }
  });

  // --- Public API & Webhooks ---
  app.get("/api/guilds/:id/public/stats", async (req, res) => {
    const guildId = req.params.id;
    if (!bot.isReady()) return res.status(503).json({ error: "Bot not ready" });
    const guild = bot.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    res.json({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      icon: guild.iconURL(),
      description: guild.description
    });
  });

  // --- Premium MVP APIs ---
  app.get("/api/guilds/:id/moderation/risk-events", async (req, res) => {
    if (!(await requireEntitlement(req, res, "ai_moderation"))) return;
    if (!supabase) return res.json([]);
    const limit = Math.min(200, Math.max(10, Number(req.query.limit || 50)));
    const { data, error } = await supabase
      .from("event_logs")
      .select("*")
      .eq("guild_id", req.params.id)
      .in("event_type", ["ml_spam_flag", "raid_prediction", "honeytrap_trigger", "policy_denied"])
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  app.get("/api/guilds/:id/incidents", async (req, res) => {
    if (!(await requireEntitlement(req, res, "ai_moderation"))) return;
    if (!supabase) return res.json([]);
    const { data, error } = await supabase
      .from("incidents")
      .select("*, incident_actions(*)")
      .eq("guild_id", req.params.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  app.post("/api/guilds/:id/incidents", async (req, res) => {
    if (!(await requireEntitlement(req, res, "ai_moderation"))) return;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const { title, severity = "medium", confidence = 0, playbook = "none", summary = "" } = req.body || {};
    if (!title) return res.status(400).json({ error: "title is required" });
    const { data, error } = await supabase
      .from("incidents")
      .insert({
        guild_id: req.params.id,
        title,
        severity,
        confidence,
        playbook,
        summary,
        status: "open"
      })
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    await logPlatformEvent(req.params.id, "incident_created", "warning", { incidentId: data.id, title }, "system");
    res.json(data);
  });

  app.post("/api/guilds/:id/incidents/:incidentId/actions", async (req, res) => {
    if (!(await requireEntitlement(req, res, "ai_moderation"))) return;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const { action_type, payload = {}, actor_id = "dashboard" } = req.body || {};
    if (!action_type) return res.status(400).json({ error: "action_type is required" });
    const guildId = req.params.id;
    const incidentId = req.params.incidentId;

    if (action_type === "close_incident") {
      await supabase.from("incidents").update({ status: "resolved", updated_at: new Date().toISOString() }).eq("id", incidentId).eq("guild_id", guildId);
    }
    if (action_type === "lockdown_channels" && bot.isReady()) {
      const guild = bot.guilds.cache.get(guildId);
      if (guild) {
        for (const [, ch] of guild.channels.cache.filter((c: any) => c.isTextBased() && !c.isThread())) {
          await (ch as any).permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => { });
        }
        setLockdownState(guildId, true);
      }
    }

    const { data, error } = await supabase
      .from("incident_actions")
      .insert({
        incident_id: incidentId,
        guild_id: guildId,
        action_type,
        actor_id,
        payload
      })
      .select("*")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    await logPlatformEvent(guildId, "incident_action", "warning", { incidentId, actionType: action_type, payload }, "dashboard");
    res.json({ success: true, action: data });
  });

  app.get("/api/guilds/:id/tickets/sla", async (req, res) => {
    if (!(await requireEntitlement(req, res, "ticket_intelligence"))) return;
    if (!supabase) return res.json([]);
    const { data, error } = await supabase
      .from("ticket_sla")
      .select("*, ticket_summaries(*), tickets(status, user_id, created_at)")
      .eq("guild_id", req.params.id)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  app.post("/api/guilds/:id/tickets/sla", async (req, res) => {
    if (!(await requireEntitlement(req, res, "ticket_intelligence"))) return;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const { ticket_id, priority = "normal", first_response_hours = 2, resolution_hours = 24 } = req.body || {};
    if (!ticket_id) return res.status(400).json({ error: "ticket_id is required" });
    const payload = {
      ticket_id,
      guild_id: req.params.id,
      priority,
      first_response_due_at: hoursFromNow(Number(first_response_hours || 2)),
      resolution_due_at: hoursFromNow(Number(resolution_hours || 24)),
      breached: false,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from("ticket_sla").upsert(payload, { onConflict: "ticket_id" }).select("*").single();
    if (error) return res.status(500).json({ error: error.message });
    await logPlatformEvent(req.params.id, "ticket_sla_set", "info", { ticketId: ticket_id, priority }, "dashboard");
    res.json(data);
  });

  app.post("/api/guilds/:id/tickets/:ticketId/summary", async (req, res) => {
    if (!(await requireEntitlement(req, res, "ticket_intelligence"))) return;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const guildId = req.params.id;
    const ticketId = req.params.ticketId;

    const { data: messages } = await supabase
      .from("ticket_messages")
      .select("message,is_mod,created_at,sender_name")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .limit(100);

    const allText = (messages || []).map(m => m.message || "").join("\n");
    const urgency = Math.min(100, Math.max(0, (allText.match(/urgent|asap|immediately|now|broken/gi) || []).length * 20));
    const sentiment = /angry|upset|frustrated|terrible|bad/gi.test(allText) ? "negative" : "neutral";
    const summary = allText.slice(0, 700) || "No ticket messages yet.";
    const suggestedReply = urgency >= 60
      ? "Thanks for flagging this. We are escalating your issue now and will update you shortly."
      : "Thanks for the details. We are reviewing this and will follow up with next steps.";

    const { data, error } = await supabase
      .from("ticket_summaries")
      .upsert({
        ticket_id: ticketId,
        guild_id: guildId,
        summary,
        sentiment,
        urgency,
        suggested_reply: suggestedReply,
        updated_at: new Date().toISOString()
      }, { onConflict: "ticket_id" })
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/guilds/:id/snapshots", async (req, res) => {
    if (!(await requireEntitlement(req, res, "backup_restore"))) return;
    const idempotencyKey = String(req.headers["x-idempotency-key"] || "");
    if (idempotencyKey && processedIdempotencyKeys.has(`snapshot:${idempotencyKey}`)) {
      return res.status(202).json({ success: true, duplicate: true });
    }
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    if (!bot.isReady()) return res.status(503).json({ error: "Bot not ready" });
    const payload = await buildGuildSnapshotPayload(req.params.id);
    if (!payload) return res.status(404).json({ error: "Guild not found" });

    const { data, error } = await supabase
      .from("server_snapshots")
      .insert({
        guild_id: req.params.id,
        snapshot_type: req.body?.snapshot_type || "manual",
        created_by: req.body?.created_by || "dashboard",
        payload
      })
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    if (idempotencyKey) processedIdempotencyKeys.set(`snapshot:${idempotencyKey}`, Date.now());
    await logPlatformEvent(req.params.id, "snapshot_created", "info", { snapshotId: data.id }, "dashboard");
    res.json(data);
  });

  app.get("/api/guilds/:id/snapshots/:snapshotId/restore/preview", async (req, res) => {
    if (!(await requireEntitlement(req, res, "backup_restore"))) return;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const { data: snap } = await supabase
      .from("server_snapshots")
      .select("id,payload,created_at,snapshot_type")
      .eq("id", req.params.snapshotId)
      .maybeSingle();
    if (!snap) return res.status(404).json({ error: "Snapshot not found" });
    const plan = computeRestorePlan(snap.payload);
    res.json({
      snapshot: {
        id: snap.id,
        created_at: snap.created_at,
        snapshot_type: snap.snapshot_type
      },
      plan,
      warning: "Full restore can change roles, channels, overwrites, and guild-level settings."
    });
  });

  app.get("/api/guilds/:id/snapshots", async (req, res) => {
    if (!(await requireEntitlement(req, res, "backup_restore"))) return;
    if (!supabase) return res.json([]);
    const { data, error } = await supabase
      .from("server_snapshots")
      .select("id,guild_id,snapshot_type,created_by,created_at")
      .eq("guild_id", req.params.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  app.get("/api/guilds/:id/snapshots/diff", async (req, res) => {
    if (!(await requireEntitlement(req, res, "backup_restore"))) return;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const fromId = String(req.query.from || "");
    const toId = String(req.query.to || "");
    if (!fromId || !toId) return res.status(400).json({ error: "from and to are required" });
    const [{ data: fromSnap }, { data: toSnap }] = await Promise.all([
      supabase.from("server_snapshots").select("id,payload").eq("id", fromId).maybeSingle(),
      supabase.from("server_snapshots").select("id,payload").eq("id", toId).maybeSingle()
    ]);
    if (!fromSnap || !toSnap) return res.status(404).json({ error: "Snapshot not found" });

    const fromChannels = new Set((fromSnap.payload?.channels || []).map((c: any) => c.id));
    const toChannels = new Set((toSnap.payload?.channels || []).map((c: any) => c.id));
    const diff = {
      channels_added: [...toChannels].filter(id => !fromChannels.has(id)),
      channels_removed: [...fromChannels].filter(id => !toChannels.has(id)),
      roles_from: (fromSnap.payload?.roles || []).length,
      roles_to: (toSnap.payload?.roles || []).length,
      emojis_from: (fromSnap.payload?.emojis || []).length,
      emojis_to: (toSnap.payload?.emojis || []).length,
      stickers_from: (fromSnap.payload?.stickers || []).length,
      stickers_to: (toSnap.payload?.stickers || []).length
    };
    const { data: saved } = await supabase
      .from("snapshot_diffs")
      .insert({
        guild_id: req.params.id,
        from_snapshot_id: fromId,
        to_snapshot_id: toId,
        diff
      })
      .select("*")
      .single();
    res.json({ diff, saved });
  });

  app.post("/api/guilds/:id/snapshots/:snapshotId/restore", async (req, res) => {
    if (!(await requireEntitlement(req, res, "backup_restore"))) return;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const {
      dry_run = true,
      restore_config_only = true,
      apply_roles = true,
      apply_channels = true,
      apply_overwrites = true,
      apply_guild_settings = true,
      apply_config = true
    } = req.body || {};
    const { data: snap } = await supabase
      .from("server_snapshots")
      .select("payload")
      .eq("id", req.params.snapshotId)
      .maybeSingle();
    if (!snap) return res.status(404).json({ error: "Snapshot not found" });

    const actions: string[] = [];
    if (restore_config_only) {
      actions.push("config_restore");
      if (!dry_run && apply_config) {
        const cfg = snap.payload?.config || {};
        await supabase.from("guilds").update({
          prefix: cfg.prefix || "!",
          active_modules: normalizeActiveModules(cfg.active_modules || {})
        }).eq("id", req.params.id);
      }
    } else {
      actions.push("full_restore_requested");
      const guild = bot.guilds.cache.get(req.params.id);
      if (!guild) return res.status(404).json({ error: "Guild not found in bot cache" });

      const roleMap = new Map<string, string>();
      const targetRoles = (snap.payload?.roles || []) as any[];
      actions.push(`roles_in_snapshot:${targetRoles.length}`);
      if (apply_roles) {
        for (const role of targetRoles) {
          const existing = guild.roles.cache.find((r: any) => r.name === role.name);
          if (existing) {
            roleMap.set(role.id, existing.id);
            if (!dry_run) {
              await existing.edit({
                color: role.color || existing.hexColor,
                hoist: !!role.hoist,
                mentionable: !!role.mentionable,
                permissions: BigInt(role.permissions || "0")
              }).catch(() => { });
            }
          } else if (!dry_run) {
            const created = await guild.roles.create({
              name: role.name,
              color: role.color || "#99AAB5",
              hoist: !!role.hoist,
              mentionable: !!role.mentionable,
              permissions: BigInt(role.permissions || "0"),
              reason: "Snapshot restore"
            }).catch(() => null);
            if (created) roleMap.set(role.id, created.id);
          }
        }
      }

      const channelMap = new Map<string, string>();
      const categories = ((snap.payload?.channels || []) as any[]).filter(c => c.type === ChannelType.GuildCategory);
      const nonCategories = ((snap.payload?.channels || []) as any[]).filter(c => c.type !== ChannelType.GuildCategory);
      actions.push(`channels_in_snapshot:${(snap.payload?.channels || []).length}`);

      const upsertChannel = async (channelDef: any) => {
        const existing = guild.channels.cache.find((ch: any) => ch.name === channelDef.name && ch.type === channelDef.type);
        if (existing) {
          channelMap.set(channelDef.id, existing.id);
          if (!dry_run) {
            await (existing as any).edit({
              topic: channelDef.topic || undefined,
              nsfw: !!channelDef.nsfw,
              rateLimitPerUser: Number(channelDef.rateLimitPerUser || 0),
              bitrate: channelDef.bitrate || undefined,
              userLimit: channelDef.userLimit || undefined,
              rtcRegion: channelDef.rtcRegion || undefined
            }).catch(() => { });
          }
          return existing;
        }
        if (dry_run) return null;
        const created = await guild.channels.create({
          name: channelDef.name,
          type: channelDef.type,
          parent: channelDef.parentId ? channelMap.get(channelDef.parentId) || null : null,
          topic: channelDef.topic || undefined,
          nsfw: !!channelDef.nsfw,
          rateLimitPerUser: Number(channelDef.rateLimitPerUser || 0),
          bitrate: channelDef.bitrate || undefined,
          userLimit: channelDef.userLimit || undefined,
          rtcRegion: channelDef.rtcRegion || undefined,
          reason: "Snapshot restore"
        } as any).catch(() => null);
        if (created) channelMap.set(channelDef.id, created.id);
        return created;
      };

      if (apply_channels) {
        for (const cat of categories) await upsertChannel(cat);
        for (const ch of nonCategories) await upsertChannel(ch);
      }

      if (!dry_run && apply_channels && apply_overwrites) {
        for (const chDef of (snap.payload?.channels || []) as any[]) {
          const chId = channelMap.get(chDef.id);
          const target = chId ? guild.channels.cache.get(chId) : null;
          if (!target || !chDef.permissionOverwrites?.length) continue;
          const mapped = chDef.permissionOverwrites.map((ow: any) => ({
            id: roleMap.get(ow.id) || ow.id,
            type: ow.type === 0 || ow.type === "role" ? OverwriteType.Role : OverwriteType.Member,
            allow: BigInt(ow.allow || "0"),
            deny: BigInt(ow.deny || "0")
          }));
          await (target as any).permissionOverwrites.set(mapped, "Snapshot restore overwrites").catch(() => { });
        }
      }

      if (!dry_run && apply_guild_settings && snap.payload?.guildSettings) {
        const gs = snap.payload.guildSettings;
        await guild.edit({
          afkTimeout: gs.afkTimeout,
          afkChannel: gs.afkChannelId ? guild.channels.cache.get(gs.afkChannelId) as any : null,
          systemChannel: gs.systemChannelId ? guild.channels.cache.get(gs.systemChannelId) as any : null,
          rulesChannel: gs.rulesChannelId ? guild.channels.cache.get(gs.rulesChannelId) as any : null,
          publicUpdatesChannel: gs.publicUpdatesChannelId ? guild.channels.cache.get(gs.publicUpdatesChannelId) as any : null,
          verificationLevel: gs.verificationLevel,
          explicitContentFilter: gs.explicitContentFilter,
          defaultMessageNotifications: gs.defaultMessageNotifications
        }).catch(() => { });
      }
      if (!dry_run && apply_config && snap.payload?.config) {
        const cfg = snap.payload.config || {};
        await supabase.from("guilds").update({
          prefix: cfg.prefix || "!",
          active_modules: normalizeActiveModules(cfg.active_modules || {}),
          xp_rate: Number(cfg.xp_rate || 1)
        }).eq("id", req.params.id);
      }
    }
    await logPlatformEvent(req.params.id, "snapshot_restore", "warning", { snapshotId: req.params.snapshotId, dry_run, actions }, "dashboard");
    res.json({ success: true, dry_run, actions });
  });

  app.get("/api/guilds/:id/analytics/executive", async (req, res) => {
    if (!(await requireEntitlement(req, res, "executive_analytics"))) return;
    if (!supabase) return res.json({ kpis: {}, trends: {}, report: null });
    const guildId = req.params.id;
    const { data: history } = await supabase
      .from("historical_stats")
      .select("date,total_members,messages_24h,commands_used")
      .eq("guild_id", guildId)
      .order("date", { ascending: true })
      .limit(30);
    const { data: incidents } = await supabase
      .from("incidents")
      .select("status")
      .eq("guild_id", guildId);
    const { data: slas } = await supabase
      .from("ticket_sla")
      .select("breached")
      .eq("guild_id", guildId);

    const latest: any = history?.[history.length - 1] || {};
    const kpis = {
      members: latest.total_members || 0,
      messages24h: latest.messages_24h || 0,
      commands24h: latest.commands_used || 0,
      openIncidents: (incidents || []).filter((i: any) => i.status === "open").length,
      slaBreaches: (slas || []).filter((s: any) => !!s.breached).length
    };
    const trends = {
      growth7d: (history || []).slice(-7),
      engagement30d: history || []
    };
    const weekKey = new Date().toISOString().slice(0, 10);
    const { data: reportRow } = await supabase
      .from("weekly_reports")
      .select("report")
      .eq("guild_id", guildId)
      .eq("report_week", weekKey)
      .maybeSingle();
    res.json({ kpis, trends, report: reportRow?.report || null });
  });

  app.post("/api/guilds/:id/analytics/weekly-report", async (req, res) => {
    if (!(await requireEntitlement(req, res, "executive_analytics"))) return;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const guildId = req.params.id;
    const { data: history } = await supabase
      .from("historical_stats")
      .select("date,total_members,messages_24h,commands_used")
      .eq("guild_id", guildId)
      .order("date", { ascending: false })
      .limit(7);
    const report = {
      summary: "Weekly community performance snapshot.",
      membersChange: (history?.[0]?.total_members || 0) - (history?.[history.length - 1]?.total_members || 0),
      avgMessages: Math.round((history || []).reduce((acc: number, row: any) => acc + Number(row.messages_24h || 0), 0) / Math.max(1, (history || []).length)),
      generatedAt: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from("weekly_reports")
      .upsert({
        guild_id: guildId,
        report_week: new Date().toISOString().slice(0, 10),
        report
      }, { onConflict: "guild_id,report_week" })
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/billing/webhook", async (req, res) => {
    const event = req.body || {};
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
    if (webhookSecret) {
      const signature = String(req.headers["x-radiance-signature"] || "");
      const signingBase = `${event?.id || ""}:${event?.data?.object?.metadata?.guild_id || ""}:${event?.data?.object?.metadata?.plan || ""}:${event?.data?.object?.status || ""}`;
      const expected = crypto.createHmac("sha256", webhookSecret).update(signingBase).digest("hex");
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (!signature || sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
    }
    const webhookEventId = String(event?.id || "");
    if (webhookEventId && processedIdempotencyKeys.has(`billing:${webhookEventId}`)) {
      return res.json({ received: true, duplicate: true });
    }
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const guildId = event?.data?.object?.metadata?.guild_id;
    if (!guildId) return res.status(400).json({ error: "Missing metadata.guild_id" });

    const plan = event?.data?.object?.metadata?.plan || "business";
    const status = event?.data?.object?.status || "active";
    const features = plan === "enterprise"
      ? { ai_moderation: true, ticket_intelligence: true, backup_restore: true, executive_analytics: true, white_label: true }
      : plan === "business"
        ? { ai_moderation: true, ticket_intelligence: true, backup_restore: true, executive_analytics: true, white_label: false }
        : { ...DEFAULT_ENTITLEMENTS };

    await supabase.from("subscriptions").upsert({
      guild_id: guildId,
      stripe_subscription_id: event?.data?.object?.id || null,
      plan,
      status,
      current_period_end: event?.data?.object?.current_period_end
        ? new Date(Number(event.data.object.current_period_end) * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString()
    }, { onConflict: "stripe_subscription_id" });

    await supabase.from("billing_customers").upsert({
      guild_id: guildId,
      stripe_customer_id: event?.data?.object?.customer || null,
      plan,
      status,
      updated_at: new Date().toISOString()
    }, { onConflict: "guild_id" });

    await supabase.from("entitlements").upsert({
      guild_id: guildId,
      features,
      updated_at: new Date().toISOString()
    }, { onConflict: "guild_id" });
    if (webhookEventId) processedIdempotencyKeys.set(`billing:${webhookEventId}`, Date.now());
    await logPlatformEvent(guildId, "billing_webhook", "info", { plan, status }, "system");
    res.json({ received: true });
  });

  app.get("/api/billing/checkout-url/:id", async (req, res) => {
    const guildId = req.params.id;
    const requestedPlan = normalizePlan(String(req.query.plan || "business"));
    if (requestedPlan === "free") return res.status(400).json({ error: "Invalid checkout plan" });
    const checkoutUrl = buildCheckoutUrl(guildId, requestedPlan);
    if (!checkoutUrl) {
      return res.status(500).json({ error: "Checkout URL is not configured on the server." });
    }
    await logPlatformEvent(guildId, "billing_checkout_requested", "info", { plan: requestedPlan }, "dashboard");
    res.json({ url: checkoutUrl, plan: requestedPlan });
  });

  app.get("/api/billing/portal/:id", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const guildId = req.params.id;
    const portalBase = process.env.STRIPE_PORTAL_URL || "";
    if (!portalBase) return res.status(500).json({ error: "Billing portal URL is not configured on the server." });

    const { data: customer } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("guild_id", guildId)
      .maybeSingle();

    const url = new URL(portalBase);
    url.searchParams.set("guild_id", guildId);
    if (customer?.stripe_customer_id) {
      url.searchParams.set("customer", customer.stripe_customer_id);
    }
    await logPlatformEvent(guildId, "billing_portal_opened", "info", { hasCustomer: !!customer?.stripe_customer_id }, "dashboard");
    res.json({ url: url.toString() });
  });

  app.get("/api/billing/plans", async (req, res) => {
    const plans = [
      {
        id: "free",
        label: "Free",
        priceMonthly: 0,
        features: []
      },
      {
        id: "business",
        label: "Business",
        priceMonthly: Number(process.env.BILLING_BUSINESS_PRICE_MONTHLY || 29),
        features: ["ai_moderation", "ticket_intelligence", "backup_restore", "executive_analytics"]
      },
      {
        id: "enterprise",
        label: "Enterprise",
        priceMonthly: Number(process.env.BILLING_ENTERPRISE_PRICE_MONTHLY || 99),
        features: ["ai_moderation", "ticket_intelligence", "backup_restore", "executive_analytics", "white_label"]
      }
    ];
    res.json({ plans });
  });

  app.get("/api/billing/summary/:id", async (req, res) => {
    const guildId = req.params.id;
    const features = await getGuildEntitlements(guildId);
    const { data: sub } = supabase
      ? await supabase.from("subscriptions").select("plan,status,current_period_end,updated_at").eq("guild_id", guildId).order("updated_at", { ascending: false }).limit(1).maybeSingle()
      : { data: null as any };
    res.json({
      guild_id: guildId,
      subscription: sub || { plan: "free", status: "inactive", current_period_end: null },
      features
    });
  });

  app.post("/api/billing/simulate/:id", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Simulation endpoint is disabled in production." });
    }
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const guildId = req.params.id;
    const plan = normalizePlan(req.body?.plan || "free");
    const status = plan === "free" ? "inactive" : "active";
    const features = plan === "enterprise"
      ? { ai_moderation: true, ticket_intelligence: true, backup_restore: true, executive_analytics: true, white_label: true }
      : plan === "business"
        ? { ai_moderation: true, ticket_intelligence: true, backup_restore: true, executive_analytics: true, white_label: false }
        : { ...DEFAULT_ENTITLEMENTS };

    if (plan === "free") {
      await supabase.from("subscriptions").delete().eq("guild_id", guildId);
      await supabase.from("subscriptions").insert({
        guild_id: guildId,
        plan: "free",
        status: "inactive",
        current_period_end: null,
        stripe_subscription_id: null,
        updated_at: new Date().toISOString()
      });
    } else {
      await supabase.from("subscriptions").delete().eq("guild_id", guildId);
      await supabase.from("subscriptions").insert({
        guild_id: guildId,
        plan,
        status,
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        stripe_subscription_id: `sim_${guildId}_${plan}`,
        updated_at: new Date().toISOString()
      });
    }
    await supabase.from("entitlements").upsert({
      guild_id: guildId,
      features,
      updated_at: new Date().toISOString()
    }, { onConflict: "guild_id" });

     // If white-label is lost, reset bot branding in that guild
     if (!features.white_label && bot.isReady()) {
       const guild = bot.guilds.cache.get(guildId);
       if (guild) {
         console.log(`[Branding Reset] Plan downgraded for ${guildId}. Reverting bot nickname and avatar.`);
         await guild.members.me?.setNickname(null).catch(e => console.error("[Branding Reset] Nickname error:", e));
         // Reset avatar to default (null uses Discord's default avatar)
         await bot.user?.setAvatar(null).catch(e => console.error("[Branding Reset] Avatar error:", e));
       }
     }

    await logPlatformEvent(guildId, "billing_simulated", "info", { plan, status }, "dashboard");
    res.json({ success: true, plan, status, features });
  });

  app.get("/api/guilds/:id/onboarding-checklist", async (req, res) => {
    const guildId = req.params.id;
    if (!supabase) return res.json({ complete: false, checks: [] });
    const [{ data: cfg }, { data: ent }, { data: snapshots }, { data: dyn }, { data: sec }] = await Promise.all([
      supabase.from("guilds").select("prefix,active_modules,welcome_enabled,logging_enabled,dynamic_voice_enabled").eq("id", guildId).maybeSingle(),
      supabase.from("entitlements").select("features").eq("guild_id", guildId).maybeSingle(),
      supabase.from("server_snapshots").select("id", { count: "exact", head: true }).eq("guild_id", guildId),
      supabase.from("temporary_voice_channels").select("id", { count: "exact", head: true }).eq("guild_id", guildId),
      supabase.from("guild_security").select("predictive_raid_detection,auto_lockdown").eq("guild_id", guildId).maybeSingle()
    ]);
    const checks = [
      { id: "modules", label: "Core modules enabled", ok: !!cfg?.active_modules },
      { id: "security", label: "Advanced security configured", ok: !!sec?.predictive_raid_detection || !!sec?.auto_lockdown },
      { id: "backup", label: "Initial backup snapshot created", ok: (snapshots as any)?.count > 0 },
      { id: "branding", label: "Branding/profile reviewed", ok: !!ent?.features },
      { id: "voice", label: "Dynamic voice configured", ok: !!cfg?.dynamic_voice_enabled || ((dyn as any)?.count || 0) > 0 }
    ];
    res.json({ complete: checks.every(c => c.ok), checks });
  });

  app.get("/api/guilds/:id/backup-scheduler", async (req, res) => {
    if (!(await requireEntitlement(req, res, "backup_restore"))) return;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const { data } = await supabase.from("guilds").select("active_modules").eq("id", req.params.id).maybeSingle();
    const scheduler = { ...getDefaultBackupScheduler(), ...(data?.active_modules?.backup_scheduler || {}) };
    res.json(scheduler);
  });

  app.post("/api/guilds/:id/backup-scheduler", async (req, res) => {
    if (!(await requireEntitlement(req, res, "backup_restore"))) return;
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const patch = req.body || {};
    const { data: guildRow } = await supabase.from("guilds").select("active_modules").eq("id", req.params.id).maybeSingle();
    const modules = normalizeActiveModules(guildRow?.active_modules);
    const nextScheduler = {
      ...getDefaultBackupScheduler(),
      ...(modules.backup_scheduler || {}),
      ...patch
    };
    nextScheduler.hour = Math.max(0, Math.min(23, Number(nextScheduler.hour || 3)));
    nextScheduler.minute = Math.max(0, Math.min(59, Number(nextScheduler.minute || 15)));
    nextScheduler.retention = Math.max(5, Math.min(180, Number(nextScheduler.retention || 30)));
    nextScheduler.weekday = Math.max(0, Math.min(6, Number(nextScheduler.weekday ?? 1)));
    modules.backup_scheduler = nextScheduler;
    const { error } = await supabase.from("guilds").update({ active_modules: modules }).eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    await logPlatformEvent(req.params.id, "backup_scheduler_updated", "info", { scheduler: nextScheduler }, "dashboard");
    res.json({ success: true, scheduler: nextScheduler });
  });

  app.get("/api/guilds/:id/restore-audit", async (req, res) => {
    if (!(await requireEntitlement(req, res, "backup_restore"))) return;
    if (!supabase) return res.json([]);
    const { data, error } = await supabase
      .from("event_logs")
      .select("*")
      .eq("guild_id", req.params.id)
      .in("event_type", ["snapshot_created", "snapshot_restore", "snapshot_drift_warning"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  app.get("/api/guilds/:id/entitlements", async (req, res) => {
    const entitlements = await getGuildEntitlements(req.params.id);
    const { data: sub } = supabase
      ? await supabase.from("subscriptions").select("plan,status,current_period_end").eq("guild_id", req.params.id).order("updated_at", { ascending: false }).limit(1).maybeSingle()
      : { data: null };
    res.json({ features: entitlements, subscription: sub || { plan: "free", status: "inactive" } });
  });

  app.get("/api/guilds/:id/branding", async (req, res) => {
    if (!supabase) return res.json({ brand_name: "", logo_url: "", primary_color: "#8B5CF6", accent_color: "#d0bcff", theme: {} });

    // Check entitlement
    const entitlements = await getGuildEntitlements(req.params.id);
    if (!entitlements.white_label) {
      return res.json({ brand_name: "", logo_url: "", primary_color: "#8B5CF6", accent_color: "#d0bcff", theme: {} });
    }

    const { data } = await supabase.from("branding_profiles").select("*").eq("guild_id", req.params.id).maybeSingle();
    res.json(data || { brand_name: "", logo_url: "", primary_color: "#8B5CF6", accent_color: "#d0bcff", theme: {} });
  });

  app.post("/api/guilds/:id/branding", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });
    const entitlements = await getGuildEntitlements(req.params.id);
    if (!entitlements.white_label) {
      return res.status(403).json({ error: "White-label branding requires an Enterprise plan." });
    }
    const payload = {
      guild_id: req.params.id,
      brand_name: req.body?.brand_name || null,
      logo_url: req.body?.logo_url || null,
      primary_color: req.body?.primary_color || "#8B5CF6",
      accent_color: req.body?.accent_color || "#d0bcff",
      theme: req.body?.theme || {},
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from("branding_profiles").upsert(payload, { onConflict: "guild_id" }).select("*").single();
    if (error) return res.status(500).json({ error: error.message });

    try {
      if (bot.isReady()) {
        const guild = bot.guilds.cache.get(req.params.id);

        // Update Server Nickname (faster, immediate, less rate limited)
        if (guild && payload.brand_name) {
          await guild.members.me?.setNickname(payload.brand_name).catch(e => console.error("[Branding] Nickname error:", e));
        }

        // Update Global Bot Profile (stricter rate limits apply)
        if (payload.brand_name && bot.user?.username !== payload.brand_name) {
          await bot.user?.setUsername(payload.brand_name).catch(e => console.error("[Branding] Username error:", e));
        }
        if (payload.logo_url && bot.user?.avatarURL() !== payload.logo_url) {
          await bot.user?.setAvatar(payload.logo_url).catch(e => console.error("[Branding] Avatar error:", e));
        }
      }
    } catch (err) {
      console.error("[Branding] Failed to update Discord bot profile:", err);
    }

    await logPlatformEvent(req.params.id, "branding_updated", "info", { brand_name: payload.brand_name }, "dashboard");
    res.json(data);
  });

  // Background checks for SLA breaches and snapshot drift
  cron.schedule("*/5 * * * *", async () => {
    if (!supabase) return;
    const nowIso = new Date().toISOString();
    const { data: due } = await supabase
      .from("ticket_sla")
      .select("ticket_id,guild_id,first_response_due_at,breached")
      .eq("breached", false)
      .not("first_response_due_at", "is", null);
    for (const row of due || []) {
      if (row.first_response_due_at && row.first_response_due_at < nowIso) {
        await supabase.from("ticket_sla").update({ breached: true, updated_at: nowIso }).eq("ticket_id", row.ticket_id);
        await logPlatformEvent(row.guild_id, "ticket_sla_breached", "warning", { ticketId: row.ticket_id }, "system");
      }
    }

    const { data: guildRows } = await supabase.from("guilds").select("id").limit(200);
    for (const guildRow of guildRows || []) {
      const { data: snaps } = await supabase
        .from("server_snapshots")
        .select("id,created_at")
        .eq("guild_id", guildRow.id)
        .order("created_at", { ascending: false })
        .limit(2);
      if ((snaps || []).length >= 2) {
        const latest = new Date(snaps![0].created_at).getTime();
        const older = new Date(snaps![1].created_at).getTime();
        if (latest - older > 7 * 24 * 60 * 60 * 1000) {
          await logPlatformEvent(guildRow.id, "snapshot_drift_warning", "warning", { latestSnapshotId: snaps![0].id }, "system");
        }
      }
    }
  });

  cron.schedule("*/10 * * * *", async () => {
    if (!supabase || !bot.isReady()) return;
    const { data: entRows } = await supabase.from("entitlements").select("guild_id,features");
    for (const row of entRows || []) {
      if (!row?.features?.backup_restore) continue;
      const { data: guildRow } = await supabase.from("guilds").select("active_modules").eq("id", row.guild_id).maybeSingle();
      const activeModules = normalizeActiveModules(guildRow?.active_modules);
      const scheduler = { ...getDefaultBackupScheduler(), ...(activeModules.backup_scheduler || {}) };
      if (!scheduler.enabled) continue;

      const now = new Date();
      const hour = Math.max(0, Math.min(23, Number(scheduler.hour ?? 3)));
      const minute = Math.max(0, Math.min(59, Number(scheduler.minute ?? 15)));
      const cadence = String(scheduler.cadence || "daily").toLowerCase() === "weekly" ? "weekly" : "daily";
      const weekday = Math.max(0, Math.min(6, Number(scheduler.weekday ?? 1)));

      if (now.getUTCHours() !== hour) continue;
      if (now.getUTCMinutes() < minute || now.getUTCMinutes() > minute + 9) continue;
      if (cadence === "weekly" && now.getUTCDay() !== weekday) continue;

      const lastRunAt = scheduler.last_run_at ? new Date(scheduler.last_run_at) : null;
      if (lastRunAt) {
        const sameDay =
          lastRunAt.getUTCFullYear() === now.getUTCFullYear() &&
          lastRunAt.getUTCMonth() === now.getUTCMonth() &&
          lastRunAt.getUTCDate() === now.getUTCDate();
        if (sameDay) continue;
      }

      const payload = await buildGuildSnapshotPayload(row.guild_id);
      if (!payload) continue;
      await supabase.from("server_snapshots").insert({
        guild_id: row.guild_id,
        snapshot_type: "scheduled",
        created_by: "system",
        payload
      });
      await logPlatformEvent(row.guild_id, "snapshot_created", "info", { source: "scheduled" }, "system");

      activeModules.backup_scheduler = {
        ...scheduler,
        hour,
        minute,
        cadence,
        weekday,
        last_run_at: now.toISOString()
      };
      await supabase.from("guilds").update({ active_modules: activeModules }).eq("id", row.guild_id);

      const retentionDays = Math.max(5, Math.min(180, Number(scheduler.retention || 30)));
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("server_snapshots").delete().eq("guild_id", row.guild_id).lt("created_at", cutoff);

    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.get("*all", (req, res) => {
      res.sendFile(path.join(process.cwd(), "index.html"));
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`HTTP server listening on 0.0.0.0:${PORT} (health: /health)`);
  });
}

startServer();
