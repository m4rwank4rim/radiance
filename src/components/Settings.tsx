import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { openBillingPortal, openUpgradeCheckout } from "../lib/billing";
import { toast } from "sonner";

export default function Settings() {
  const { guildId } = useParams();
  const queryClient = useQueryClient();

  const [plugins, setPlugins] = useState({
    moderation: true,
    commands: true,
    leveling: true,
  });
  const [brandName, setBrandName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#8B5CF6");
  const [accentColor, setAccentColor] = useState("#d0bcff");
  const [fromSnapshotId, setFromSnapshotId] = useState("");
  const [toSnapshotId, setToSnapshotId] = useState("");
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [selectedRestoreSnapshotId, setSelectedRestoreSnapshotId] = useState("");
  const [applyRoles, setApplyRoles] = useState(true);
  const [applyChannels, setApplyChannels] = useState(true);
  const [applyOverwrites, setApplyOverwrites] = useState(true);
  const [applyGuildSettings, setApplyGuildSettings] = useState(true);
  const [applyConfig, setApplyConfig] = useState(true);
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);
  const [schedulerCadence, setSchedulerCadence] = useState<"daily" | "weekly">("daily");
  const [schedulerWeekday, setSchedulerWeekday] = useState(1);
  const [schedulerHour, setSchedulerHour] = useState(3);
  const [schedulerMinute, setSchedulerMinute] = useState(15);
  const [schedulerRetention, setSchedulerRetention] = useState(30);
  const featureMeta: Record<string, { label: string; description: string }> = {
    ai_moderation: {
      label: "AI Moderation",
      description: "Automatically catches spam, raids, and risky behavior."
    },
    ticket_intelligence: {
      label: "Ticket Intelligence",
      description: "Summarizes tickets, suggests replies, and tracks SLA."
    },
    backup_restore: {
      label: "Backup and Restore",
      description: "Snapshots and restore for channels, roles, and settings."
    },
    executive_analytics: {
      label: "Executive Analytics",
      description: "Growth and performance metrics dashboards."
    },
    white_label: {
      label: "White-label Branding",
      description: "Use your own brand colors and identity."
    }
  };
  const getFeatureMeta = (key: string) => featureMeta[key] || { label: key.replaceAll("_", " "), description: "Premium feature" };

  const { data: config, isLoading } = useQuery({
    queryKey: ['guildConfig', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/config`);
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    },
    enabled: !!guildId
  });

  const { data: entitlements } = useQuery({
    queryKey: ['entitlements', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/entitlements`);
      if (!res.ok) throw new Error("Failed to fetch entitlements");
      return res.json();
    },
    enabled: !!guildId
  });

  const { data: branding } = useQuery({
    queryKey: ['branding', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/branding`);
      if (!res.ok) throw new Error("Failed to fetch branding");
      return res.json();
    },
    enabled: !!guildId
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ['snapshots', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/snapshots`);
      if (!res.ok) throw new Error("Failed to fetch snapshots");
      return res.json();
    },
    enabled: !!guildId
  });

  const { data: snapshotDiff, refetch: refetchDiff, isFetching: isFetchingDiff } = useQuery({
    queryKey: ['snapshotDiff', guildId, fromSnapshotId, toSnapshotId],
    queryFn: async () => {
      if (!fromSnapshotId || !toSnapshotId) return null;
      const res = await fetch(`/api/guilds/${guildId}/snapshots/diff?from=${fromSnapshotId}&to=${toSnapshotId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: false
  });

  const { data: backupScheduler } = useQuery({
    queryKey: ["backupScheduler", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/backup-scheduler`);
      if (!res.ok) throw new Error("Failed to fetch backup scheduler");
      return res.json();
    },
    enabled: !!guildId && !!entitlements?.features?.backup_restore
  });

  const { data: restoreAudit = [] } = useQuery({
    queryKey: ["restoreAudit", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/restore-audit`);
      if (!res.ok) throw new Error("Failed to fetch restore audit");
      return res.json();
    },
    enabled: !!guildId && !!entitlements?.features?.backup_restore
  });

  const { data: restorePreview, isFetching: isFetchingRestorePreview } = useQuery({
    queryKey: ['restorePreview', guildId, selectedRestoreSnapshotId],
    queryFn: async () => {
      if (!selectedRestoreSnapshotId) return null;
      const res = await fetch(`/api/guilds/${guildId}/snapshots/${selectedRestoreSnapshotId}/restore/preview`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedRestoreSnapshotId
  });

  useEffect(() => {
    if (config) {
      if (config.active_modules) {
        setPlugins(config.active_modules);
      }
    }
  }, [config]);

  useEffect(() => {
    if (branding) {
      setBrandName(branding.brand_name || "");
      setLogoUrl(branding.logo_url || "");
      setPrimaryColor(branding.primary_color || "#8B5CF6");
      setAccentColor(branding.accent_color || "#d0bcff");
    }
  }, [branding]);

  useEffect(() => {
    if (!backupScheduler) return;
    setSchedulerEnabled(Boolean(backupScheduler.enabled));
    setSchedulerCadence(backupScheduler.cadence === "weekly" ? "weekly" : "daily");
    setSchedulerWeekday(Number(backupScheduler.weekday ?? 1));
    setSchedulerHour(Number(backupScheduler.hour ?? 3));
    setSchedulerMinute(Number(backupScheduler.minute ?? 15));
    setSchedulerRetention(Number(backupScheduler.retention ?? 30));
  }, [backupScheduler]);

  const mutation = useMutation({
    mutationFn: async (newConfig: any) => {
      const res = await fetch(`/api/guilds/${guildId}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (!res.ok) throw new Error("Failed to save config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guildConfig', guildId] });
    }
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/snapshots`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to create snapshot");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots', guildId] });
    }
  });

  const restoreMutation = useMutation({
    mutationFn: async ({ snapshotId, full }: { snapshotId: string; full: boolean }) => {
      const res = await fetch(`/api/guilds/${guildId}/snapshots/${snapshotId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dry_run: false,
          restore_config_only: !full,
          apply_roles: applyRoles,
          apply_channels: applyChannels,
          apply_overwrites: applyOverwrites,
          apply_guild_settings: applyGuildSettings,
          apply_config: applyConfig
        })
      });
      if (!res.ok) throw new Error("Failed to restore snapshot");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guildConfig', guildId] });
    }
  });

  const brandingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/branding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: brandName,
          logo_url: logoUrl,
          primary_color: primaryColor,
          accent_color: accentColor
        })
      });
      if (!res.ok) throw new Error("Failed to save branding");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding', guildId] });
    }
  });

  const schedulerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/backup-scheduler`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: schedulerEnabled,
          cadence: schedulerCadence,
          weekday: schedulerWeekday,
          hour: schedulerHour,
          minute: schedulerMinute,
          retention: schedulerRetention
        })
      });
      if (!res.ok) throw new Error("Failed to save backup scheduler");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backupScheduler", guildId] });
      toast.success("Backup scheduler saved");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to save scheduler")
  });

  const handleSave = () => {
    mutation.mutate({ prefix: config?.prefix || "!", active_modules: plugins });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Server Settings</h2>
          <p className="text-on-surface-variant text-sm">Configure core bot behavior and manage active module deployments.</p>
        </div>
        <div className="flex items-center gap-4">
          <AnimatePresence>
            {mutation.isSuccess && (
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-green-400 text-xs font-bold uppercase tracking-widest"
              >
                Configuration Saved
              </motion.span>
            )}
          </AnimatePresence>
          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="btn-gradient text-on-primary-container px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-xl shadow-primary/20 flex items-center gap-2 disabled:opacity-50 hover:scale-[1.02]"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="bg-surface-container-low border border-outline-variant/10 rounded-3xl p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-xl bg-accent/10">
            <span className="material-symbols-outlined text-accent text-2xl">extension</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Plugin Modules</h3>
            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Active Deployments</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: 'moderation', label: "Moderation", icon: "security", desc: "AI-driven anti-raid and logging suite." },
            { id: 'commands', label: "Commands Changer", icon: "terminal", desc: "Remap slash commands to your preference." },
            { id: 'leveling', label: "Leveling System", icon: "military_tech", desc: "XP gamification and role rewards." },
          ].map((plugin) => (
            <div key={plugin.id} className="flex items-start justify-between p-5 rounded-2xl bg-surface-container-high border border-outline-variant/10 hover:border-outline-variant/30 transition-colors group">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "p-3 rounded-xl transition-colors",
                  plugins[plugin.id as keyof typeof plugins]
                    ? 'bg-primary/10 text-primary'
                    : 'bg-surface-container-low text-on-surface-variant opacity-40'
                )}>
                  <span className="material-symbols-outlined text-2xl">{plugin.icon}</span>
                </div>
                <div>
                  <div className="font-bold text-sm text-white mb-1 group-hover:text-primary transition-colors">{plugin.label}</div>
                  <div className="text-[11px] text-on-surface-variant leading-relaxed opacity-80">{plugin.desc}</div>
                </div>
              </div>
              <button
                onClick={() => setPlugins(p => ({ ...p, [plugin.id]: !p[plugin.id as keyof typeof plugins] }))}
                className={cn(
                  "w-11 h-6 rounded-full p-1 transition-all relative shrink-0",
                  plugins[plugin.id as keyof typeof plugins] ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/20'
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full bg-white transition-transform",
                  plugins[plugin.id as keyof typeof plugins] ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-container-low border border-outline-variant/10 rounded-3xl p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Backup and Restore</h3>
            <p className="text-xs text-on-surface-variant">Create server snapshots and restore config states.</p>
          </div>
          <button
            onClick={() => createSnapshotMutation.mutate()}
            disabled={createSnapshotMutation.isPending || !entitlements?.features?.backup_restore}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
          >
            {!entitlements?.features?.backup_restore ? "Upgrade Required" : (createSnapshotMutation.isPending ? "Creating..." : "Create Snapshot")}
          </button>
        </div>
        {!entitlements?.features?.backup_restore && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-between gap-3">
            <span>Backup and restore is locked on Free plan.</span>
            <button
              onClick={() => guildId && openUpgradeCheckout(guildId, "business").catch((err) => toast.error(err?.message || "Checkout unavailable"))}
              className="px-3 py-1.5 rounded-md bg-amber-400/20 text-amber-200 text-[11px] font-bold whitespace-nowrap"
            >
              Upgrade Plan
            </button>
          </div>
        )}
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {snapshots.map((snapshot: any) => (
            <div key={snapshot.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-high border border-outline-variant/10">
              <div>
                <div className="text-sm font-bold text-white">{snapshot.snapshot_type || "manual"} snapshot</div>
                <div className="text-xs text-on-surface-variant">{new Date(snapshot.created_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => restoreMutation.mutate({ snapshotId: snapshot.id, full: false })}
                  disabled={restoreMutation.isPending || !entitlements?.features?.backup_restore}
                  className="px-3 py-1.5 rounded-lg bg-secondary/20 text-secondary text-xs font-bold disabled:opacity-50"
                >
                  Restore Config
                </button>
                <button
                  onClick={() => {
                    setSelectedRestoreSnapshotId(snapshot.id);
                    setRestoreConfirmText("");
                    setApplyRoles(true);
                    setApplyChannels(true);
                    setApplyOverwrites(true);
                    setApplyGuildSettings(true);
                    setApplyConfig(true);
                  }}
                  disabled={restoreMutation.isPending || !entitlements?.features?.backup_restore}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold disabled:opacity-50"
                >
                  Full Restore
                </button>
              </div>
            </div>
          ))}
          {snapshots.length === 0 && <div className="text-xs text-on-surface-variant">No snapshots yet.</div>}
        </div>

        <div className="pt-3 border-t border-outline-variant/10 space-y-3">
          <h4 className="text-sm font-bold text-white">Automatic Backup Scheduler (UTC)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs text-on-surface-variant flex items-center gap-2">
              <input type="checkbox" checked={schedulerEnabled} onChange={(e) => setSchedulerEnabled(e.target.checked)} />
              Enable scheduled backups
            </label>
            <select value={schedulerCadence} onChange={(e) => setSchedulerCadence(e.target.value as "daily" | "weekly")} className="bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            {schedulerCadence === "weekly" && (
              <select value={schedulerWeekday} onChange={(e) => setSchedulerWeekday(Number(e.target.value))} className="bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white">
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
              </select>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="number" min={0} max={23} value={schedulerHour} onChange={(e) => setSchedulerHour(Number(e.target.value))} className="bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white" placeholder="Hour (0-23)" />
            <input type="number" min={0} max={59} value={schedulerMinute} onChange={(e) => setSchedulerMinute(Number(e.target.value))} className="bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white" placeholder="Minute (0-59)" />
            <input type="number" min={5} max={180} value={schedulerRetention} onChange={(e) => setSchedulerRetention(Number(e.target.value))} className="bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white" placeholder="Retention (days)" />
          </div>
          <button
            onClick={() => schedulerMutation.mutate()}
            disabled={schedulerMutation.isPending || !entitlements?.features?.backup_restore}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
          >
            {schedulerMutation.isPending ? "Saving scheduler..." : "Save Scheduler"}
          </button>
        </div>

        <div className="pt-3 border-t border-outline-variant/10 space-y-3">
          <h4 className="text-sm font-bold text-white">Diff Preview</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={fromSnapshotId}
              onChange={(e) => setFromSnapshotId(e.target.value)}
              className="bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">From snapshot</option>
              {snapshots.map((s: any) => (
                <option key={`from-${s.id}`} value={s.id}>
                  {new Date(s.created_at).toLocaleString()}
                </option>
              ))}
            </select>
            <select
              value={toSnapshotId}
              onChange={(e) => setToSnapshotId(e.target.value)}
              className="bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">To snapshot</option>
              {snapshots.map((s: any) => (
                <option key={`to-${s.id}`} value={s.id}>
                  {new Date(s.created_at).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => refetchDiff()}
            disabled={!fromSnapshotId || !toSnapshotId || isFetchingDiff || !entitlements?.features?.backup_restore}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
          >
            {isFetchingDiff ? "Loading diff..." : "Preview Diff"}
          </button>
          {snapshotDiff?.diff && (
            <div className="p-3 rounded-xl bg-surface-container-high border border-outline-variant/10 text-xs text-on-surface-variant space-y-1">
              <div>Channels added: <strong className="text-white">{snapshotDiff.diff.channels_added?.length || 0}</strong></div>
              <div>Channels removed: <strong className="text-white">{snapshotDiff.diff.channels_removed?.length || 0}</strong></div>
              <div>Roles: <strong className="text-white">{snapshotDiff.diff.roles_from || 0}</strong> {'->'} <strong className="text-white">{snapshotDiff.diff.roles_to || 0}</strong></div>
              <div>Emojis: <strong className="text-white">{snapshotDiff.diff.emojis_from || 0}</strong> {'->'} <strong className="text-white">{snapshotDiff.diff.emojis_to || 0}</strong></div>
              <div>Stickers: <strong className="text-white">{snapshotDiff.diff.stickers_from || 0}</strong> {'->'} <strong className="text-white">{snapshotDiff.diff.stickers_to || 0}</strong></div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-outline-variant/10 space-y-3">
          <h4 className="text-sm font-bold text-white">Restore Audit Timeline</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {restoreAudit.length === 0 && (
              <div className="text-xs text-on-surface-variant">No restore audit events yet.</div>
            )}
            {restoreAudit.map((entry: any) => (
              <div key={entry.id} className="p-3 rounded-lg bg-surface-container-high border border-outline-variant/10 text-xs text-on-surface-variant">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white font-bold">{String(entry.event_type || "").replaceAll("_", " ")}</span>
                  <span>{new Date(entry.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-1">Severity: {entry.severity || "info"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedRestoreSnapshotId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-surface-container-low p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Confirm Full Restore</h3>
            <p className="text-xs text-on-surface-variant">
              This applies a full structure restore (roles, channels, permissions, guild settings). Type <strong className="text-white">RESTORE</strong> to continue.
            </p>
            <div className="p-3 rounded-lg bg-surface-container-high border border-outline-variant/10 text-xs text-on-surface-variant space-y-1">
              {isFetchingRestorePreview && <div>Loading restore plan...</div>}
              {restorePreview?.plan && (
                <>
                  <div>Roles: <strong className="text-white">{restorePreview.plan.roles_total}</strong></div>
                  <div>Channels: <strong className="text-white">{restorePreview.plan.channels_total}</strong></div>
                  <div>Overwrites: <strong className="text-white">{restorePreview.plan.overwrites_total}</strong></div>
                  <div>Emojis: <strong className="text-white">{restorePreview.plan.emojis_total}</strong></div>
                  <div>Stickers: <strong className="text-white">{restorePreview.plan.stickers_total}</strong></div>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-on-surface-variant">
              <label className="flex items-center gap-2"><input type="checkbox" checked={applyRoles} onChange={e => setApplyRoles(e.target.checked)} /> Apply roles</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={applyChannels} onChange={e => setApplyChannels(e.target.checked)} /> Apply channels</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={applyOverwrites} onChange={e => setApplyOverwrites(e.target.checked)} /> Apply overwrites</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={applyGuildSettings} onChange={e => setApplyGuildSettings(e.target.checked)} /> Apply guild settings</label>
              <label className="flex items-center gap-2 col-span-2"><input type="checkbox" checked={applyConfig} onChange={e => setApplyConfig(e.target.checked)} /> Apply bot config (prefix/modules/xp)</label>
            </div>
            <input
              value={restoreConfirmText}
              onChange={(e) => setRestoreConfirmText(e.target.value)}
              placeholder="Type RESTORE"
              className="w-full bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedRestoreSnapshotId("")}
                className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface-variant text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  restoreMutation.mutate({ snapshotId: selectedRestoreSnapshotId, full: true });
                  setSelectedRestoreSnapshotId("");
                  setRestoreConfirmText("");
                }}
                disabled={restoreConfirmText !== "RESTORE" || restoreMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold disabled:opacity-50"
              >
                {restoreMutation.isPending ? "Restoring..." : "Run Full Restore"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface-container-low border border-outline-variant/10 rounded-3xl p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Monetization and Entitlements</h3>
            <p className="text-xs text-on-surface-variant">Current subscription and enabled premium modules.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Plan: {entitlements?.subscription?.plan || "free"}
            </span>
            {String(entitlements?.subscription?.plan || "free") === "free" ? (
              <button
                onClick={() => guildId && openUpgradeCheckout(guildId, "business").catch((err) => toast.error(err?.message || "Checkout unavailable"))}
                className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[11px] font-bold"
              >
                Upgrade
              </button>
            ) : (
              <button
                onClick={() => guildId && openBillingPortal(guildId).catch((err) => toast.error(err?.message || "Billing portal unavailable"))}
                className="px-3 py-1.5 rounded-lg bg-surface-container-high text-white text-[11px] font-bold border border-outline-variant/20"
              >
                Manage Billing
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Object.entries(entitlements?.features || {}).map(([feature, enabled]) => (
            <div key={feature} className={cn("p-3 rounded-xl border text-xs", enabled ? "bg-green-500/10 border-green-500/30 text-green-300" : "bg-surface-container-high border-outline-variant/10 text-on-surface-variant")}>
              <div className="font-bold">{getFeatureMeta(feature).label}</div>
              <div className="text-[10px] mt-1 opacity-80">{getFeatureMeta(feature).description}</div>
              <div className="text-[10px] mt-1 font-bold uppercase tracking-widest">{enabled ? "Enabled" : "Locked"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-container-low border border-outline-variant/10 rounded-3xl p-8 space-y-4">
        <div>
          <h3 className="text-xl font-bold text-white">White-label Branding</h3>
          <p className="text-xs text-on-surface-variant">Customize brand identity for premium deployments.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={brandName}
            onChange={e => setBrandName(e.target.value)}
            placeholder="Brand name"
            disabled={!entitlements?.features?.white_label}
            className="bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
          />
          <input
            value={logoUrl}
            onChange={e => setLogoUrl(e.target.value)}
            placeholder="Logo URL"
            disabled={!entitlements?.features?.white_label}
            className="bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
          />
          <input
            value={primaryColor}
            onChange={e => setPrimaryColor(e.target.value)}
            placeholder="Primary color"
            disabled={!entitlements?.features?.white_label}
            className="bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
          />
          <input
            value={accentColor}
            onChange={e => setAccentColor(e.target.value)}
            placeholder="Accent color"
            disabled={!entitlements?.features?.white_label}
            className="bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
          />
        </div>
        <button
          onClick={() => brandingMutation.mutate()}
          disabled={brandingMutation.isPending || !entitlements?.features?.white_label}
          className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
        >
          {brandingMutation.isPending ? "Saving..." : "Save Branding"}
        </button>
        {!entitlements?.features?.white_label && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-between gap-3">
            <span>White-label branding is available on Enterprise plan.</span>
            <button
              onClick={() => guildId && openUpgradeCheckout(guildId, "enterprise").catch((err) => toast.error(err?.message || "Checkout unavailable"))}
              className="px-3 py-1.5 rounded-md bg-amber-400/20 text-amber-200 text-[11px] font-bold whitespace-nowrap"
            >
              Upgrade Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
