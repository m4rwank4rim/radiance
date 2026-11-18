import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { AttachmentBuilder } from 'discord.js';
import {
  buildRankCard,
  buildWelcomeCard,
  buildLeaderboardCard,
  buildEconomyCard,
  buildRewardCard
} from './cardRenderer.js';
import canvafy from 'canvafy';
const { WelcomeLeave, LevelUp } = canvafy;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ThreadChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  ChannelType,
  REST,
  Routes,
  AuditLogEvent
} from 'discord.js';

const commands = [
  {
    name: 'rank',
    description: 'Check your current rank and level',
    options: [
      {
        name: 'user',
        type: 6, // USER
        description: 'The user to check the rank for',
        required: false
      }
    ]
  },
  {
    name: 'profile',
    description: 'View your profile'
  },
  {
    name: 'top',
    description: 'View the server leaderboard'
  },
  {
    name: 'stats',
    description: 'View server statistics'
  },
  {
    name: 'diagnose',
    description: 'Check bot permissions and server integration health'
  },
  {
    name: 'ping',
    description: 'Check bot latency'
  },

  {
    name: 'ban',
    description: 'Ban a member from the server',
    options: [
      { name: 'user', type: 6, description: 'User to ban', required: true },
      { name: 'reason', type: 3, description: 'Ban reason', required: false }
    ]
  },
  {
    name: 'kick',
    description: 'Kick a member from the server',
    options: [
      { name: 'user', type: 6, description: 'User to kick', required: true },
      { name: 'reason', type: 3, description: 'Kick reason', required: false }
    ]
  },
  {
    name: 'timeout',
    description: 'Timeout a member',
    options: [
      { name: 'user', type: 6, description: 'User to timeout', required: true },
      { name: 'minutes', type: 4, description: 'Timeout duration in minutes', required: true },
      { name: 'reason', type: 3, description: 'Timeout reason', required: false }
    ]
  },
  {
    name: 'untimeout',
    description: 'Remove timeout from a member',
    options: [
      { name: 'user', type: 6, description: 'User to untimeout', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false }
    ]
  },
  {
    name: 'purge',
    description: 'Delete recent messages in this channel',
    options: [
      { name: 'amount', type: 4, description: 'Number of messages (1-100)', required: true }
    ]
  },
  {
    name: 'slowmode',
    description: 'Set slowmode for this channel',
    options: [
      { name: 'seconds', type: 4, description: '0-21600 seconds', required: true }
    ]
  },
  {
    name: 'warn',
    description: 'Warn a member',
    options: [
      { name: 'user', type: 6, description: 'User to warn', required: true },
      { name: 'reason', type: 3, description: 'Warning reason', required: true }
    ]
  },
  {
    name: 'warnings',
    description: 'Show warnings for a member',
    options: [
      { name: 'user', type: 6, description: 'User to inspect', required: true }
    ]
  },
  {
    name: 'clear-warnings',
    description: 'Clear all warnings for a member',
    options: [
      { name: 'user', type: 6, description: 'User to clear', required: true }
    ]
  },
  {
    name: 'raidmode',
    description: 'Manage anti-raid mode',
    options: [
      { name: 'mode', type: 3, description: 'on/off/status', required: true }
    ]
  },
  {
    name: 'appeal',
    description: 'Submit an appeal for a moderation case',
    options: [
      { name: 'case_id', type: 3, description: 'Case ID', required: true },
      { name: 'reason', type: 3, description: 'Appeal reason', required: true }
    ]
  },
  {
    name: 'emojis',
    description: 'List all server emojis and their IDs'
  },
  {
    name: 'help',
    description: 'List all available commands'
  }
];






import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import {
  getSecuritySettings,
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
  extractUrls
} from './security.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const DEFAULT_ENTITLEMENTS = {
  ai_moderation: false,
  ticket_intelligence: false,
  backup_restore: false,
  executive_analytics: false,
  white_label: false
};

// --- Helper Functions ---
async function getGuildEntitlements(guildId: string): Promise<Record<string, boolean>> {
  if (!supabase || !guildId) return { ...DEFAULT_ENTITLEMENTS };
  const { data } = await supabase.from("entitlements").select("features").eq("guild_id", guildId).maybeSingle();
  return { ...DEFAULT_ENTITLEMENTS, ...(data?.features || {}) };
}

async function checkCommandPermission(guildId: string, member: any, commandName: string): Promise<boolean> {
  if (!supabase) return true; // If no DB, allow all

  // Check if user has Administrator permission
  if (member?.permissions?.has?.(PermissionFlagsBits.Administrator)) return true;
  if (!member?.roles?.cache) return true;

  const { data, error } = await supabase
    .from('command_permissions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('command_name', commandName)
    .single();

  if (error || !data) return true; // No restriction found

  if (data.admin_only) {
    return false; // Already checked Administrator above
  }

  if (data.allowed_roles && data.allowed_roles.length > 0) {
    return data.allowed_roles.some((roleId: string) => member.roles.cache.has(roleId));
  }

  return true;
}

const SLASH_COMMANDS_WITH_PERMISSIONS = new Set<string>([
  'rank', 'profile', 'top', 'stats', 'diagnose', 'ping', 'ban', 'kick', 'timeout', 'untimeout',
  'purge', 'slowmode', 'warn', 'warnings', 'clear-warnings', 'raidmode', 'appeal', 'emojis'
]);

const ECONOMY_PREFIX_COMMANDS = new Set<string>([
  'help', 'bal', 'balance', 'daily', 'work', 'pay', 'top', 'shop', 'buy'
]);

const LEVELING_SLASH_COMMANDS = new Set<string>([
  'rank', 'profile', 'top', 'stats'
]);

const LEVELING_PREFIX_COMMANDS = new Set<string>([
  'help', 'bal', 'balance', 'daily', 'work', 'pay', 'top', 'shop', 'buy'
]);

const customCommandCooldowns = new Map<string, number>();

async function resolveMappedCommand(guildId: string, inputCommand: string): Promise<string> {
  if (!supabase || !inputCommand) return inputCommand;
  const normalized = inputCommand.toLowerCase();
  const { data, error } = await supabase
    .from('command_mappings')
    .select('original_command')
    .eq('guild_id', guildId)
    .eq('new_command', normalized)
    .maybeSingle();
  if (error || !data?.original_command) return normalized;
  return String(data.original_command).toLowerCase();
}

async function getGuildBranding(guildId: string): Promise<{ brand_name: string | null; primary_color: string | null; logo_url: string | null } | null> {
  if (!supabase || !guildId) return null;

  // Check entitlement for white-label branding
  const entitlements = await getGuildEntitlements(guildId);
  if (!entitlements.white_label) {
    return null;
  }

  const { data } = await supabase
    .from('branding_profiles')
    .select('brand_name, primary_color, logo_url')
    .eq('guild_id', guildId)
    .maybeSingle();
  return data || null;
}

async function getGuildActiveModules(guildId: string, cachedActiveModules: any = null): Promise<any> {
  if (cachedActiveModules) return cachedActiveModules;
  if (!supabase || !guildId) return null;
  const { data } = await supabase
    .from('guilds')
    .select('active_modules')
    .eq('id', guildId)
    .maybeSingle();
  return data?.active_modules || null;
}

async function evaluateCommandAccess(
  guildId: string,
  member: any,
  commandName: string,
  opts: {
    cachedActiveModules?: any;
    levelingCommands?: Set<string>;
    permissionCommands?: Set<string>;
  }
): Promise<{ allowed: boolean; reason?: string }> {
  if (!guildId) return { allowed: true };

  const levelingCommands = opts.levelingCommands;
  if (levelingCommands?.has(commandName)) {
    const activeModules = await getGuildActiveModules(guildId, opts.cachedActiveModules);
    if (activeModules?.leveling === false) {
      return { allowed: false, reason: "❌ The leveling system is currently disabled on this server." };
    }
  }

  const permissionCommands = opts.permissionCommands;
  if (permissionCommands?.has(commandName)) {
    const allowed = await checkCommandPermission(guildId, member, commandName);
    if (!allowed) {
      return { allowed: false, reason: "❌ You don't have permission to use this command." };
    }
  }

  return { allowed: true };
}

// Initialize Google AI
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// Initialize the Discord client with necessary intents
export const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildEmojisAndStickers,
  ],
});


const statsBuffer = new Map<string, { messages: number, commands: number }>();
const raidJoinTimestamps = new Map<string, number[]>();


async function syncStats() {
  if (!supabase) return;
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  for (const [guildId, counts] of statsBuffer.entries()) {
    if (counts.messages === 0 && counts.commands === 0) continue;

    try {
      // Fetch today's record
      const { data: existing } = await supabase
        .from('historical_stats')
        .select('*')
        .eq('guild_id', guildId)
        .eq('date', now)
        .single();

      if (existing) {
        await supabase.from('historical_stats').update({
          messages_24h: (existing.messages_24h || 0) + counts.messages,
          commands_used: (existing.commands_used || 0) + counts.commands,
          total_members: bot.guilds.cache.get(guildId)?.memberCount || existing.total_members
        }).eq('id', existing.id);
      } else {
        await supabase.from('historical_stats').insert({
          guild_id: guildId,
          date: now,
          messages_24h: counts.messages,
          commands_used: counts.commands,
          total_members: bot.guilds.cache.get(guildId)?.memberCount || 0
        });
      }
      // Reset buffer for this guild
      statsBuffer.set(guildId, { messages: 0, commands: 0 });
    } catch (err) {
      console.error(`[Stats] Failed to sync for ${guildId}:`, err);
    }
  }
}

// Sync stats every minute
setInterval(syncStats, 60000);

function trackActivity(guildId: string, type: 'message' | 'command') {
  const current = statsBuffer.get(guildId) || { messages: 0, commands: 0 };
  if (type === 'message') current.messages++;
  if (type === 'command') current.commands++;
  statsBuffer.set(guildId, current);
}

async function logRuntimeEvent(
  guildId: string,
  eventType: string,
  severity: 'info' | 'warning' | 'critical' = 'info',
  actorId?: string,
  metadata: Record<string, any> = {}
) {
  if (!supabase || !guildId) return;
  await supabase.from('event_logs').insert({
    guild_id: guildId,
    source: 'bot',
    event_type: eventType,
    severity,
    actor_id: actorId || null,
    metadata
  });
}

async function openIncident(
  guildId: string,
  title: string,
  severity: 'low' | 'medium' | 'high' = 'medium',
  confidence = 0,
  playbook = 'none',
  summary = ''
) {
  if (!supabase || !guildId) return null;
  const { data } = await supabase
    .from('incidents')
    .insert({
      guild_id: guildId,
      title,
      severity,
      confidence,
      playbook,
      summary,
      status: 'open',
      created_by: 'bot'
    })
    .select('*')
    .single();
  return data || null;
}

async function executeIncidentPlaybook(guildId: string, incidentId: string | null, playbook: 'lockdown_channels' | 'raise_verification') {
  if (!supabase || !guildId) return;
  if (playbook === 'lockdown_channels') {
    const guild = bot.guilds.cache.get(guildId);
    if (guild) {
      for (const [, ch] of guild.channels.cache.filter((c: any) => c.isTextBased() && !c.isThread())) {
        await (ch as any).permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => { });
      }
      setLockdownState(guildId, true);
    }
  }
  if (incidentId) {
    await supabase.from('incident_actions').insert({
      incident_id: incidentId,
      guild_id: guildId,
      action_type: playbook,
      actor_id: bot.user?.id || 'bot',
      payload: { automated: true }
    });
  }
}

// Cooldown map to prevent XP spam (user ID -> timestamp)
const xpCooldowns = new Map<string, number>();

async function createModerationCase(guildId: string, userId: string, moderatorId: string, action: string, reason: string) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('moderation_cases')
    .insert({ guild_id: guildId, user_id: userId, moderator_id: moderatorId, action, reason, status: 'open' })
    .select('*')
    .single();
  return data || null;
}

async function issueWarning(guildId: string, userId: string, moderatorId: string, reason: string) {
  if (!supabase) return { totalWarnings: 0, escalated: false, caseId: null as null | string };
  const { data: warningRow } = await supabase
    .from('user_warnings')
    .insert({ guild_id: guildId, user_id: userId, moderator_id: moderatorId, reason })
    .select('*')
    .single();
  const { count } = await supabase
    .from('user_warnings')
    .select('*', { count: 'exact', head: true })
    .eq('guild_id', guildId)
    .eq('user_id', userId);

  const caseRow = await createModerationCase(guildId, userId, moderatorId, 'Warned', reason);
  return { totalWarnings: count || 0, escalated: false, caseId: caseRow?.id || warningRow?.id || null };
}

async function logModeration(guildId: string, userId: string, action: string, reason: string, maxWarnings?: number, guild?: any, moderatorId?: string) {
  if (!supabase) return;
  try {
    await supabase.from('moderation_logs').insert({
      guild_id: guildId,
      user_id: userId,
      action,
      reason,
      moderator_id: moderatorId || bot.user?.id || 'system'
    });

    if (maxWarnings && guild && action === 'Warned') {
      const { count } = await supabase.from('moderation_logs')
        .select('*', { count: 'exact', head: true })
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('action', 'Warned');

      if (count && count >= maxWarnings) {
        const member = guild.members.cache.get(userId);
        if (member && member.kickable) {
          await member.kick(`Automod: Exceeded ${maxWarnings} Warnings Limit`);
          await supabase.from('moderation_logs').insert({
            guild_id: guildId,
            user_id: userId,
            action: 'Kicked',
            reason: `Exceeded ${maxWarnings} Warnings Limit`,
            moderator_id: bot.user?.id || 'system'
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to log moderation action:', err);
  }
}

export function startBot() {
  const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;

  if (!token || token === 'your-discord-bot-token') {
    console.warn('⚠️ DISCORD_BOT_TOKEN is missing or invalid. The Discord bot engine is offline.');
    return;
  }

  bot.login(token);

  bot.once('ready', async () => {
    console.log(`🤖 Radiance Bot Engine is online! Logged in as ${bot.user?.tag}`);
    bot.user?.setActivity('over your community', { type: 3 });

    // Sync Guilds to Database
    if (supabase) {
      console.log('[Bot] Syncing guilds to database...');
      for (const [id, guild] of bot.guilds.cache) {
        try {
          const { error } = await supabase.from('guilds').upsert({
            id: id,
            name: guild.name,
            icon: guild.iconURL({ extension: 'png' }) || null,
            owner_id: guild.ownerId
          }, { onConflict: 'id' });
        } catch (err) {
          console.error(err);
        }
      }
    }

    // Register slash commands to all guilds for immediate availability
    if (process.env.DISCORD_CLIENT_ID) {
      const rest = new REST({ version: '10' }).setToken(token);
      console.log(`[Registration] Registering slash commands for ${bot.guilds.cache.size} guilds...`);

      // Register globally (non-blocking: skip if unverified or unauthorized)
      try {
        await rest.put(
          Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
          { body: commands },
        );
        console.log(`[Registration] Global commands registered.`);
      } catch (globalErr: any) {
        console.warn(`[Registration] Global command registration skipped: ${globalErr?.message || globalErr}`);
      }

      // Register per-guild (each guild is independent)
      for (const guildId of bot.guilds.cache.keys()) {
        try {
          await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, guildId),
            { body: commands },
          );
          console.log(`[Registration] Commands registered for guild ${guildId}.`);
        } catch (guildErr) {
          console.error(`[Registration] Failed for guild ${guildId}:`, guildErr);
        }
      }
    }

    // --- Dynamic Voice Cleanup on Startup (always runs) ---
    if (supabase) {
      try {
        const { data: channels } = await supabase.from('temporary_voice_channels').select('*');
        if (channels) {
          for (const record of channels) {
            const guild = bot.guilds.cache.get(record.guild_id);
            if (guild) {
              const channel = guild.channels.cache.get(record.channel_id);
              if (!channel || (channel.isVoiceBased() && channel.members.size === 0)) {
                await channel?.delete('Bot Startup Cleanup').catch(() => { });
                await supabase.from('temporary_voice_channels').delete().eq('channel_id', record.channel_id);
              }
            }
          }
        }
      } catch (cleanupErr) {
        console.error("[Startup] Voice cleanup failed:", cleanupErr);
      }
    }
  });

  // Auto-register guild when bot is invited to a new server
  bot.on('guildCreate', async (guild) => {
    console.log(`[Bot] Joined new guild: ${guild.name} (${guild.id})`);

    if (supabase) {
      try {
        await supabase.from('guilds').upsert({
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL({ extension: 'png' }) || null,
          owner_id: guild.ownerId
        }, { onConflict: 'id' });
        console.log(`[Bot] Guild ${guild.name} registered in database.`);
      } catch (err) {
        console.error(`[Bot] Failed to register guild ${guild.id}:`, err);
      }
    }

    if (process.env.DISCORD_CLIENT_ID) {
      try {
        const rest = new REST({ version: '10' }).setToken(token);
        await rest.put(
          Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, guild.id),
          { body: commands }
        );
        console.log(`[Bot] Slash commands deployed to ${guild.name}.`);
      } catch (err) {
        console.error(`[Bot] Failed to deploy commands to ${guild.id}:`, err);
      }
    }
  });
}

// --- Centralized Logging Engine ---
const logEvent = async (guildId: string, type: 'messages' | 'members' | 'voice' | 'server', embed: EmbedBuilder) => {
  if (!supabase) return;
  try {
    const { data: guildData } = await supabase
      .from('guilds')
      .select('logging_enabled, logging_channel_id, log_messages, log_members, log_voice, log_server')
      .eq('id', guildId)
      .single();

    if (!guildData?.logging_enabled || !guildData.logging_channel_id) return;

    const shouldLog = {
      messages: guildData.log_messages,
      members: guildData.log_members,
      voice: guildData.log_voice,
      server: guildData.log_server
    }[type];

    if (!shouldLog) return;

    const channel = bot.guilds.cache.get(guildId)?.channels.cache.get(guildData.logging_channel_id);
    if (channel?.isTextBased()) {
      await (channel as any).send({ embeds: [embed] }).catch(() => { });
    }
  } catch (err) {
    console.error("[Logging] Error sending log:", err);
  }
};

// --- Welcome & Farewell System ---
bot.on('guildMemberAdd', async (member) => {
  if (!supabase) return;
  try {
    const { data: sec } = await supabase
      .from('guild_security')
      .select('raid_mode_enabled, raid_join_threshold, raid_window_seconds, predictive_raid_detection, auto_lockdown')
      .eq('guild_id', member.guild.id)
      .single();

    if (sec?.raid_mode_enabled || sec?.predictive_raid_detection) {
      const now = Date.now();
      const windowMs = (sec.raid_window_seconds || 20) * 1000;
      const threshold = sec.raid_join_threshold || 8;

      // Use predictive detection if enabled
      if (sec?.predictive_raid_detection) {
        const joins = [now];
        const raidInfo = detectRaid(member.guild.id, joins);

        if (raidInfo.raidDetected && raidInfo.confidence > 50) {
          await logRuntimeEvent(member.guild.id, 'raid_prediction', 'warning', member.id, {
            confidence: raidInfo.confidence,
            recommendedAction: raidInfo.recommendedAction
          });
          const incident = await openIncident(
            member.guild.id,
            'Predictive raid detection triggered',
            raidInfo.confidence >= 70 ? 'high' : 'medium',
            raidInfo.confidence,
            raidInfo.recommendedAction === 'lockdown' ? 'lockdown_channels' : 'raise_verification',
            `Predictive model detected raid behavior with confidence ${raidInfo.confidence}%.`
          );
          const embed = new EmbedBuilder()
            .setTitle("🚨 Predictive Raid Alert")
            .setDescription(`Confidence: **${raidInfo.confidence}%** | Recommended action: **${raidInfo.recommendedAction}**`)
            .setColor('#ff4757')
            .setTimestamp();
          await logEvent(member.guild.id, 'server', embed);

          // Auto-lockdown if enabled and confidence is high
          if (sec?.auto_lockdown && raidInfo.recommendedAction === 'lockdown') {
            const textChannels = member.guild.channels.cache.filter((c: any) => c.isTextBased() && !c.isThread());
            for (const [, ch] of textChannels) {
              await (ch as any).permissionOverwrites.edit(member.guild.roles.everyone, { SendMessages: false }).catch(() => { });
            }
            setLockdownState(member.guild.id, true);
            await createModerationCase(member.guild.id, member.id, bot.user?.id || 'system', 'Auto Raid Lockdown', `Confidence: ${raidInfo.confidence}%`);
            await executeIncidentPlaybook(member.guild.id, incident?.id || null, 'lockdown_channels');
          }
        }
      } else {
        // Standard raid detection
        const current = (raidJoinTimestamps.get(member.guild.id) || []).filter(ts => now - ts <= windowMs);
        current.push(now);
        raidJoinTimestamps.set(member.guild.id, current);

        if (current.length >= threshold) {
          await logRuntimeEvent(member.guild.id, 'raid_prediction', 'critical', member.id, {
            confidence: 95,
            joinsInWindow: current.length
          });
          const incident = await openIncident(
            member.guild.id,
            'Raid threshold exceeded',
            'high',
            95,
            'lockdown_channels',
            `Detected ${current.length} joins in ${(sec.raid_window_seconds || 20)} seconds.`
          );
          const textChannels = member.guild.channels.cache.filter((c: any) => c.isTextBased() && !c.isThread());
          for (const [, ch] of textChannels) {
            await (ch as any).permissionOverwrites.edit(member.guild.roles.everyone, { SendMessages: false }).catch(() => { });
          }
          const audit = new EmbedBuilder()
            .setTitle("🚨 Anti-Raid Triggered")
            .setDescription(`Detected **${current.length} joins** in ${(sec.raid_window_seconds || 20)}s. Server channels were locked.`)
            .setColor('#ff4757')
            .setTimestamp();
          await logEvent(member.guild.id, 'server', audit);
          await createModerationCase(member.guild.id, member.id, bot.user?.id || 'system', 'Raid Lockdown', `Triggered at ${current.length} joins`);
          await executeIncidentPlaybook(member.guild.id, incident?.id || null, 'lockdown_channels');
        }
      }
    }

    const { data: config } = await supabase
      .from('guilds')
      .select('welcome_enabled, welcome_message, welcome_channel, active_modules')
      .eq('id', member.guild.id)
      .single();

    if (config?.welcome_enabled && config.welcome_channel) {
      const channel = member.guild.channels.cache.get(config.welcome_channel);
      if (channel?.isTextBased()) {
        const canvas = config.active_modules?.canvas || {};

        const welcomeCard = await new WelcomeLeave()
          .setAvatar(member.user.displayAvatarURL({ extension: 'png' }))
          .setUsername(member.user.username)
          .setTitle("WELCOME")
          .setDescription(config.welcome_message || "Welcome to the server!")
          .setBackground("image", canvas.welcome_background_url || "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1000&auto=format&fit=crop")
          .setBorder(canvas.welcome_accent_color || "#d0bcff")
          .setAvatarBorder(canvas.welcome_accent_color || "#d0bcff")
          .setOverlayOpacity(0.5)
          .build();

        const attachment = new AttachmentBuilder(welcomeCard, { name: `welcome-${member.id}.png` });
        await (channel as any).send({
          content: `👋 Welcome ${member}!`,
          files: [attachment]
        });
      }
    }
  } catch (err) {
    console.error("[Welcome] Error processing join:", err);
  }
});

bot.on('guildMemberRemove', async (member) => {
  if (!supabase) return;
  try {
    const { data: config } = await supabase
      .from('guilds')
      .select('farewell_enabled, farewell_message, farewell_channel, active_modules')
      .eq('id', member.guild.id)
      .single();

    if (config?.farewell_enabled && config.farewell_channel) {
      const channel = member.guild.channels.cache.get(config.farewell_channel);
      if (channel?.isTextBased()) {
        const canvas = config.active_modules?.canvas || {};

        const farewellCard = await new WelcomeLeave()
          .setAvatar(member.user.displayAvatarURL({ extension: 'png' }))
          .setUsername(member.user.username)
          .setTitle("GOODBYE")
          .setDescription(config.farewell_message || "We hope to see you again!")
          .setBackground("image", canvas.farewell_background_url || "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000&auto=format&fit=crop")
          .setBorder(canvas.farewell_accent_color || "#ffb2b7")
          .setAvatarBorder(canvas.farewell_accent_color || "#ffb2b7")
          .setOverlayOpacity(0.5)
          .build();

        const attachment = new AttachmentBuilder(farewellCard, { name: `goodbye-${member.id}.png` });
        await (channel as any).send({
          content: `👋 Goodbye **${member.user.username}**...`,
          files: [attachment]
        });
      }
    }
  } catch (err) {
    console.error("[Farewell] Error processing leave:", err);
  }
});

// --- Audit Log Listeners ---
bot.on('messageDelete', async (message) => {
  if (!message.guildId || message.author?.bot) return;

  let executor = null;
  try {
    const fetchedLogs = await message.guild?.fetchAuditLogs({
      limit: 1,
      type: AuditLogEvent.MessageDelete,
    });
    const deletionLog = fetchedLogs?.entries.first();
    if (deletionLog && deletionLog.createdTimestamp > Date.now() - 5000) {
      executor = deletionLog.executor;
    }
  } catch (err) {
    console.error("[Audit] Failed to fetch message delete logs:", err);
  }

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Message Deleted")
    .setColor('#ff4757')
    .addFields(
      { name: "Author", value: `<@${message.author?.id}> (${message.author?.tag})`, inline: true },
      { name: "Channel", value: `<#${message.channelId}>`, inline: true },
      { name: "Content", value: (message.content?.substring(0, 1024)) || "*No content*" }
    )
    .setTimestamp();

  if (executor) {
    embed.addFields({ name: "Deleted by", value: `<@${executor.id}>`, inline: true });
  }

  logEvent(message.guildId, 'messages', embed);
});

bot.on('messageUpdate', async (oldMessage, newMessage) => {
  if (!newMessage.guildId || newMessage.author?.bot || oldMessage.content === newMessage.content) return;
  const embed = new EmbedBuilder()
    .setTitle("📝 Message Edited")
    .setColor('#3742fa')
    .setURL(newMessage.url)
    .addFields(
      { name: "Author", value: `<@${newMessage.author?.id}>`, inline: true },
      { name: "Channel", value: `<#${newMessage.channelId}>`, inline: true },
      { name: "Before", value: (oldMessage.content?.substring(0, 1024)) || "*No content*" },
      { name: "After", value: (newMessage.content?.substring(0, 1024)) || "*No content*" }
    )
    .setTimestamp();
  logEvent(newMessage.guildId, 'messages', embed);
});

// --- Missing Audit Log Events ---
bot.on('channelCreate', async (channel) => {
  if (!channel.guildId) return;

  let executor = null;
  try {
    const fetchedLogs = await channel.guild?.fetchAuditLogs({
      limit: 1,
      type: AuditLogEvent.ChannelCreate,
    });
    const log = fetchedLogs?.entries.first();
    if (log && log.targetId === channel.id && log.createdTimestamp > Date.now() - 5000) {
      executor = log.executor;
    }
  } catch (err) {
    console.error("[Audit] Failed to fetch channel create logs:", err);
  }

  const embed = new EmbedBuilder().setTitle('📢 Channel Created').setColor('#2ed573')
    .addFields({ name: 'Name', value: `${channel}`, inline: true }, { name: 'Type', value: channel.type.toString(), inline: true })
    .setTimestamp();

  if (executor) {
    embed.addFields({ name: "Created by", value: `<@${executor.id}>`, inline: true });
  }

  logEvent(channel.guildId, 'server', embed);
});

bot.on('channelDelete', async (channel) => {
  if (!('guildId' in channel) || !channel.guildId) return;
  const embed = new EmbedBuilder().setTitle('🗑️ Channel Deleted').setColor('#ff4757')
    .addFields({ name: 'Name', value: (channel as any).name || 'Unknown', inline: true })
    .setTimestamp();
  logEvent(channel.guildId, 'server', embed);
});

bot.on('roleCreate', async (role) => {
  const embed = new EmbedBuilder().setTitle('✨ Role Created').setColor('#ffa502')
    .addFields({ name: 'Name', value: role.name, inline: true }, { name: 'Color', value: role.hexColor, inline: true })
    .setTimestamp();
  logEvent(role.guild.id, 'server', embed);
});

bot.on('roleDelete', async (role) => {
  const embed = new EmbedBuilder().setTitle('🗑️ Role Deleted').setColor('#ff4757')
    .addFields({ name: 'Name', value: role.name, inline: true })
    .setTimestamp();
  logEvent(role.guild.id, 'server', embed);
});

bot.on('guildMemberUpdate', async (oldMember, newMember) => {
  const guildId = newMember.guild.id;
  const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
  if (addedRoles.size > 0) {
    const embed = new EmbedBuilder().setTitle('🎭 Role Added').setColor('#2ed573')
      .addFields({ name: 'Member', value: `${newMember}`, inline: true }, { name: 'Roles Added', value: addedRoles.map(r => r.name).join(', '), inline: true })
      .setTimestamp();
    logEvent(guildId, 'members', embed);
  }
  if (removedRoles.size > 0) {
    const embed = new EmbedBuilder().setTitle('🎭 Role Removed').setColor('#ff4757')
      .addFields({ name: 'Member', value: `${newMember}`, inline: true }, { name: 'Roles Removed', value: removedRoles.map(r => r.name).join(', '), inline: true })
      .setTimestamp();
    logEvent(guildId, 'members', embed);
  }
  if (oldMember.nickname !== newMember.nickname) {
    const embed = new EmbedBuilder().setTitle('📝 Nickname Changed').setColor('#3742fa')
      .addFields({ name: 'Member', value: `${newMember}`, inline: true }, { name: 'Before', value: oldMember.nickname || 'None', inline: true }, { name: 'After', value: newMember.nickname || 'None', inline: true })
      .setTimestamp();
    logEvent(guildId, 'members', embed);
  }
});

// --- Helper: Get Custom Emoji ---
function getCustomEmoji(guild: any, name: string, fallback: string) {
  if (!guild) return fallback;

  // Try exact match (case-insensitive) first
  let emoji = guild.emojis.cache.find((e: any) => e.name.toLowerCase() === name.toLowerCase());

  // If not found, try partial match (case-insensitive)
  if (!emoji) {
    emoji = guild.emojis.cache.find((e: any) => e.name.toLowerCase().includes(name.toLowerCase()));
  }

  if (emoji) {
    return emoji.toString();
  } else {
    return fallback;
  }
}

bot.on('voiceStateUpdate', async (oldState, newState) => {
  const member = newState.member;
  if (!member || member.user.bot) return;

  const guild = newState.guild;
  if (!guild || !supabase) return;

  // --- Voice Logging ---
  const logEmbed = new EmbedBuilder().setTimestamp().setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL() });
  if (!oldState.channelId && newState.channelId) {
    logEmbed.setTitle("🔊 Joined Voice Channel").setColor('#2ed573').setDescription(`${member} joined <#${newState.channelId}>`);
    logEvent(guild.id, 'voice', logEmbed);
  } else if (oldState.channelId && !newState.channelId) {
    logEmbed.setTitle("🔇 Left Voice Channel").setColor('#ff4757').setDescription(`${member} left <#${oldState.channelId}>`);
    logEvent(guild.id, 'voice', logEmbed);
  } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    logEmbed.setTitle("↔️ Moved Voice Channel").setColor('#ffa502').setDescription(`${member} moved from <#${oldState.channelId}> to <#${newState.channelId}>`);
    logEvent(guild.id, 'voice', logEmbed);
  }

  try {
    // 1. Fetch Dynamic Voice Config
    const { data: config } = await supabase
      .from('guilds')
      .select('dynamic_voice_enabled, dynamic_voice_hub_id, dynamic_voice_naming, dynamic_voice_menu')
      .eq('id', guild.id)
      .single();

    if (!config?.dynamic_voice_enabled || !config.dynamic_voice_hub_id) return;

    // 2. Hub Join Logic
    if (newState.channelId === config.dynamic_voice_hub_id) {
      console.log(`[Voice Hub] ${member.user.tag} joined hub! Creating channel...`);

      const hubChannel = guild.channels.cache.get(config.dynamic_voice_hub_id);
      if (!hubChannel || !hubChannel.isVoiceBased()) return;

      const channelName = (config.dynamic_voice_naming || "🔊 {user}'s Channel").replace('{user}', member.displayName);

      // Create temp channel
      const tempChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: hubChannel.parentId,
        reason: 'Dynamic Voice Hub'
      });

      // Track in DB
      const { error: dbErr } = await supabase.from('temporary_voice_channels').insert({
        guild_id: guild.id,
        id: tempChannel.id,
        owner_id: member.id
      });

      // Move user
      if (guild.members.me?.permissions.has(PermissionFlagsBits.MoveMembers)) {
        // Only move if they are still in the hub
        const currentVoice = guild.members.cache.get(member.id)?.voice;
        if (currentVoice?.channelId === config.dynamic_voice_hub_id) {
          await member.voice.setChannel(tempChannel).catch(e => console.error("[Voice Hub] Move failed:", e));
        }
      }

      // Send Control Panel
      if (config.dynamic_voice_menu !== false) {
        const branding = await getGuildBranding(guild.id);
        const interfaceName = branding?.brand_name ? `${branding.brand_name} Interface` : 'Voice Control Panel';
        const contentStr = `# ${interfaceName}\n> ${member} Use the buttons below to manage your voice channel.`;

        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('voice_rename').setEmoji('1492091941607968918').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice_lock').setEmoji('1492091831268278396').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice_unlock').setEmoji('1492092074445770853').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice_hide').setEmoji('1492091646559649874').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice_show').setEmoji('1492092036646699029').setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('voice_camera').setEmoji('1492091576414113892').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice_music').setEmoji('1492091867402076290').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice_activities').setEmoji('1492091543375446056').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice_claim').setEmoji('1492091611738275840').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice_limit').setEmoji('1492091788540907541').setStyle(ButtonStyle.Secondary)
        );

        const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('voice_perms').setEmoji('1492091908019847328').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice_settings').setEmoji('1492091999157751892').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice_invite').setEmoji('1492091718990827661').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice_kick').setEmoji('1492091757050200105').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice_info').setEmoji('1492091682819407883').setStyle(ButtonStyle.Secondary)
        );

        await tempChannel.send({ content: contentStr, components: [row1, row2, row3] }).catch(() => { });
      }
    }

    // 3. Simple Cleanup Logic
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      // Check if the channel they left was a temp channel
      const { data: tempChan } = await supabase
        .from('temporary_voice_channels')
        .select('*')
        .eq('id', oldState.channelId)
        .maybeSingle();

      if (tempChan) {
        const leftChan = guild.channels.cache.get(oldState.channelId);
        if (leftChan && leftChan.isVoiceBased() && leftChan.members.size === 0) {
          console.log(`[Voice Cleanup] Deleting empty channel: ${leftChan.name}`);
          await supabase.from('temporary_voice_channels').delete().eq('id', oldState.channelId);
          await leftChan.delete('Temp Voice Empty').catch(() => { });
        }
      }
    }
  } catch (err) {
    console.error("[Voice Error]", err);
  }
});

bot.on('interactionCreate', async (interaction) => {
  // --- COMMAND HANDLING ---
  if (interaction.isChatInputCommand()) {
    trackActivity(interaction.guildId || '', 'command');
    await logRuntimeEvent(interaction.guildId || '', 'command_used', 'info', interaction.user?.id, { command: interaction.commandName });

    // Fetch active modules for current guild
    let activeModules: any = null;
    if (supabase && interaction.guildId) {
      const { data: guildData } = await supabase
        .from('guilds')
        .select('active_modules')
        .eq('id', interaction.guildId)
        .single();
      if (guildData) activeModules = guildData.active_modules;
    }

    if (interaction.commandName === 'help') {
      const embed = new EmbedBuilder()
        .setTitle("📖 Radiance Pro Help")
        .setColor("#8B5CF6")
        .setDescription("List of all available slash commands:")
        .addFields(
          { name: "👤 Profile", value: "`/profile`, `/rank`", inline: true },
          { name: "📈 Stats", value: "`/stats`, `/top`", inline: true },
          { name: "🛡️ Moderation", value: "`/ban`, `/kick`, `/timeout`, `/purge`, `/slowmode`, `/warn`, `/warnings`, `/clear-warnings`, `/raidmode`, `/appeal`", inline: false },
          { name: "🛠️ Utility", value: "`/ping`, `/emojis`, `/diagnose`", inline: true }
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const slashAccess = await evaluateCommandAccess(
      interaction.guildId!,
      interaction.member as any,
      interaction.commandName,
      {
        cachedActiveModules: activeModules,
        levelingCommands: LEVELING_SLASH_COMMANDS,
        permissionCommands: SLASH_COMMANDS_WITH_PERMISSIONS
      }
    );
    if (!slashAccess.allowed) {
      await logRuntimeEvent(interaction.guildId || '', 'policy_denied', 'warning', interaction.user?.id, {
        command: interaction.commandName,
        reason: slashAccess.reason || 'blocked'
      });
      await interaction.reply({ content: slashAccess.reason || "❌ Command blocked.", ephemeral: true });
      return;
    }

    if (interaction.commandName === 'rank') {
      if (!supabase) return;
      await interaction.deferReply();

      try {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        // Get guild branding
        const { data: guildData } = await supabase
          .from('guilds')
          .select('active_modules')
          .eq('id', interaction.guildId)
          .single();

        const canvas = guildData?.active_modules?.canvas || {};
        console.log(`[Canvas Debug] Guild: ${interaction.guildId} | guildData found: ${!!guildData} | canvas:`, JSON.stringify(canvas));

        // Get all levels sorted to calculate rank
        const { data: allLevels } = await supabase
          .from('levels')
          .select('user_id, xp, level')
          .eq('guild_id', interaction.guildId)
          .order('xp', { ascending: false });

        const userStats = allLevels?.find(l => l.user_id === targetUser.id) || { xp: 0, level: 0 };
        const rankIdx = allLevels?.findIndex(l => l.user_id === targetUser.id);
        const rankPos = (rankIdx !== undefined && rankIdx !== -1) ? rankIdx + 1 : (allLevels?.length || 1);

        const currentXp = userStats.xp;
        const level = userStats.level;
        const requiredXp = Math.floor(100 * Math.pow(level + 1, 1.5));

        const branding = await getGuildBranding(interaction.guildId!);
        const buffer = await buildRankCard({
          username: targetUser.username,
          avatarUrl: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
          level,
          rank: rankPos,
          currentXp,
          requiredXp,
          accentColor: canvas.rank_accent_color || canvas.level_up_accent_color || canvas.welcome_accent_color || '#d0bcff',
          textColor: canvas.rank_text_color || canvas.level_up_text_color || '#ffffff',
          backgroundUrl: canvas.rank_background_url || canvas.level_up_background_url || canvas.welcome_background_url || undefined,
          brandName: branding?.brand_name || undefined
        });

        const attachment = new AttachmentBuilder(buffer, { name: `rank-${targetUser.id}.png` });
        await interaction.editReply({ files: [attachment] });
      } catch (err) {
        console.error("[Rank] Error generating card:", err);
        await interaction.editReply("Failed to generate rank card.");
      }
      return;
    }

    if (interaction.commandName === 'top') {
      if (!supabase) return;
      await interaction.deferReply();

      try {
        const { data: guildData } = await supabase
          .from('guilds')
          .select('active_modules')
          .eq('id', interaction.guildId)
          .single();

        const canvas = guildData?.active_modules?.canvas || {};

        const { data: topUsers } = await supabase
          .from('levels')
          .select('user_id, xp, level')
          .eq('guild_id', interaction.guildId)
          .order('xp', { ascending: false })
          .limit(5);

        if (!topUsers || topUsers.length === 0) {
          return interaction.editReply("No leaderboard data available yet!");
        }

        const leaderboardData = await Promise.all(topUsers.map(async (u, index) => {
          const user = await bot.users.fetch(u.user_id).catch(() => null);
          return {
            rank: index + 1,
            username: user?.username || `User ${index + 1}`,
            xp: u.xp,
            avatarUrl: user?.displayAvatarURL({ extension: 'png', size: 64 })
          };
        }));

        const branding = await getGuildBranding(interaction.guildId!);
        const buffer = await buildLeaderboardCard({
          entries: leaderboardData,
          type: 'XP',
          guildName: interaction.guild?.name,
          accentColor: canvas.top_accent_color || canvas.level_up_accent_color || canvas.welcome_accent_color || '#d0bcff',
          textColor: canvas.top_text_color || canvas.level_up_text_color || '#ffffff',
          backgroundUrl: canvas.top_background_url || canvas.level_up_background_url || canvas.welcome_background_url || undefined,
          brandName: branding?.brand_name || undefined
        });

        const attachment = new AttachmentBuilder(buffer, { name: `top-leaderboard.png` });
        await interaction.editReply({ files: [attachment] });
      } catch (err) {
        console.error("[Top] Error generating leaderboard:", err);
        await interaction.editReply("Failed to generate leaderboard card.");
      }
      return;
    }

    if (interaction.commandName === 'stats') {
      if (!supabase) return;
      await interaction.deferReply();

      try {
        const guild = interaction.guild;
        if (!guild) return;

        const { data: guildData } = await supabase
          .from('guilds')
          .select('active_modules')
          .eq('id', guild.id)
          .single();

        const canvas = guildData?.active_modules?.canvas || {};
        const totalMembers = guild.memberCount;

        const { data: levelData } = await supabase
          .from('levels')
          .select('xp')
          .eq('guild_id', guild.id);

        const totalXp = levelData?.reduce((acc, curr) => acc + curr.xp, 0) || 0;
        const avgLevel = levelData?.length
          ? (levelData.reduce((acc, curr) => acc + (Math.floor(Math.pow(curr.xp / 100, 1 / 1.5))), 0) / levelData.length).toFixed(1)
          : 0;

        const branding = await getGuildBranding(guild.id);
        const buffer = await buildWelcomeCard({
          username: guild.name,
          avatarUrl: guild.iconURL({ extension: 'png' }) || 'https://cdn.discordapp.com/embed/avatars/0.png',
          title: 'SERVER STATISTICS',
          description: `${totalMembers} Members · ${totalXp.toLocaleString()} XP · Avg Lvl ${avgLevel}`,
          accentColor: canvas.stats_accent_color || canvas.level_up_accent_color || canvas.welcome_accent_color || '#d0bcff',
          textColor: canvas.stats_text_color || canvas.level_up_text_color || '#ffffff',
          backgroundUrl: canvas.stats_background_url || canvas.level_up_background_url || canvas.welcome_background_url || undefined,
          brandName: branding?.brand_name || undefined
        });

        const attachment = new AttachmentBuilder(buffer, { name: `stats-${guild.id}.png` });
        await interaction.editReply({ files: [attachment] });
      } catch (err) {
        console.error("[Stats] Error:", err);
        await interaction.editReply("Failed to generate server statistics card.");
      }
      return;
    }

    if (interaction.commandName === 'diagnose') {
      const guild = interaction.guild;
      if (!guild) {
        await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
        return;
      }

      const me = guild.members.me;
      if (!me) {
        await interaction.reply({ content: "❌ I can't read my member state in this guild.", ephemeral: true });
        return;
      }

      const checks: Array<{ label: string; ok: boolean; details: string }> = [];

      checks.push({
        label: "Bot Ready",
        ok: bot.isReady(),
        details: bot.isReady() ? "Gateway connection is healthy." : "Bot is not fully ready yet."
      });

      checks.push({
        label: "View Channels",
        ok: me.permissions.has(PermissionFlagsBits.ViewChannel),
        details: "Required to discover channels and respond in configured routes."
      });

      checks.push({
        label: "Send Messages",
        ok: me.permissions.has(PermissionFlagsBits.SendMessages),
        details: "Required for ticket replies, notifications, and command responses."
      });

      checks.push({
        label: "Manage Roles",
        ok: me.permissions.has(PermissionFlagsBits.ManageRoles),
        details: "Required for role panels and level reward role assignment."
      });

      checks.push({
        label: "Manage Channels",
        ok: me.permissions.has(PermissionFlagsBits.ManageChannels),
        details: "Required for ticket creation and dynamic voice channel controls."
      });

      checks.push({
        label: "Moderate Members",
        ok: me.permissions.has(PermissionFlagsBits.ModerateMembers),
        details: "Recommended for timeout/punishment actions in moderation workflows."
      });

      const failed = checks.filter(c => !c.ok);
      const status = failed.length === 0 ? "PASS" : "ACTION REQUIRED";

      const embed = new EmbedBuilder()
        .setTitle(`🩺 Radiance Diagnostics • ${status}`)
        .setColor(failed.length === 0 ? '#2ed573' : '#ffa502')
        .setDescription(
          failed.length === 0
            ? "All core checks passed. Your bot and dashboard integrations look healthy."
            : `Detected **${failed.length}** issue(s). Update permissions in Server Settings -> Roles -> Radiance.`
        )
        .addFields(
          checks.slice(0, 6).map(check => ({
            name: `${check.ok ? '✅' : '❌'} ${check.label}`,
            value: check.details,
            inline: false
          }))
        )
        .setFooter({ text: `Guild: ${guild.name}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (interaction.commandName === 'ping') {
      await interaction.reply(`Pong! API Latency is ${Math.round(bot.ws.ping)}ms`);
      return;
    }

    if (interaction.commandName === 'ban') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
        await interaction.reply({ content: "❌ You need `Ban Members` permission.", ephemeral: true });
        return;
      }
      const target = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') || "No reason provided";
      const guild = interaction.guild;
      if (!guild) return;
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: "❌ User is not in this server.", ephemeral: true });
        return;
      }
      if (!member.bannable) {
        await interaction.reply({ content: "❌ I cannot ban this user (role hierarchy or permissions).", ephemeral: true });
        return;
      }
      await member.ban({ reason });
      await logModeration(guild.id, target.id, 'Banned', reason, undefined, undefined, interaction.user.id);
      await createModerationCase(guild.id, target.id, interaction.user.id, 'Banned', reason);
      await interaction.reply(`🔨 Banned **${target.tag}**. Reason: ${reason}`);
      return;
    }

    if (interaction.commandName === 'kick') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
        await interaction.reply({ content: "❌ You need `Kick Members` permission.", ephemeral: true });
        return;
      }
      const target = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') || "No reason provided";
      const guild = interaction.guild;
      if (!guild) return;
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: "❌ User is not in this server.", ephemeral: true });
        return;
      }
      if (!member.kickable) {
        await interaction.reply({ content: "❌ I cannot kick this user (role hierarchy or permissions).", ephemeral: true });
        return;
      }
      await member.kick(reason);
      await logModeration(guild.id, target.id, 'Kicked', reason, undefined, undefined, interaction.user.id);
      await createModerationCase(guild.id, target.id, interaction.user.id, 'Kicked', reason);
      await interaction.reply(`👢 Kicked **${target.tag}**. Reason: ${reason}`);
      return;
    }

    if (interaction.commandName === 'timeout') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: "❌ You need `Moderate Members` permission.", ephemeral: true });
        return;
      }
      const target = interaction.options.getUser('user', true);
      const minutes = interaction.options.getInteger('minutes', true);
      const reason = interaction.options.getString('reason') || "No reason provided";
      if (minutes < 1 || minutes > 40320) {
        await interaction.reply({ content: "❌ Minutes must be between 1 and 40320 (28 days).", ephemeral: true });
        return;
      }
      const guild = interaction.guild;
      if (!guild) return;
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: "❌ User is not in this server.", ephemeral: true });
        return;
      }
      if (!member.moderatable) {
        await interaction.reply({ content: "❌ I cannot timeout this user (role hierarchy or permissions).", ephemeral: true });
        return;
      }
      await member.timeout(minutes * 60 * 1000, reason);
      await logModeration(guild.id, target.id, 'Timed Out', reason, undefined, undefined, interaction.user.id);
      await createModerationCase(guild.id, target.id, interaction.user.id, 'Timed Out', `${minutes}m • ${reason}`);
      await interaction.reply(`⏱️ Timed out **${target.tag}** for **${minutes} min**. Reason: ${reason}`);
      return;
    }

    if (interaction.commandName === 'untimeout') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: "❌ You need `Moderate Members` permission.", ephemeral: true });
        return;
      }
      const target = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') || "Timeout removed by moderator";
      const guild = interaction.guild;
      if (!guild) return;
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: "❌ User is not in this server.", ephemeral: true });
        return;
      }
      if (!member.moderatable) {
        await interaction.reply({ content: "❌ I cannot modify timeout for this user.", ephemeral: true });
        return;
      }
      await member.timeout(null, reason);
      await logModeration(guild.id, target.id, 'Untimeout', reason, undefined, undefined, interaction.user.id);
      await createModerationCase(guild.id, target.id, interaction.user.id, 'Untimeout', reason);
      await interaction.reply(`✅ Removed timeout for **${target.tag}**.`);
      return;
    }

    if (interaction.commandName === 'purge') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.reply({ content: "❌ You need `Manage Messages` permission.", ephemeral: true });
        return;
      }
      const amount = interaction.options.getInteger('amount', true);
      if (amount < 1 || amount > 100) {
        await interaction.reply({ content: "❌ Amount must be between 1 and 100.", ephemeral: true });
        return;
      }
      if (!interaction.channel || !interaction.channel.isTextBased()) {
        await interaction.reply({ content: "❌ This command only works in text channels.", ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const deleted = await (interaction.channel as any).bulkDelete(amount, true).catch(() => null);
      await interaction.editReply(`🧹 Deleted **${deleted?.size || 0}** messages.`);
      return;
    }

    if (interaction.commandName === 'slowmode') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: "❌ You need `Manage Channels` permission.", ephemeral: true });
        return;
      }
      const seconds = interaction.options.getInteger('seconds', true);
      if (seconds < 0 || seconds > 21600) {
        await interaction.reply({ content: "❌ Seconds must be between 0 and 21600.", ephemeral: true });
        return;
      }
      const channel = interaction.channel;
      if (!channel || !channel.isTextBased() || (channel as any).setRateLimitPerUser === undefined) {
        await interaction.reply({ content: "❌ This command requires a standard text channel.", ephemeral: true });
        return;
      }
      await (channel as any).setRateLimitPerUser(seconds);
      await interaction.reply(`🐢 Slowmode set to **${seconds}s**.`);
      return;
    }

    if (interaction.commandName === 'warn') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: "❌ You need `Moderate Members` permission.", ephemeral: true });
        return;
      }
      const target = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', true);
      const guild = interaction.guild;
      if (!guild) return;
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: "❌ User is not in this server.", ephemeral: true });
        return;
      }
      const warning = await issueWarning(guild.id, target.id, interaction.user.id, reason);
      await logModeration(guild.id, target.id, 'Warned', reason);

      let escalated = "";
      const threshold = 3;
      if (warning.totalWarnings >= threshold && member.moderatable) {
        await member.timeout(10 * 60 * 1000, `Auto-timeout: ${threshold} warnings reached`).catch(() => { });
        await logModeration(guild.id, target.id, 'Timed Out', `Auto escalation after ${threshold} warnings`);
        await createModerationCase(guild.id, target.id, bot.user?.id || 'system', 'Timed Out', `Auto escalation after ${threshold} warnings`);
        escalated = `\n⚠️ Auto-escalation applied: 10 minute timeout.`;
      }

      await interaction.reply(`⚠️ Warned **${target.tag}**. Total warnings: **${warning.totalWarnings}**.${escalated}`);
      return;
    }

    if (interaction.commandName === 'warnings') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: "❌ You need `Moderate Members` permission.", ephemeral: true });
        return;
      }
      if (!supabase) {
        await interaction.reply({ content: "❌ Supabase is not configured.", ephemeral: true });
        return;
      }
      const target = interaction.options.getUser('user', true);
      const { data: rows } = await supabase
        .from('user_warnings')
        .select('*')
        .eq('guild_id', interaction.guildId)
        .eq('user_id', target.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (!rows || rows.length === 0) {
        await interaction.reply(`✅ **${target.tag}** has no warnings.`);
        return;
      }
      const lines = rows.map((w: any, i: number) => `**${i + 1}.** ${w.reason} • <t:${Math.floor(new Date(w.created_at).getTime() / 1000)}:R>`);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`Warnings • ${target.tag}`).setDescription(lines.join('\n')).setColor('#ffa502')] });
      return;
    }

    if (interaction.commandName === 'clear-warnings') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: "❌ You need `Moderate Members` permission.", ephemeral: true });
        return;
      }
      if (!supabase) {
        await interaction.reply({ content: "❌ Supabase is not configured.", ephemeral: true });
        return;
      }
      const target = interaction.options.getUser('user', true);
      await supabase.from('user_warnings').delete().eq('guild_id', interaction.guildId).eq('user_id', target.id);
      await createModerationCase(interaction.guildId!, target.id, interaction.user.id, 'Clear Warnings', 'Warnings cleared by moderator');
      await interaction.reply(`🧼 Cleared warnings for **${target.tag}**.`);
      return;
    }

    if (interaction.commandName === 'raidmode') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "❌ You need `Administrator` permission.", ephemeral: true });
        return;
      }
      if (!supabase) {
        await interaction.reply({ content: "❌ Supabase is not configured.", ephemeral: true });
        return;
      }
      const mode = (interaction.options.getString('mode', true) || '').toLowerCase();
      const guildId = interaction.guildId!;
      const { data: row } = await supabase.from('guild_security').select('*').eq('guild_id', guildId).single();
      const current = row || { guild_id: guildId, raid_mode_enabled: false, raid_join_threshold: 8, raid_window_seconds: 20 };
      if (mode === 'status') {
        await interaction.reply(`🛡️ Raid mode is currently **${current.raid_mode_enabled ? 'ON' : 'OFF'}**.\nThreshold: ${current.raid_join_threshold}/${current.raid_window_seconds}s`);
        return;
      }
      if (mode !== 'on' && mode !== 'off') {
        await interaction.reply({ content: "❌ Mode must be `on`, `off`, or `status`.", ephemeral: true });
        return;
      }
      await supabase.from('guild_security').upsert({
        guild_id: guildId,
        raid_mode_enabled: mode === 'on',
        raid_join_threshold: current.raid_join_threshold || 8,
        raid_window_seconds: current.raid_window_seconds || 20
      }, { onConflict: 'guild_id' });
      await createModerationCase(guildId, interaction.user.id, interaction.user.id, 'Raid Mode', `Set to ${mode}`);
      await interaction.reply(`🛡️ Raid mode set to **${mode.toUpperCase()}**.`);
      return;
    }

    if (interaction.commandName === 'appeal') {
      if (!supabase) {
        await interaction.reply({ content: "❌ Supabase is not configured.", ephemeral: true });
        return;
      }
      const caseId = interaction.options.getString('case_id', true);
      const reason = interaction.options.getString('reason', true);
      const { data: existing } = await supabase
        .from('moderation_cases')
        .select('id, guild_id, user_id')
        .eq('id', caseId)
        .single();
      if (!existing || existing.guild_id !== interaction.guildId) {
        await interaction.reply({ content: "❌ Case not found in this server.", ephemeral: true });
        return;
      }
      if (existing.user_id !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: "❌ You can only appeal your own cases.", ephemeral: true });
        return;
      }
      await supabase.from('moderation_appeals').insert({
        guild_id: interaction.guildId,
        case_id: caseId,
        user_id: interaction.user.id,
        reason,
        status: 'pending'
      });
      await interaction.reply({ content: `📨 Appeal submitted for case **${caseId}**.`, ephemeral: true });
      return;
    }

    if (interaction.commandName === 'emojis') {
      const emojis = interaction.guild?.emojis.cache;
      if (!emojis || emojis.size === 0) return interaction.reply({ content: "This server has no custom emojis!", ephemeral: true });

      const emojiList = emojis.map(e => `${e} | \`:${e.name}:\` | ID: \`${e.id}\``).join('\n');
      const embed = new EmbedBuilder()
        .setTitle("Server Emojis")
        .setDescription(emojiList.length > 2000 ? emojiList.substring(0, 1997) + "..." : emojiList)
        .setColor('#d0bcff');

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (interaction.commandName === 'profile') {
      if (!supabase) return;
      await interaction.deferReply();

      try {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild?.members.fetch(targetUser.id);
        const guild = interaction.guild;

        const { data: guildData } = await supabase
          .from('guilds')
          .select('active_modules')
          .eq('id', guild?.id)
          .single();

        const { data: userStats } = await supabase
          .from('levels')
          .select('xp, level')
          .eq('guild_id', interaction.guildId)
          .eq('user_id', targetUser.id)
          .single();

        const { data: profile } = await supabase
          .from('player_profiles')
          .select('bio')
          .eq('user_id', targetUser.id)
          .single();

        const canvas = guildData?.active_modules?.canvas || {};
        const branding = await getGuildBranding(interaction.guildId!);
        const joinDate = member?.joinedAt ? member.joinedAt.toLocaleDateString() : 'Unknown';
        const levelText = `Level ${userStats?.level || 0} · ${(userStats?.xp || 0).toLocaleString()} XP`;

        const buffer = await buildWelcomeCard({
          username: targetUser.username,
          avatarUrl: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
          title: 'MEMBER PROFILE',
          description: profile?.bio || `${levelText} · Joined ${joinDate}`,
          accentColor: canvas.profile_accent_color || canvas.level_up_accent_color || canvas.welcome_accent_color || '#d0bcff',
          textColor: canvas.profile_text_color || canvas.level_up_text_color || '#ffffff',
          backgroundUrl: canvas.profile_background_url || canvas.level_up_background_url || canvas.welcome_background_url || undefined,
          brandName: branding?.brand_name || undefined
        });

        const attachment = new AttachmentBuilder(buffer, { name: `profile-${targetUser.id}.png` });
        await interaction.editReply({ files: [attachment] });
      } catch (err) {
        console.error("[Profile] Error:", err);
        await interaction.editReply("Failed to generate profile card.");
      }
      return;
    }
  }

  // --- BUTTON HANDLING ---
  if (interaction.isButton()) {
    console.log(`[Button] ${interaction.customId} in guild ${interaction.guildId}`);
    if (interaction.customId.startsWith('role_btn_')) {
      if (!supabase) return;
      const buttonId = interaction.customId.replace('role_btn_', '');

      try {
        const { data: button, error } = await supabase
          .from('role_panel_buttons')
          .select('role_id')
          .eq('id', buttonId)
          .single();

        if (error || !button) return interaction.reply({ content: "❌ Role configuration not found.", ephemeral: true });

        const member = interaction.member as any;
        const role = interaction.guild?.roles.cache.get(button.role_id);

        if (!role) return interaction.reply({ content: "❌ Role no longer exists in this server.", ephemeral: true });

        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          await interaction.reply({ content: `✅ Removed the **${role.name}** role.`, ephemeral: true });
        } else {
          try {
            await member.roles.add(role);
            await interaction.reply({ content: `✅ Added the **${role.name}** role.`, ephemeral: true });
          } catch (e) {
            await interaction.reply({ content: `❌ I don't have permission to give you the **${role.name}** role. Make sure my role is higher than it!`, ephemeral: true });
          }
        }
      } catch (err) {
        console.error("Role button error:", err);
        if (!interaction.replied) {
          interaction.reply({ content: "❌ Failed to update roles.", ephemeral: true });
        }
      }
      return;
    }

    if (interaction.customId === 'create_ticket') {
      try {
        console.log(`[Interaction] Creating ticket for user: ${interaction.user.tag}`);
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        if (!guild) {
          await interaction.editReply({ content: 'Could not find server.' }).catch(() => { });
          return;
        }

        // Find a "Tickets" category or use null (no category)
        const category = guild.channels.cache.find(
          (c: any) => c.type === 4 && (c.name.toLowerCase().includes('ticket') || c.name.toLowerCase().includes('support'))
        ) as any;

        // Create a private text channel visible only to the user + admins
        const ticketChannel = await guild.channels.create({
          name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: category?.id ?? null,
          permissionOverwrites: [
            {
              id: guild.id, // @everyone
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: interaction.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            },
            {
              id: bot.user!.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
            },
          ],
          reason: 'Support ticket',
        });

        console.log(`[Interaction] Private channel created: ${ticketChannel.id}`);

        // Store to DB
        if (supabase) {
          await supabase.from('tickets').insert({
            guild_id: interaction.guildId,
            user_id: interaction.user.id,
            channel_thread_id: ticketChannel.id,
            status: 'open'
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('🎫 Support Ticket')
          .setDescription(`Welcome ${interaction.user}! A moderator will be with you shortly.\n\nDescribe your issue here and we'll help you as soon as possible.`)
          .setColor('#8B5CF6')
          .setFooter({ text: 'Click "Close Ticket" when your issue has been resolved.' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
        );

        await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
        await interaction.editReply({ content: `🎫 Ticket created! Head over to <#${ticketChannel.id}>` });
        console.log(`[Interaction] Ticket setup complete for ${interaction.user.tag}`);
      } catch (err: any) {
        console.error('[Interaction] Error creating ticket:', err.message, err);
        await interaction.editReply({ content: `❌ Failed to create ticket: ${err.message}` }).catch(() => { });
      }
      return;
    }

    if (interaction.customId === 'close_ticket') {
      try {
        console.log(`[Interaction] Closing ticket in channel: ${interaction.channelId}`);
        await interaction.deferReply();
        const channel = interaction.channel as any;

        if (supabase) {
          await supabase.from('tickets').update({ status: 'closed' }).eq('channel_thread_id', interaction.channelId);
        }

        await interaction.editReply("🔒 Ticket closed. This channel will be deleted in 5 seconds...");
        setTimeout(() => channel.delete().catch(() => { }), 5000);
      } catch (err: any) {
        console.error("[Interaction] Error closing ticket:", err.message, err);
      }
      return;
    }

    // --- Dynamic Voice Interactions ---
    if (interaction.customId.startsWith('voice_')) {
      if (!supabase) return;
      const channel = interaction.channel;
      if (!channel || !channel.isVoiceBased()) return;

      const { data: tempChan, error: lookupErr } = await supabase
        .from('temporary_voice_channels')
        .select('owner_id')
        .eq('id', channel.id)
        .maybeSingle();

      if (lookupErr) {
        console.error(`[DB Error] Lookup failed for channel ${channel.id}:`, lookupErr);
        return interaction.reply({ content: "❌ Database error while looking up channel ownership.", ephemeral: true });
      }

      if (!tempChan) {
        console.warn(`[Voice-Panel] Interaction from unmanaged channel: ${channel.id}`);
        return interaction.reply({ content: "❌ This channel is not managed by the Dynamic Voice system (or has been abandoned).", ephemeral: true });
      }

      if (interaction.customId === 'voice_info') {
        const infoEmbed = new EmbedBuilder()
          .setTitle("<:info:1491019345713692805> Voice Control Guide")
          .setDescription("Your premium lounge comes with a full suite of management tools. Use the buttons to control access, name, and more.")
          .addFields(
            { name: `<:rename:1491019634823008296> Rename`, value: "Set a custom name.", inline: true },
            { name: `<:lock:1491019472016900128> Lock / <:unlock:1491019728599126076> Unlock`, value: "Toggle join access.", inline: true },
            { name: `<:hide:1491019317305802882> Hide / <:show:1491019697871913122> Show`, value: "Toggle visibility.", inline: true },
            { name: `<:camera:1491019253334409286> Camera`, value: "Toggle stream perms.", inline: true },
            { name: `<:activities:1491019213953957888> Activities`, value: "Launch Discord apps.", inline: true },
            { name: `<:claim:1491019282170249348> Claim`, value: "Assume ownership.", inline: true },
            { name: `<:limit:1491019439859302420> Limit`, value: "Set user capacity.", inline: true },
            { name: `<:kick:1491019404459376701> Kick`, value: "Remove specific users.", inline: true },
            { name: `<:invite:1491019376571318373> Invite`, value: "Get a temporary link.", inline: true },
            { name: `<:music:1491019524940496977> Music`, value: "Coming soon!", inline: true },
            { name: `<:perms:1491019592884293722> / <:settings:1491019663906181280> Settings`, value: "Advanced web dash.", inline: true }
          )
          .setFooter({ text: "Dynamic Voice • Radiance Pro" })
          .setColor('#d0bcff');
        return interaction.reply({ embeds: [infoEmbed], ephemeral: true });
      }

      // Claim logic
      if (interaction.customId === 'voice_claim') {
        const currentOwnerInChannel = channel.members.has(tempChan.owner_id);
        if (!currentOwnerInChannel) {
          await supabase.from('temporary_voice_channels').update({ owner_id: interaction.user.id }).eq('id', channel.id);
          return interaction.reply({ content: `<:claim:1491019282170249348> You are now the **owner** of this channel!`, ephemeral: true });
        }
        return interaction.reply({ content: "❌ The current owner is still in the channel!", ephemeral: true });
      }

      // Ownership Check
      if (interaction.user.id !== tempChan.owner_id) {
        return interaction.reply({ content: "❌ Only the channel owner can use these controls!", ephemeral: true });
      }

      if (interaction.customId === 'voice_lock') {
        await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, { Connect: false });
        // Update Embed status if possible
        return interaction.reply({ content: "<:lock:1491019472016900128> Channel **locked**. No new members can join.", ephemeral: true });
      }

      if (interaction.customId === 'voice_unlock') {
        await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, { Connect: null });
        return interaction.reply({ content: "<:unlock:1491019728599126076> Channel **unlocked**. Everyone can join.", ephemeral: true });
      }

      if (interaction.customId === 'voice_hide') {
        await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, { ViewChannel: false });
        return interaction.reply({ content: "<:hide:1491019317305802882> Channel **hidden** from the channel list.", ephemeral: true });
      }

      if (interaction.customId === 'voice_show') {
        await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, { ViewChannel: true });
        return interaction.reply({ content: "<:show:1491019697871913122> Channel is now **visible** to everyone.", ephemeral: true });
      }

      if (interaction.customId === 'voice_rename') {
        const modal = new ModalBuilder().setCustomId('modal_voice_rename').setTitle('Rename Channel');
        const input = new TextInputBuilder().setCustomId('name').setLabel('New Name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'voice_limit') {
        const modal = new ModalBuilder().setCustomId('modal_voice_limit').setTitle('Set capacity');
        const input = new TextInputBuilder().setCustomId('limit').setLabel('User Limit (0-99)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'voice_kick') {
        const others = channel.members.filter(m => m.id !== tempChan.owner_id);
        if (others.size === 0) return interaction.reply({ content: "❌ No one else is in the channel!", ephemeral: true });
        const select = new StringSelectMenuBuilder().setCustomId('select_voice_kick').setPlaceholder('Select someone to kick...');
        others.forEach(m => select.addOptions({ label: m.user.tag, value: m.id }));
        return interaction.reply({ content: "Select a member to remove:", components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)], ephemeral: true });
      }

      if (interaction.customId === 'voice_invite') {
        const invite = await channel.createInvite({ maxAge: 3600, maxUses: 5, unique: true });
        return interaction.reply({ content: `<:invite:1491019376571318373> **Invite Link Created:**\n${invite.url}\n*(Valid for 1 hour, 5 uses)*`, ephemeral: true });
      }

      if (interaction.customId === 'voice_camera') {
        const currentPerm = channel.permissionOverwrites.cache.get(interaction.guild!.roles.everyone.id)?.allow.has(PermissionFlagsBits.Stream);
        await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, { Stream: !currentPerm });
        return interaction.reply({ content: `${!currentPerm ? '<:camera:1491019253334409286>' : '❌'} **Camera/Stream** permission ${!currentPerm ? 'enabled' : 'disabled'} for everyone.`, ephemeral: true });
      }

      if (interaction.customId === 'voice_activities') {
        return interaction.reply({ content: "🚀 **Activities:** Use the Rocket icon in your Discord voice controls to start a game or watch videos with friends!", ephemeral: true });
      }

      if (interaction.customId === 'voice_music') {
        return interaction.reply({ content: "🎵 **Music:** This feature is currently undergoing maintenance. Stay tuned for updates!", ephemeral: true });
      }

      if (interaction.customId === 'voice_perms' || interaction.customId === 'voice_settings') {
        return interaction.reply({ content: "⚙️ **Advanced Settings:** Please use the web dashboard to manage advanced channel permissions and settings.", ephemeral: true });
      }
    }
  }

  // --- Modal & Select Menu Handling ---
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'modal_voice_rename') {
      const name = interaction.fields.getTextInputValue('name');
      await (interaction.channel as any).setName(name);
      return interaction.reply({ content: `✅ Channel renamed to **${name}**.`, ephemeral: true });
    }
    if (interaction.customId === 'modal_voice_limit') {
      const limitRaw = interaction.fields.getTextInputValue('limit');
      const limit = parseInt(limitRaw);
      if (isNaN(limit) || limit < 0 || limit > 99) return interaction.reply({ content: "❌ Invalid limit (0-99).", ephemeral: true });
      await (interaction.channel as any).setUserLimit(limit);
      return interaction.reply({ content: `✅ Limit set to **${limit || 'unlimited'}**.`, ephemeral: true });
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_voice_kick') {
      const targetId = interaction.values[0];
      const member = interaction.guild?.members.cache.get(targetId);
      if (member && member.voice.channelId === interaction.channelId) {
        await member.voice.disconnect();
        return interaction.reply({ content: `🚫 **${member.user.username}** has been kicked.`, ephemeral: true });
      }
      return interaction.reply({ content: "❌ That user is no longer in the channel.", ephemeral: true });
    }
  }

});



bot.on('messageCreate', async (message) => {
  if (!message.guildId) return;
  trackActivity(message.guildId, 'message');

  // --- Dynamic Voice Commands ---
  if (message.content.startsWith('.v ')) {
    const args = message.content.slice(3).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    // Check if user is in a voice channel
    const member = message.member;
    if (!member?.voice.channelId) {
      return message.reply("You must be in a voice channel to use this command.");
    }

    // Check if it's a dynamic voice channel
    if (supabase) {
      const { data: channelData } = await supabase
        .from('temporary_voice_channels')
        .select('owner_id')
        .eq('id', member.voice.channelId)
        .single();

      if (channelData) {
        if (channelData.owner_id !== member.id) {
          return message.reply("You are not the owner of this voice channel.");
        }

        if (command === 'name') {
          const newName = args.join(' ');
          if (!newName) return message.reply("Please provide a new name.");
          await member.voice.channel?.setName(newName);
          return message.reply(`Channel renamed to ${newName}.`);
        } else if (command === 'permit') {
          const targetUser = message.mentions.members?.first();
          if (!targetUser) return message.reply("Please mention a user to permit.");
          await member.voice.channel?.permissionOverwrites.edit(targetUser.id, { Connect: true });
          return message.reply(`Permitted ${targetUser} to join.`);
        } else if (command === 'reject') {
          const targetUser = message.mentions.members?.first();
          if (!targetUser) return message.reply("Please mention a user to reject.");
          await member.voice.channel?.permissionOverwrites.edit(targetUser.id, { Connect: false });
          if (targetUser.voice.channelId === member.voice.channelId) {
            await targetUser.voice.setChannel(null);
          }
          return message.reply(`Rejected ${targetUser} from joining and disconnected them.`);
        } else if (command === 'lock') {
          await member.voice.channel?.permissionOverwrites.edit(message.guild!.id, { Connect: false });
          return message.reply("Channel locked.");
        } else if (command === 'unlock') {
          await member.voice.channel?.permissionOverwrites.edit(message.guild!.id, { Connect: true });
          return message.reply("Channel unlocked.");
        }
      }
    }
  }

  // --- Slash-like Voice Commands ---
  if (message.content.startsWith('/')) {
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    // Check if user is in a voice channel
    const member = message.member;
    if (!member?.voice.channelId) {
      return message.reply("You must be in a voice channel to use this command.");
    }

    // Check if it's a dynamic voice channel
    if (supabase) {
      const { data: channelData } = await supabase
        .from('temporary_voice_channels')
        .select('owner_id')
        .eq('id', member.voice.channelId)
        .single();

      if (channelData) {
        if (channelData.owner_id !== member.id) {
          return message.reply("You are not the owner of this voice channel.");
        }

        if (command === 'move') {
          const targetUser = message.mentions.members?.first();
          if (!targetUser) return message.reply("Please mention a user to move.");
          await targetUser.voice.setChannel(member.voice.channelId);
          return message.reply(`Moved ${targetUser} to your channel.`);
        }
      }
    }
  }

  // --- Ticket Message Logging ---
  const channel = message.channel as any;
  if (channel?.name?.startsWith('ticket-') && supabase) {
    try {
      const { data: ticket } = await supabase
        .from('tickets')
        .select('id')
        .eq('channel_thread_id', message.channelId)
        .single();

      if (ticket) {
        await supabase.from('ticket_messages').insert({
          ticket_id: ticket.id,
          sender_id: message.author.id,
          sender_name: message.author.username,
          message: message.content,
          is_mod: message.author.bot, // If the bot sent it, it was a mod reply via dashboard or command
          created_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("[Tickets] Error logging message:", err);
    }
  }

  if (message.author.bot) return;

  // --- Advanced Security Checks ---
  const securitySettings = await getSecuritySettings(message.guildId);

  // Check global blacklist
  if (securitySettings.cross_server_blacklist && isGloballyBlacklisted(message.author.id)) {
    await message.delete().catch(() => { });
    await message.member?.ban({ reason: 'Globally blacklisted user' }).catch(() => { });
    return;
  }

  // Check quarantine mode
  if (securitySettings.quarantine_mode && isQuarantined(message.author.id, message.guildId)) {
    await message.delete().catch(() => { });
    addPendingMessage(message.author.id, message.id);
    await message.author.send("Your message is pending moderator review.").catch(() => { });
    return;
  }

  // Honeytrap detection
  if (securitySettings.honeytrap_enabled && securitySettings.honeytrap_channel_ids.includes(message.channelId)) {
    const incident = await openIncident(
      message.guildId,
      'Honeytrap channel triggered',
      'high',
      90,
      'lockdown_channels',
      `${message.author.username} posted in configured honeytrap channel ${message.channelId}.`
    );
    await logRuntimeEvent(message.guildId, 'honeytrap_trigger', 'critical', message.author.id, {
      channelId: message.channelId
    });
    recordHoneytrapTrigger(message.guildId);
    await message.member?.ban({ reason: 'Posted in honeytrap channel' }).catch(() => { });
    await message.delete().catch(() => { });
    const embed = new EmbedBuilder()
      .setTitle("🍯 Honeytrap Triggered")
      .setDescription(`${message.author} was banned for posting in a honeypot channel.`)
      .setColor('#ff4757')
      .setTimestamp();
    logEvent(message.guildId, 'server', embed);
    await executeIncidentPlaybook(message.guildId, incident?.id || null, 'lockdown_channels');
    return;
  }

  // Check for links and verify reputation
  if (securitySettings.link_reputation_enabled) {
    const urls = extractUrls(message.content);
    for (const url of urls) {
      // Check allowlist first
      if (securitySettings.link_allowlist.some(allowed => url.includes(allowed))) {
        continue;
      }
      // Check blocklist
      if (securitySettings.link_blocklist.some(blocked => url.includes(blocked))) {
        await message.delete().catch(() => { });
        await message.channel.send(`${message.author}, that link is blocked.`).then(m => setTimeout(() => m.delete().catch(() => { }), 5000));
        await logModeration(message.guildId, message.author.id, 'Warned', 'Blocked URL', undefined, message.guild);
        return;
      }
      // Check reputation
      const reputation = await checkLinkReputation(url);
      if (!reputation.safe && reputation.score < 40) {
        await message.delete().catch(() => { });
        await message.channel.send(`${message.author}, that link appears to be suspicious.`).then(m => setTimeout(() => m.delete().catch(() => { }), 5000));
        await logModeration(message.guildId, message.author.id, 'Warned', `Suspicious URL (score: ${reputation.score})`, undefined, message.guild);
        return;
      }
    }
  }

  // Captcha verification for links
  if (securitySettings.captcha_on_links && extractUrls(message.content).length > 0) {
    const pending = getCaptchaPending(message.author.id);
    if (!pending) {
      const svg = setCaptchaPending(message.author.id, message.guildId, message.content, message.channelId);
      await message.delete().catch(() => { });
      await message.author.send({
        content: "Please solve this captcha to post links:",
        files: [{ attachment: Buffer.from(svg), name: 'captcha.svg' }]
      }).catch(() => { });
      return;
    }
  }

  // ML Spam Detection
  if (securitySettings.ml_spam_detection) {
    const analysis = analyzeMessageWithML(message.content);
    if (analysis.spamScore > 70) {
      await logRuntimeEvent(message.guildId, 'ml_spam_flag', 'warning', message.author.id, {
        spamScore: analysis.spamScore
      });
      await message.delete().catch(() => { });
      await message.channel.send(`${message.author}, your message was flagged as spam.`).then(m => setTimeout(() => m.delete().catch(() => { }), 5000));
      await logModeration(message.guildId, message.author.id, 'Warned', `ML Spam Detection (score: ${analysis.spamScore})`, undefined, message.guild);
      return;
    }
  }

  // Behavioral Fingerprinting
  if (securitySettings.behavioral_fingerprinting) {
    const behavior = trackUserBehavior(message.author.id, message.content, message.channelId);
    if (behavior.suspiciousScore > 60) {
      await message.delete().catch(() => { });
      await logModeration(message.guildId, message.author.id, 'Warned', `Suspicious behavior pattern`, undefined, message.guild);
      return;
    }
  }

  // Velocity Tracking
  if (securitySettings.velocity_tracking) {
    const behavior = trackUserBehavior(message.author.id, message.content, message.channelId);
    if (behavior.velocity > 10) { // More than 10 messages per minute
      await message.delete().catch(() => { });
      await message.channel.send(`${message.author}, you're sending messages too quickly.`).then(m => setTimeout(() => m.delete().catch(() => { }), 5000));
      return;
    }
  }

  let prefix = '!';
  let activeModules: any = null;
  let xpRate = 1.0;

  // Fetch guild config from Supabase
  if (supabase) {
    try {
      const { data: guildData } = await supabase
        .from('guilds')
        .select('prefix, active_modules, xp_rate')
        .eq('id', message.guildId)
        .single();

      if (guildData) {
        if (guildData.prefix) prefix = guildData.prefix;
        if (guildData.active_modules) activeModules = guildData.active_modules;
        if (guildData.xp_rate) xpRate = guildData.xp_rate;
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  }

  // --- Leveling System ---
  if (activeModules?.leveling !== false && supabase) {
    const now = Date.now();
    const cooldownKey = `${message.guildId}-${message.author.id}`;
    const lastXp = xpCooldowns.get(cooldownKey) || 0;

    // 1-minute cooldown for gaining XP
    if (now - lastXp > 60000) {
      xpCooldowns.set(cooldownKey, now);

      try {
        const { data: userData } = await supabase
          .from('levels')
          .select('xp, level')
          .eq('guild_id', message.guildId)
          .eq('user_id', message.author.id)
          .single();

        const currentXp = userData?.xp || 0;
        const currentLevel = userData?.level || 0;
        const baseGainedXp = Math.floor(Math.random() * 11) + 15; // 15 to 25 XP
        const gainedXp = Math.floor(baseGainedXp * xpRate);
        const newXp = currentXp + gainedXp;

        // Simple leveling formula: base 100 * level^1.5
        const nextLevelXp = Math.floor(100 * Math.pow(currentLevel + 1, 1.5));
        let newLevel = currentLevel;
        let leveledUp = false;

        if (newXp >= nextLevelXp) {
          newLevel++;
          leveledUp = true;
        }

        await supabase.from('levels').upsert({
          guild_id: message.guildId,
          user_id: message.author.id,
          xp: newXp,
          level: newLevel,
          last_updated: new Date().toISOString()
        }, { onConflict: 'guild_id,user_id' });

        if (leveledUp) {
          // --- Achievement Tracking ---
          const achievementMilestones = [5, 10, 25, 50, 100];
          if (achievementMilestones.includes(newLevel)) {
            try {
              // Get guild branding
              const { data: guildData } = await supabase
                .from('guilds')
                .select('active_modules')
                .eq('id', message.guildId)
                .single();

              const canvas = guildData?.active_modules?.canvas || {};

              const { data: profile } = await supabase
                .from('player_profiles')
                .select('*')
                .eq('user_id', message.author.id)
                .single();

              // Generate Achievement Card
              const levelCard = await new LevelUp()
                .setAvatar(message.author.displayAvatarURL({ extension: 'png' }))
                .setUsername(message.author.username)
                .setBackground("image", profile?.background_url || canvas.welcome_background_url || "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1000&auto=format&fit=crop")
                .setBorder(profile?.accent_color || canvas.welcome_accent_color || "#d0bcff")
                .setAvatarBorder(profile?.accent_color || canvas.welcome_accent_color || "#d0bcff")
                .setLevels(currentLevel, newLevel)
                .build();

              const attachment = new AttachmentBuilder(levelCard, { name: `achievement-${message.author.id}.png` });
              await message.channel.send({
                content: `🎊 **ACHIEVEMENT UNLOCKED!** ${message.author} has reached **Level ${newLevel}**!`,
                files: [attachment]
              });

              // Log to achievements table
              await supabase.from('achievements').insert({
                guild_id: message.guildId,
                user_id: message.author.id,
                type: 'level_milestone',
                data: { level: newLevel }
              });
            } catch (err) {
              console.error("[Achievements] Error generating milestone card:", err);
            }
          }

          // --- Role Rewards & Custom Messages ---
          try {
            // 1. Check for rewards
            const { data: rewards } = await supabase
              .from('level_rewards')
              .select('role_id')
              .eq('guild_id', message.guildId)
              .eq('level', newLevel);

            const roleRewards = rewards || [];
            if (roleRewards.length > 0 && message.member) {
              for (const reward of roleRewards) {
                await message.member.roles.add(reward.role_id, `Level Up Reward: Level ${newLevel}`).catch(err => {
                  console.error(`[Leveling] Failed to add role ${reward.role_id} to ${message.author.tag}:`, err);
                });
              }
            }

            // 2. Fetch custom message settings
            const { data: guildSettings } = await supabase
              .from('guilds')
              .select('level_up_message, level_up_channel, active_modules')
              .eq('id', message.guildId)
              .single();

            let channelToNotify = message.channel;
            if (guildSettings?.level_up_channel) {
              const customChan = message.guild?.channels.cache.get(guildSettings.level_up_channel);
              if (customChan?.isTextBased()) channelToNotify = customChan as any;
            }

            const canvas = guildSettings?.active_modules?.canvas || {};
            const branding = await getGuildBranding(message.guild.id);
            const msgTemplate = guildSettings?.level_up_message || "🎉 Congratulations {user}, you've advanced to Level **{level}**!";
            const formattedMsg = msgTemplate
              .replace('{user}', `<@${message.author.id}>`)
              .replace('{level}', newLevel.toString());

            const levelCard = await buildWelcomeCard({
              username: message.author.username,
              avatarUrl: message.author.displayAvatarURL({ extension: 'png' }),
              title: 'LEVEL UP!',
              description: `Congratulations! You've reached Level ${newLevel}!`,
              accentColor: canvas.level_up_accent_color || canvas.welcome_accent_color || '#d0bcff',
              brandName: branding?.brand_name || undefined
            });

            const embed = new EmbedBuilder()
              .setTitle("LEVEL UP!")
              .setDescription(formattedMsg)
              .setColor(canvas.level_up_accent_color as any || '#d0bcff')
              .setThumbnail(message.author.displayAvatarURL())
              .setTimestamp();

            if (canvas.level_up_background_url) {
              embed.setImage(canvas.level_up_background_url);
            }

            channelToNotify.send({ embeds: [embed] }).catch(() => { });
          } catch (err) {
            console.error("[Leveling] Error handling level up rewards/messages:", err);
            // Fallback notification
            message.channel.send(`🎉 Congratulations ${message.author}, you've advanced to Level **${newLevel}**!`).catch(() => { });
          }
        }
      } catch (err) {
        console.error("Error processing leveling:", err);
      }
    }
  }

  // --- Economy Commands ---
  if (message.content.startsWith(`${prefix}shop`)) {
    if (!supabase) return;
    try {
      const { data: items } = await supabase.from('shop_items').select('*').eq('guild_id', message.guildId);
      if (!items || items.length === 0) return message.reply("🛒 The shop is currently empty! Use the dashboard to add some items.");

      const embed = new EmbedBuilder()
        .setTitle(`🛒 ${message.guild?.name} Shop`)
        .setColor('#ffd700')
        .setDescription(`Welcome to the server store! Use \`${prefix}buy <item_name>\` to purchase an item using your XP. Your current XP: **${(await supabase.from('levels').select('xp').eq('guild_id', message.guildId).eq('user_id', message.author.id).single()).data?.xp || 0} XP**`)
        .setTimestamp();

      items.forEach(item => {
        const stockStr = item.stock === -1 ? "Infinite" : item.stock.toString();
        embed.addFields({
          name: `${item.icon || '📦'} ${item.name}`,
          value: `**Price:** ${item.price} XP | **Stock:** ${stockStr}\n${item.description || '*No description provided.*'}`,
          inline: true
        });
      });

      message.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[Shop] Error:", err);
    }
  }

  if (message.content.startsWith(`${prefix}buy `)) {
    if (!supabase) return;
    const itemName = message.content.slice(`${prefix}buy `.length).trim();

    try {
      const { data: item } = await supabase
        .from('shop_items')
        .select('*')
        .eq('guild_id', message.guildId)
        .ilike('name', itemName)
        .single();

      if (!item) return message.reply(`❌ Item **${itemName}** not found in the shop.`);

      // 1. Balance check
      const { data: userData } = await supabase.from('levels').select('xp').eq('guild_id', message.guildId).eq('user_id', message.author.id).single();
      const currentXp = userData?.xp || 0;
      if (currentXp < item.price) return message.reply(`❌ You need **${item.price} XP** to buy this. You currently have **${currentXp} XP**.`);

      // 2. Stock check
      if (item.stock !== -1 && item.stock <= 0) return message.reply(`❌ Sorry, **${item.name}** is currently out of stock!`);

      // 3. Process Transaction
      const { error: balanceError } = await supabase.from('levels').update({ xp: currentXp - item.price }).eq('guild_id', message.guildId).eq('user_id', message.author.id);
      if (balanceError) throw balanceError;

      if (item.stock !== -1) {
        await supabase.from('shop_items').update({ stock: item.stock - 1 }).eq('id', item.id);
      }

      await supabase.from('user_inventory').insert({
        guild_id: message.guildId,
        user_id: message.author.id,
        item_id: item.id,
        purchased_at: new Date().toISOString()
      });

      // 4. Role Assignment (if configured)
      let roleMsg = "";
      if (item.role_id) {
        const role = message.guild?.roles.cache.get(item.role_id);
        if (role) {
          await message.member?.roles.add(role, `Shop Purchase: ${item.name}`).then(() => {
            roleMsg = `\n✅ You have been granted the **${role.name}** role!`;
          }).catch(err => {
            console.error("[Buy] Failed to add role:", err);
            roleMsg = `\n⚠️ I couldn't add the role reward. Please contact an admin!`;
          });
        }
      }

      message.reply(`🎁 **Success!** You just purchased **${item.name}** for **${item.price} XP**. Check your inventory!${roleMsg}`);

      // Log to server if audit logging is enabled
      const logEmbed = new EmbedBuilder()
        .setTitle("💰 Store Purchase")
        .setColor('#ffd700')
        .setDescription(`${message.author} purchased **${item.name}** for **${item.price} XP**`)
        .setTimestamp();
      logEvent(message.guildId, 'server', logEmbed);

    } catch (err) {
      console.error("[Buy] Error:", err);
      message.reply("❌ There was an error processing your purchase. Please try again later.");
    }
  }

  // --- AI Support Integration ---
  if (activeModules?.ai !== false && supabase && genAI) {
    try {
      const { data: aiConfig } = await supabase
        .from('guilds')
        .select('ai_enabled, ai_channel_id, ai_knowledge_base, ai_model')
        .eq('id', message.guildId)
        .single();

      if (aiConfig?.ai_enabled) {
        const isTargetChannel = aiConfig.ai_channel_id ? message.channelId === aiConfig.ai_channel_id : false;
        const isMentioned = message.mentions.has(bot.user!.id);

        if (isTargetChannel || (isMentioned && !aiConfig.ai_channel_id)) {
          // Only respond if it's the target channel OR bot is mentioned (if no specific channel is set)
          message.channel.sendTyping();

          const prompt = `
               You are the Radiance Discord Bot, a premium server management assistant.
               Server Name: ${message.guild?.name}
               User: ${message.author.username}
               
               Knowledge Base / Context:
               ${aiConfig.ai_knowledge_base || "No specific instructions provided. Be helpful and professional."}
               
               User Question: ${message.content.replace(`<@${bot.user!.id}>`, '').trim()}
               
               Keep responses concise, professional, and friendly. Use Discord markdown.
             `;

          const result = await genAI.models.generateContent({
            model: aiConfig.ai_model || "gemini-3-flash-preview",
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
          });

          const text = result.text;

          if (text) {
            const chunks = text.match(/[\s\S]{1,2000}/g) || [];
            for (const chunk of chunks) {
              await message.reply(chunk).catch(() => { });
            }
          }
        }
      }
    } catch (err) {
      console.error("[AI Support] Error:", err);
    }
  }

  // --- Auto-Moderation ---
  if (activeModules?.moderation && activeModules?.automod) {
    const automod = activeModules.automod;
    const content = message.content.toLowerCase();

    // Bad Words Filter
    if (automod.badWords) {
      // Fetch custom bad words from guild config or use a more robust default list
      const defaultBadWords = ['fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'bastard'];
      const customBadWords = automod.customBadWords || [];
      const badWords = [...new Set([...defaultBadWords, ...customBadWords])];

      if (badWords.some(word => content.includes(word.toLowerCase()))) {
        await message.delete().catch(() => { });
        await message.channel.send(`${message.author}, please watch your language!`).then(m => setTimeout(() => m.delete().catch(() => { }), 5000));
        await logModeration(message.guildId, message.author.id, 'Warned', 'Bad Words', automod.maxWarnings, message.guild);
        return; // Stop processing
      }
    }

    // Link Spam Filter
    if (automod.linkSpam) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      if (urlRegex.test(content)) {
        // Allow discord links maybe? For now, just block all if enabled
        await message.delete().catch(() => { });
        await message.channel.send(`${message.author}, unauthorized links are not allowed here.`).then(m => setTimeout(() => m.delete().catch(() => { }), 5000));
        await logModeration(message.guildId, message.author.id, 'Warned', 'Link Spam', automod.maxWarnings, message.guild);
        return;
      }
    }

    // Caps Spam Filter
    if (automod.capsSpam) {
      const capsCount = message.content.replace(/[^A-Z]/g, '').length;
      const totalChars = message.content.replace(/[^a-zA-Z]/g, '').length;
      if (totalChars > 10 && (capsCount / totalChars) > 0.7) {
        await message.delete().catch(() => { });
        await message.channel.send(`${message.author}, please don't use excessive caps.`).then(m => setTimeout(() => m.delete().catch(() => { }), 5000));
        await logModeration(message.guildId, message.author.id, 'Warned', 'Caps Spam', automod.maxWarnings, message.guild);
        return;
      }
    }

    // Emoji Spam Filter
    if (automod.emojiSpam) {
      const emojiRegex = /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu;
      const emojiCount = (message.content.match(emojiRegex) || []).length;
      if (emojiCount > 5) {
        await message.delete().catch(() => { });
        await message.channel.send(`${message.author}, please limit your emoji usage!`).then(m => setTimeout(() => m.delete().catch(() => { }), 5000));
        await logModeration(message.guildId, message.author.id, 'Warned', 'Emoji Spam', automod.maxWarnings, message.guild);
        return;
      }
    }
  }

  // --- Economy '!' commands ---
  if (message.content.startsWith('!')) {
    const args = message.content.slice(1).trim().split(/ +/);
    const rawCommand = args.shift()?.toLowerCase() || '';

    const guildId = message.guildId;
    const userId = message.author.id;
    const command = await resolveMappedCommand(guildId, rawCommand);

    const prefixAccess = await evaluateCommandAccess(
      guildId,
      message.member as any,
      command,
      {
        cachedActiveModules: activeModules,
        levelingCommands: LEVELING_PREFIX_COMMANDS,
        permissionCommands: ECONOMY_PREFIX_COMMANDS
      }
    );
    if (!prefixAccess.allowed) {
      await logRuntimeEvent(guildId, 'policy_denied', 'warning', message.author.id, {
        command,
        reason: prefixAccess.reason || 'blocked'
      });
      return message.reply(prefixAccess.reason || "❌ Command blocked.");
    } else if (command && supabase) {
      const { data: customCmd } = await supabase!
        .from('custom_commands')
        .select('*')
        .eq('guild_id', guildId)
        .eq('trigger', command)
        .maybeSingle();

      if (customCmd) {
        const cooldownSeconds = Math.max(0, Number(customCmd.cooldown || 0));
        const cooldownKey = `${guildId}:${userId}:${command}`;
        const nowMs = Date.now();
        const availableAt = customCommandCooldowns.get(cooldownKey) || 0;
        if (availableAt > nowMs) {
          const remaining = Math.ceil((availableAt - nowMs) / 1000);
          return message.reply(`⏳ This command is on cooldown for ${remaining}s.`);
        }

        if (cooldownSeconds > 0) {
          customCommandCooldowns.set(cooldownKey, nowMs + cooldownSeconds * 1000);
        }

        if (customCmd.is_embed) {
          const embed = new EmbedBuilder()
            .setDescription(customCmd.response || "No response configured.")
            .setColor((customCmd.embed_color as any) || '#8B5CF6');
          if (customCmd.embed_title) {
            embed.setTitle(customCmd.embed_title);
          }
          await message.reply({ embeds: [embed] });
        } else {
          await message.reply(customCmd.response || "No response configured.");
        }
        return;
      }
    }

    if (command === 'help') {
      const embed = new EmbedBuilder()
        .setTitle("🪙 Economy System Help")
        .setColor("#fbbf24")
        .setDescription("Manage your wealth and rewards with these commands:")
        .addFields(
          { name: "💰 Balance", value: "`!bal` or `!balance` - Check your wallet and bank balance.", inline: true },
          { name: "📅 Daily", value: "`!daily` - Claim your daily reward of 500 coins.", inline: true },
          { name: "💼 Work", value: "`!work` - Work to earn a random amount of coins.", inline: true },
          { name: "💸 Pay", value: "`!pay @user <amount>` - Transfer coins to another user.", inline: true },
          { name: "🏆 Leaderboard", value: "`!top` - View the top 5 wealthiest users.", inline: true },
          { name: "🛒 XP Shop", value: `\`${prefix}shop\` - View items available for purchase with XP.`, inline: true },
          { name: "🎁 Buy", value: `\`${prefix}buy <item_name>\` - Purchase an item from the XP shop.`, inline: true }
        )
        .setFooter({ text: `Server Prefix: ${prefix}` })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    if (command === 'bal' || command === 'balance') {
      const { data: profile } = await supabase!
        .from('economy_profiles')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .maybeSingle();

      const bal = profile?.balance || 0;
      const bank = profile?.bank || 0;

      const branding = await getGuildBranding(guildId);
      const buffer = await buildEconomyCard({
        username: message.author.username,
        avatarUrl: message.author.displayAvatarURL({ extension: 'png' }),
        wallet: Number(bal),
        bank: Number(bank),
        brandName: branding?.brand_name || undefined,
        accentColor: branding?.primary_color || undefined
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'balance.png' });
      return message.reply({ files: [attachment] });
    }

    if (command === 'daily') {
      const { data: profile } = await supabase!
        .from('economy_profiles')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .maybeSingle();

      const now = new Date();
      const lastDaily = profile?.last_daily ? new Date(profile.last_daily) : null;

      if (lastDaily && (now.getTime() - lastDaily.getTime()) < 24 * 60 * 60 * 1000) {
        const remaining = 24 * 60 * 60 * 1000 - (now.getTime() - lastDaily.getTime());
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        return message.reply(`⏳ You've already claimed your daily reward! Come back in **${hours}h ${minutes}m**.`);
      }

      const reward = 500;
      const newBalance = (Number(profile?.balance || 0)) + reward;

      await supabase!
        .from('economy_profiles')
        .upsert({
          guild_id: guildId,
          user_id: userId,
          balance: newBalance,
          last_daily: now.toISOString()
        });

      const branding = await getGuildBranding(guildId);
      const buffer = await buildRewardCard({
        username: message.author.username,
        avatarUrl: message.author.displayAvatarURL({ extension: 'png' }),
        amount: reward,
        message: `New Balance: 🪙 ${newBalance.toLocaleString()}`,
        type: 'DAILY',
        brandName: branding?.brand_name || undefined,
        accentColor: branding?.primary_color || undefined
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'daily.png' });
      return message.reply({ files: [attachment] });
    }

    if (command === 'work') {
      const { data: profile } = await supabase!
        .from('economy_profiles')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .maybeSingle();

      const now = new Date();
      const lastWork = profile?.last_work ? new Date(profile.last_work) : null;
      const cooldownMs = 2 * 60 * 1000; // 2 minutes

      if (lastWork && (now.getTime() - lastWork.getTime()) < cooldownMs) {
        const remaining = cooldownMs - (now.getTime() - lastWork.getTime());
        const seconds = Math.floor((remaining / 1000) % 60);
        const minutes = Math.floor((remaining / (1000 * 60)) % 60);
        return message.reply(`⏳ You're too tired to work! Please rest for another **${minutes}m ${seconds}s**.`);
      }

      const reward = Math.floor(Math.random() * 200) + 50;
      const newBalance = (Number(profile?.balance || 0)) + reward;

      await supabase!
        .from('economy_profiles')
        .upsert({
          guild_id: guildId,
          user_id: userId,
          balance: newBalance,
          last_work: now.toISOString()
        });

      const jobs = ["Software Engineer", "Discord Moderator", "Pizza Delivery", "Designer", "Streamer"];
      const job = jobs[Math.floor(Math.random() * jobs.length)];

      const branding = await getGuildBranding(guildId);
      const buffer = await buildRewardCard({
        username: message.author.username,
        avatarUrl: message.author.displayAvatarURL({ extension: 'png' }),
        amount: reward,
        message: `You worked as a ${job}!`,
        type: 'WORK',
        brandName: branding?.brand_name || undefined,
        accentColor: branding?.primary_color || undefined
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'work.png' });
      return message.reply({ files: [attachment] });
    }

    if (command === 'pay') {
      const target = message.mentions.members?.first();
      const amount = parseInt(args[1]);

      if (!target || isNaN(amount) || amount <= 0) {
        return message.reply("❌ Usage: `!pay @user <amount>`");
      }

      const { data: senderProfile } = await supabase!
        .from('economy_profiles')
        .select('balance')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .maybeSingle();

      if ((senderProfile?.balance || 0) < amount) {
        return message.reply("❌ You don't have enough coins in your wallet!");
      }

      // Transfer
      await supabase!.from('economy_profiles').upsert({ guild_id: guildId, user_id: userId, balance: (senderProfile?.balance || 0) - amount });

      const { data: receiverProfile } = await supabase!.from('economy_profiles').select('balance').eq('guild_id', guildId).eq('user_id', target.id).maybeSingle();
      await supabase!.from('economy_profiles').upsert({ guild_id: guildId, user_id: target.id, balance: (receiverProfile?.balance || 0) + amount });

      return message.reply(`💸 You paid **🪙 ${amount.toLocaleString()}** to **${target.user.username}**!`);
    }

    if (command === 'top') {
      const { data: topProfiles } = await supabase!
        .from('economy_profiles')
        .select('user_id, balance')
        .eq('guild_id', guildId)
        .order('balance', { ascending: false })
        .limit(5);

      if (!topProfiles || topProfiles.length === 0) {
        return message.reply("No economy leaderboard data available yet!");
      }

      const leaderboardData = await Promise.all(topProfiles.map(async (p, index) => {
        const user = await bot.users.fetch(p.user_id).catch(() => null);
        return {
          rank: index + 1,
          username: user?.username || `User ${index + 1}`,
          balance: p.balance,
          avatarUrl: user?.displayAvatarURL({ extension: 'png', size: 64 })
        };
      }));

      // Get guild branding
      const { data: guildData } = await supabase!
        .from('guilds')
        .select('active_modules')
        .eq('id', guildId)
        .single();

      const canvas = guildData?.active_modules?.canvas || {};
      const branding = await getGuildBranding(guildId);

      const buffer = await buildLeaderboardCard({
        entries: leaderboardData,
        type: 'COINS',
        guildName: message.guild?.name,
        accentColor: canvas.top_accent_color || '#fbbf24',
        textColor: canvas.top_text_color || '#ffffff',
        backgroundUrl: canvas.top_background_url || undefined
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'top-economy.png' });
      return message.reply({ files: [attachment] });
    }

  }

  // --- Legacy Prefix Handling (.v commands) ---
  if (message.content.startsWith('.')) {
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (command === 'v') {
      const subCommand = args.shift()?.toLowerCase();

      // --- Moderation .v commands ---
      if (subCommand === 'lock' && !message.member?.voice?.channel) {
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply("❌ You need `Manage Channels` permission to lock this text channel.");
        }
        const guild = message.guild;
        const channel = message.channel;
        if (!guild || !channel || !channel.isTextBased()) return;

        await (channel as any).permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        await message.reply("🔒 Text channel locked using `.v lock`.");
        return;
      }

      if (subCommand === 'unlock' && !message.member?.voice?.channel) {
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply("❌ You need `Manage Channels` permission to unlock this text channel.");
        }
        const guild = message.guild;
        const channel = message.channel;
        if (!guild || !channel || !channel.isTextBased()) return;

        await (channel as any).permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
        await message.reply("🔓 Text channel unlocked using `.v unlock`.");
        return;
      }

      // --- Voice .v commands ---
      const voiceChannel = message.member?.voice?.channel;
      if (voiceChannel) {
        // Check if it's a dynamic voice channel and get owner
        const { data: tempChan } = await supabase!
          .from('temporary_voice_channels')
          .select('*')
          .eq('id', voiceChannel.id)
          .maybeSingle();

        if (tempChan) {
          const isOwner = tempChan.owner_id === message.author.id;

          if (subCommand === 'claim') {
            if (voiceChannel.members.has(tempChan.owner_id)) {
              return message.reply("❌ The owner is still in the channel!");
            }
            await supabase!.from('temporary_voice_channels').update({ owner_id: message.author.id }).eq('id', voiceChannel.id);
            return message.reply("👑 You are now the owner of this channel!");
          }

          if (!isOwner) return message.reply("❌ Only the channel owner can use these commands!");

          switch (subCommand) {
            case 'lock':
              await (voiceChannel as any).permissionOverwrites.edit(message.guild!.roles.everyone, { Connect: false });
              await message.reply("🔒 Voice channel locked.");
              break;
            case 'unlock':
              await (voiceChannel as any).permissionOverwrites.edit(message.guild!.roles.everyone, { Connect: null });
              await message.reply("🔓 Voice channel unlocked.");
              break;
            case 'hide':
              await (voiceChannel as any).permissionOverwrites.edit(message.guild!.roles.everyone, { ViewChannel: false });
              await message.reply("👻 Voice channel hidden.");
              break;
            case 'show':
              await (voiceChannel as any).permissionOverwrites.edit(message.guild!.roles.everyone, { ViewChannel: null });
              await message.reply("👁️ Voice channel is now visible.");
              break;
            case 'rename':
              const newName = args.join(' ');
              if (!newName) return message.reply("❌ Please provide a new name!");
              await voiceChannel.setName(newName);
              await message.reply(`📝 Channel renamed to: **${newName}**`);
              break;
            case 'limit':
              const limit = parseInt(args[0]);
              if (isNaN(limit) || limit < 0 || limit > 99) return message.reply("❌ Provide a limit between 0-99.");
              await (voiceChannel as any).setUserLimit(limit);
              await message.reply(`👥 User limit set to **${limit}**.`);
              break;
            case 'kick':
              const target = message.mentions.members?.first();
              if (!target) return message.reply("❌ Mention a user to kick!");
              if (target.id === message.author.id) return message.reply("❌ You can't kick yourself!");
              await target.voice.disconnect();
              await (voiceChannel as any).permissionOverwrites.edit(target, { Connect: false });
              await message.reply(`👢 Kicked **${target.user.username}** and blocked them from re-joining.`);
              break;
            default:
              message.reply("❓ Unknown voice command. Use `lock`, `unlock`, `hide`, `show`, `rename`, `limit`, `claim`, or `kick`.");
          }
          return;
        }
      }
    }
  }

  // --- General Slash Command Warning ---
  const knownPrefixes = ['!', '.', prefix];
  const isKnownPrefix = knownPrefixes.some(p => message.content.startsWith(p));

  if (!isKnownPrefix) {
    // Check if it starts with a common prefix-like character
    if (/^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(message.content)) {
      // If it's a slash command, check if it's registered
      if (message.content.startsWith('/')) {
        const commandName = message.content.slice(1).split(' ')[0].toLowerCase();
        const isRegisteredSlash = commands.some(cmd => cmd.name === commandName);
        if (isRegisteredSlash) return; // Valid slash command, do nothing
      }

      // If we reach here, it's an unsupported prefix command or unregistered slash command
      message.reply("Use slash commands (`/`) instead of prefix commands (except for `.v` utility and `!` economy commands).");
      return;
    }
  }
});






// --- AI Server Architect Feature ---
export async function executeArchitectTemplate(guildId: string, template: any, mode: 'purge' | 'sync' = 'purge') {
  console.log(`[Architect] executeArchitectTemplate called for ${guildId}`);
  const guild = bot.guilds.cache.get(guildId);
  if (!guild) {
    console.error(`[Architect] Guild ${guildId} not found in bot cache. Guilds in cache: ${bot.guilds.cache.size}`);
    throw new Error("Guild not found in bot cache. Make sure the bot is invited to the server.");
  }

  console.log(`[Architect] Found guild: ${guild.name}`);

  const summary = {
    roles: 0,
    categories: 0,
    channels: 0
  };

  // Helper to map permission strings to PermissionFlagsBits
  const mapPermissions = (perms: string[]) => {
    let bits = 0n;
    const mapping: Record<string, bigint> = {
      'ADMINISTRATOR': PermissionFlagsBits.Administrator,
      'MANAGE_GUILD': PermissionFlagsBits.ManageGuild,
      'MANAGE_ROLES': PermissionFlagsBits.ManageRoles,
      'MANAGE_CHANNELS': PermissionFlagsBits.ManageChannels,
      'KICK_MEMBERS': PermissionFlagsBits.KickMembers,
      'BAN_MEMBERS': PermissionFlagsBits.BanMembers,
      'MANAGE_MESSAGES': PermissionFlagsBits.ManageMessages,
      'VIEW_CHANNEL': PermissionFlagsBits.ViewChannel,
      'SEND_MESSAGES': PermissionFlagsBits.SendMessages,
      'CONNECT': PermissionFlagsBits.Connect,
      'SPEAK': PermissionFlagsBits.Speak,
      'MUTE_MEMBERS': PermissionFlagsBits.MuteMembers,
      'DEAFEN_MEMBERS': PermissionFlagsBits.DeafenMembers,
      'MOVE_MEMBERS': PermissionFlagsBits.MoveMembers,
      'USE_VAD': PermissionFlagsBits.UseVAD,
      'CHANGE_NICKNAME': PermissionFlagsBits.ChangeNickname,
      'MANAGE_NICKNAMES': PermissionFlagsBits.ManageNicknames,
      'MANAGE_WEBHOOKS': PermissionFlagsBits.ManageWebhooks,
      'MANAGE_THREADS': PermissionFlagsBits.ManageThreads,
      'CREATE_PUBLIC_THREADS': PermissionFlagsBits.CreatePublicThreads,
      'CREATE_PRIVATE_THREADS': PermissionFlagsBits.CreatePrivateThreads,
      'MODERATE_MEMBERS': PermissionFlagsBits.ModerateMembers
    };

    for (const p of perms) {
      const up = p.toUpperCase().replace(/\s+/g, '_');
      if (mapping[up]) bits |= mapping[up];
    }
    return bits;
  };

  if (mode === 'purge') {
    console.log(`[Architect] Purge Mode: Clearing existing infrastructure for guild ${guildId}...`);
    const channels = await guild.channels.fetch();
    for (const [id, channel] of channels) {
      if (channel) {
        try {
          await channel.delete('AI Server Architect Flush');
        } catch (e) { }
      }
    }

    const roles = await guild.roles.fetch();
    for (const [id, role] of roles) {
      if (role.editable && id !== guild.id && !role.managed) {
        try {
          await role.delete('AI Server Architect Flush');
        } catch (e) { }
      }
    }
  } else {
    console.log(`[Architect] Sync Mode: Building on top of existing infrastructure for guild ${guildId}.`);
  }

  // 1. Create Roles (Top-down)
  if (template.roles) {
    const rolesToCreate = [...template.roles].reverse();
    for (const roleData of rolesToCreate) {
      try {
        const existingRole = mode === 'sync' ? guild.roles.cache.find(r => r.name === roleData.name) : null;
        if (existingRole) {
          console.log(`[Architect] Role ${roleData.name} exists, skipping creation.`);
          summary.roles++;
          continue;
        }

        const perms = mapPermissions(roleData.permissions || []);
        await guild.roles.create({
          name: roleData.name,
          color: roleData.color as any,
          permissions: perms,
          reason: 'AI Server Architect Deployment'
        });
        summary.roles++;
      } catch (err) {
        console.error(`Failed to create role ${roleData.name}:`, err);
      }
    }
  }

  // 2. Create Categories and Channels
  if (template.categories) {
    for (const catData of template.categories) {
      try {
        let category = mode === 'sync' ? guild.channels.cache.find(c => c.name === catData.name && c.type === ChannelType.GuildCategory) : null;

        if (!category) {
          category = await guild.channels.create({
            name: catData.name,
            type: ChannelType.GuildCategory,
            reason: 'AI Server Architect Deployment'
          }) as any;
          summary.categories++;
        }

        if (catData.channels && category) {
          for (const chanData of catData.channels) {
            try {
              const type = chanData.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
              const existingChan = mode === 'sync' ? guild.channels.cache.find(c => c.name === chanData.name && c.type === type && c.parentId === category?.id) : null;

              if (existingChan) {
                console.log(`[Architect] Channel ${chanData.name} exists in ${catData.name}, skipping.`);
                summary.channels++;
                continue;
              }

              await guild.channels.create({
                name: chanData.name,
                type: type,
                parent: category.id,
                reason: 'AI Server Architect Deployment'
              });
              summary.channels++;
            } catch (err) {
              console.error(`Failed to create channel ${chanData.name}:`, err);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to create category ${catData.name}:`, err);
      }
    }
  }

  return summary;
}
