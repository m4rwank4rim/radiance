-- Radiance Database Schema

-- 1. Guilds Table (Stores server configurations)
CREATE TABLE IF NOT EXISTS public.guilds (
  id TEXT PRIMARY KEY, -- Discord Guild ID
  name TEXT NOT NULL,
  icon TEXT,
  prefix TEXT DEFAULT '!',
  active_modules JSONB DEFAULT '{"moderation": true, "commands": true, "leveling": true}'::jsonb,
  owner_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Custom Commands Table
CREATE TABLE IF NOT EXISTS public.custom_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT REFERENCES public.guilds(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL,
  response TEXT NOT NULL,
  cooldown INTEGER DEFAULT 0,
  category TEXT DEFAULT 'General',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(guild_id, trigger)
);

-- 3. Moderation Logs Table
CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  moderator_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE public.guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.guilds;
CREATE POLICY "Allow authenticated read access" ON public.guilds FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.custom_commands;
CREATE POLICY "Allow authenticated read access" ON public.custom_commands FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.moderation_logs;
CREATE POLICY "Allow authenticated read access" ON public.moderation_logs FOR SELECT USING (auth.role() = 'authenticated');

-- Note: The backend Express server and Discord Bot will use the SUPABASE_SERVICE_ROLE_KEY 
-- to bypass RLS and perform administrative inserts/updates.

-- 4. Levels Table
CREATE TABLE IF NOT EXISTS public.levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(guild_id, user_id)
);

-- 5. Tickets Table
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  channel_thread_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 6. Historical Stats Table
CREATE TABLE IF NOT EXISTS public.historical_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT REFERENCES public.guilds(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  total_members INTEGER DEFAULT 0,
  messages_24h INTEGER DEFAULT 0,
  UNIQUE(guild_id, date)
);

-- Altering existing table for Embed features
ALTER TABLE public.custom_commands ADD COLUMN IF NOT EXISTS is_embed BOOLEAN DEFAULT false;
ALTER TABLE public.custom_commands ADD COLUMN IF NOT EXISTS embed_color TEXT;
ALTER TABLE public.custom_commands ADD COLUMN IF NOT EXISTS embed_title TEXT;

-- Enable RLS and add Policies for New Tables
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.levels;
CREATE POLICY "Allow authenticated read access" ON public.levels FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.tickets;
CREATE POLICY "Allow authenticated read access" ON public.tickets FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.historical_stats;
CREATE POLICY "Allow authenticated read access" ON public.historical_stats FOR SELECT USING (auth.role() = 'authenticated');

-- 7. Ticket Messages Table
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_mod BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.ticket_messages;
CREATE POLICY "Allow authenticated read access" ON public.ticket_messages FOR SELECT USING (auth.role() = 'authenticated');
-- 8. Level Rewards Table
CREATE TABLE IF NOT EXISTS public.level_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT REFERENCES public.guilds(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  role_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(guild_id, level)
);

ALTER TABLE public.level_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.level_rewards;
CREATE POLICY "Allow authenticated read access" ON public.level_rewards FOR SELECT USING (auth.role() = 'authenticated');

-- Add missing columns
ALTER TABLE public.historical_stats ADD COLUMN IF NOT EXISTS commands_used INTEGER DEFAULT 0;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS xp_rate FLOAT DEFAULT 1.0;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS level_up_message TEXT DEFAULT 'GG {user}, you reached level {level}!';
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS level_up_channel TEXT; -- Channel ID for level up announcements
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS welcome_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS welcome_message TEXT DEFAULT 'Welcome {user} to {server}!';
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS welcome_channel TEXT;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS farewell_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS farewell_message TEXT DEFAULT '{user} has left the server.';
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS farewell_channel TEXT;

-- 9. Role Panels Table (For button-roles)
CREATE TABLE IF NOT EXISTS public.role_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT REFERENCES public.guilds(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  message_id TEXT, -- Will be filled after deployment
  title TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#d0bcff',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 10. Role Panel Buttons
CREATE TABLE IF NOT EXISTS public.role_panel_buttons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID REFERENCES public.role_panels(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL,
  label TEXT NOT NULL,
  emoji TEXT,
  style TEXT DEFAULT 'Primary', -- Primary, Secondary, Success, Danger
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.role_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_panel_buttons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.role_panels;
CREATE POLICY "Allow authenticated read access" ON public.role_panels FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.role_panel_buttons;
CREATE POLICY "Allow authenticated read access" ON public.role_panel_buttons FOR SELECT USING (auth.role() = 'authenticated');

-- Phase 13: Advanced Event Logging
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS logging_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS logging_channel_id TEXT;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS log_messages BOOLEAN DEFAULT true;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS log_members BOOLEAN DEFAULT true;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS log_voice BOOLEAN DEFAULT true;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS log_server BOOLEAN DEFAULT true;

-- 11. Shop Items
CREATE TABLE IF NOT EXISTS public.shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT REFERENCES public.guilds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL DEFAULT 100,
  role_id TEXT, -- Role to give upon purchase
  icon TEXT, -- CSS icon/emoji
  stock INTEGER DEFAULT -1, -- -1 for infinite
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 12. User Inventory
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  item_id UUID REFERENCES public.shop_items(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.shop_items;
CREATE POLICY "Allow authenticated read access" ON public.shop_items FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.user_inventory;
CREATE POLICY "Allow authenticated read access" ON public.user_inventory FOR SELECT USING (auth.role() = 'authenticated');

-- Phase 15: AI Support Integration
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS ai_channel_id TEXT;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS ai_knowledge_base TEXT;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'gemini-2.5-flash';

-- Phase 16: AI Server Architect Persistence
CREATE TABLE IF NOT EXISTS public.ai_architect_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT REFERENCES public.guilds(id) ON DELETE CASCADE,
  prompt TEXT,
  template JSONB NOT NULL,
  summary JSONB, -- { "roles": X, "categories": Y, "channels": Z }
  mode TEXT DEFAULT 'purge',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS dynamic_voice_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS dynamic_voice_hub_id TEXT;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS dynamic_voice_naming TEXT DEFAULT '🔊 {user}''s Channel';
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS dynamic_voice_menu BOOLEAN DEFAULT true;

ALTER TABLE public.ai_architect_deployments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.ai_architect_deployments;
CREATE POLICY "Allow authenticated read access" ON public.ai_architect_deployments FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE public.historical_stats ADD COLUMN IF NOT EXISTS ai_architect_runs INTEGER DEFAULT 0;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS welcome_background_url TEXT;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS welcome_text_color TEXT DEFAULT '#ffffff';
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS welcome_accent_color TEXT DEFAULT '#d0bcff';
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS farewell_background_url TEXT;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS farewell_text_color TEXT DEFAULT '#ffffff';
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS farewell_accent_color TEXT DEFAULT '#ffb2b7';
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS level_up_background_url TEXT;
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS level_up_text_color TEXT DEFAULT '#ffffff';
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS level_up_accent_color TEXT DEFAULT '#d0bcff';

-- Player Profiles for custom Rank Cards
CREATE TABLE IF NOT EXISTS public.player_profiles (
  user_id TEXT PRIMARY KEY,
  background_url TEXT,
  accent_color TEXT DEFAULT '#d0bcff',
  text_color TEXT DEFAULT '#ffffff',
  layout TEXT DEFAULT 'centered',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Achievements Tracking
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id TEXT,
  type TEXT, -- e.g., 'LEVEL_UP', 'MESSAGE_COUNT'
  value TEXT, -- e.g., '50' for Level 50
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Simple read access
DROP POLICY IF EXISTS "Public read for player profiles" ON public.player_profiles;
CREATE POLICY "Public read for player profiles" ON public.player_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read for achievements" ON public.achievements;
CREATE POLICY "Public read for achievements" ON public.achievements FOR SELECT USING (true);

-- Phase 17: Security Settings
CREATE TABLE IF NOT EXISTS public.guild_security (
  guild_id TEXT PRIMARY KEY REFERENCES public.guilds(id) ON DELETE CASCADE,
  link_reputation_enabled BOOLEAN DEFAULT false,
  link_allowlist TEXT[] DEFAULT '{}',
  link_blocklist TEXT[] DEFAULT '{}',
  link_expiration_hours INTEGER,
  link_preview_safe_only BOOLEAN DEFAULT false,
  ml_spam_detection BOOLEAN DEFAULT false,
  behavioral_fingerprinting BOOLEAN DEFAULT false,
  join_spam_correlation BOOLEAN DEFAULT false,
  attachment_scanning BOOLEAN DEFAULT false,
  adaptive_slowmode BOOLEAN DEFAULT false,
  velocity_tracking BOOLEAN DEFAULT false,
  cross_server_blacklist BOOLEAN DEFAULT false,
  captcha_on_links BOOLEAN DEFAULT false,
  phone_verification_required BOOLEAN DEFAULT false,
  quarantine_mode BOOLEAN DEFAULT false,
  predictive_raid_detection BOOLEAN DEFAULT false,
  auto_lockdown BOOLEAN DEFAULT false,
  honeytrap_enabled BOOLEAN DEFAULT false,
  honeytrap_channel_ids TEXT[] DEFAULT '{}',
  raid_join_threshold INTEGER DEFAULT 8,
  raid_window_seconds INTEGER DEFAULT 20,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.guild_security ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.guild_security;
CREATE POLICY "Allow authenticated read access" ON public.guild_security FOR SELECT USING (auth.role() = 'authenticated');

-- Phase 18: Economy Store
CREATE TABLE IF NOT EXISTS public.shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL DEFAULT 100,
  role_id TEXT,
  icon TEXT DEFAULT '📦',
  stock INTEGER DEFAULT -1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read for shop_items" ON public.shop_items;
CREATE POLICY "Public read for shop_items" ON public.shop_items FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  item_id UUID REFERENCES public.shop_items(id) ON DELETE SET NULL,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own inventory" ON public.user_inventory;
CREATE POLICY "Users can read own inventory" ON public.user_inventory FOR SELECT USING (true);

-- 19. Dynamic Voice Persistence
CREATE TABLE IF NOT EXISTS public.temporary_voice_channels (
  id TEXT PRIMARY KEY, -- channel_id
  guild_id TEXT NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.temporary_voice_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read for temp channels" ON public.temporary_voice_channels;
CREATE POLICY "Public read for temp channels" ON public.temporary_voice_channels FOR SELECT USING (true);

-- Update economy_profiles with bank support if not already there (based on bot.ts usage)
CREATE TABLE IF NOT EXISTS public.economy_profiles (
  guild_id TEXT NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  balance BIGINT DEFAULT 0,
  bank BIGINT DEFAULT 0,
  last_daily TIMESTAMP WITH TIME ZONE,
  last_work TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (guild_id, user_id)
);

ALTER TABLE public.economy_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.economy_profiles;
CREATE POLICY "Allow authenticated read access" ON public.economy_profiles FOR SELECT USING (auth.role() = 'authenticated');

-- 20. Command Permissions
CREATE TABLE IF NOT EXISTS public.command_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  command_name TEXT NOT NULL,
  allowed_roles TEXT[] DEFAULT '{}',
  admin_only BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(guild_id, command_name)
);

ALTER TABLE public.command_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.command_permissions;
CREATE POLICY "Allow authenticated read access" ON public.command_permissions FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated write access" ON public.command_permissions;
CREATE POLICY "Allow authenticated write access" ON public.command_permissions FOR ALL USING (auth.role() = 'authenticated');

-- Cleanup legacy module flags after casino/gambling removal
UPDATE public.guilds
SET active_modules = COALESCE(active_modules, '{}'::jsonb) - 'gambling'
WHERE active_modules ? 'gambling';

-- Diagnostics History
CREATE TABLE IF NOT EXISTS public.diagnostics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  failed_count INTEGER DEFAULT 0,
  action TEXT,
  note TEXT,
  target_check_id TEXT,
  target_check_ok BOOLEAN,
  checks JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.diagnostics_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.diagnostics_history;
CREATE POLICY "Allow authenticated read access" ON public.diagnostics_history FOR SELECT USING (auth.role() = 'authenticated');

-- Premium MVP foundation tables
CREATE TABLE IF NOT EXISTS public.event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'bot',
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  actor_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  severity TEXT NOT NULL DEFAULT 'medium',
  confidence INTEGER DEFAULT 0,
  playbook TEXT,
  summary TEXT,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.incident_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  actor_id TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.ticket_sla (
  ticket_id UUID PRIMARY KEY REFERENCES public.tickets(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  priority TEXT NOT NULL DEFAULT 'normal',
  first_response_due_at TIMESTAMP WITH TIME ZONE,
  resolution_due_at TIMESTAMP WITH TIME ZONE,
  breached BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.ticket_summaries (
  ticket_id UUID PRIMARY KEY REFERENCES public.tickets(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  summary TEXT,
  sentiment TEXT DEFAULT 'neutral',
  urgency INTEGER DEFAULT 0,
  suggested_reply TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.server_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL DEFAULT 'manual',
  created_by TEXT DEFAULT 'dashboard',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.snapshot_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  from_snapshot_id UUID REFERENCES public.server_snapshots(id) ON DELETE SET NULL,
  to_snapshot_id UUID REFERENCES public.server_snapshots(id) ON DELETE SET NULL,
  diff JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.billing_customers (
  guild_id TEXT PRIMARY KEY REFERENCES public.guilds(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'inactive',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.entitlements (
  guild_id TEXT PRIMARY KEY REFERENCES public.guilds(id) ON DELETE CASCADE,
  features JSONB NOT NULL DEFAULT '{"ai_moderation": false, "ticket_intelligence": false, "backup_restore": false, "executive_analytics": false, "white_label": false}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.branding_profiles (
  guild_id TEXT PRIMARY KEY REFERENCES public.guilds(id) ON DELETE CASCADE,
  brand_name TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#8B5CF6',
  accent_color TEXT DEFAULT '#d0bcff',
  theme JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  report_week DATE NOT NULL,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(guild_id, report_week)
);

ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_sla ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshot_diffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.event_logs;
CREATE POLICY "Allow authenticated read access" ON public.event_logs FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.incidents;
CREATE POLICY "Allow authenticated read access" ON public.incidents FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.incident_actions;
CREATE POLICY "Allow authenticated read access" ON public.incident_actions FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.ticket_sla;
CREATE POLICY "Allow authenticated read access" ON public.ticket_sla FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.ticket_summaries;
CREATE POLICY "Allow authenticated read access" ON public.ticket_summaries FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.server_snapshots;
CREATE POLICY "Allow authenticated read access" ON public.server_snapshots FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.snapshot_diffs;
CREATE POLICY "Allow authenticated read access" ON public.snapshot_diffs FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.billing_customers;
CREATE POLICY "Allow authenticated read access" ON public.billing_customers FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.subscriptions;
CREATE POLICY "Allow authenticated read access" ON public.subscriptions FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.entitlements;
CREATE POLICY "Allow authenticated read access" ON public.entitlements FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.branding_profiles;
CREATE POLICY "Allow authenticated read access" ON public.branding_profiles FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.weekly_reports;
CREATE POLICY "Allow authenticated read access" ON public.weekly_reports FOR SELECT USING (auth.role() = 'authenticated');
