import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

export default function Moderation() {
  const { guildId } = useParams();
  const queryClient = useQueryClient();
  const [action, setAction] = useState({
    userId: "",
    reason: "",
    minutes: 10,
    amount: 10,
    channelId: "",
    seconds: 0
  });
  const [selectedAction, setSelectedAction] = useState("warn");
  const [memberQuery, setMemberQuery] = useState("");

  const [settings, setSettings] = useState({
    badWords: true,
    linkSpam: true,
    capsSpam: false,
    emojiSpam: true,
    customBadWords: "",
    maxWarnings: 3,
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['guildConfig', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/config`);
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    },
    enabled: !!guildId
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['moderationLogs', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/moderation-logs`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    enabled: !!guildId,
    refetchInterval: 10000 // Refetch every 10 seconds
  });

  const { data: channels = [] } = useQuery({
    queryKey: ['channels', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/channels`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!guildId
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', guildId, memberQuery],
    queryFn: async () => {
      const q = encodeURIComponent(memberQuery.trim());
      const res = await fetch(`/api/guilds/${guildId}/members?query=${q}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!guildId && memberQuery.trim().length >= 2
  });

  const { data: security } = useQuery({
    queryKey: ['security', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/security`);
      if (!res.ok) throw new Error("Failed to fetch security");
      return res.json();
    },
    enabled: !!guildId
  });

  const { data: cases = [] } = useQuery({
    queryKey: ['moderationCases', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/moderation-cases`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!guildId,
    refetchInterval: 10000
  });

  const { data: appeals = [] } = useQuery({
    queryKey: ['moderationAppeals', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/moderation-appeals`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!guildId,
    refetchInterval: 10000
  });

  const { data: warningSummary = [], isLoading: warningLoading, refetch: refetchWarnings } = useQuery({
    queryKey: ['warningSummary', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/warnings-summary`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!guildId,
    refetchInterval: 10000
  });

  useEffect(() => {
    if (config && config.active_modules?.automod) {
      const am = config.active_modules.automod;
      setSettings({
        ...am,
        customBadWords: Array.isArray(am.customBadWords) ? am.customBadWords.join(", ") : am.customBadWords || "",
        maxWarnings: am.maxWarnings || 3
      });
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: async (newSettings: any) => {
      const updatedModules = {
        ...(config?.active_modules || {}),
        automod: newSettings
      };

      const res = await fetch(`/api/guilds/${guildId}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: config?.prefix || '!',
          active_modules: updatedModules
        })
      });
      if (!res.ok) throw new Error("Failed to save config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guildConfig', guildId] });
    }
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/guilds/${guildId}/moderation/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Action failed");
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['moderationLogs', guildId] });
      await queryClient.invalidateQueries({ queryKey: ['moderationCases', guildId] });
      await queryClient.invalidateQueries({ queryKey: ['warningSummary', guildId] });
      await refetchWarnings();
      toast.success("Moderation action completed");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Moderation action failed");
    }
  });

  const executeModerationAction = () => {
    const needsUser = ['warn', 'clear_warnings', 'kick', 'ban', 'timeout', 'untimeout'].includes(selectedAction);
    const needsChannel = ['purge', 'lock', 'unlock', 'slowmode'].includes(selectedAction);
    if (needsUser && !action.userId.trim()) {
      toast.error("Select a member first.");
      return;
    }
    if (needsChannel && !action.channelId.trim()) {
      toast.error("Select a channel first.");
      return;
    }
    if (selectedAction === 'timeout' && action.minutes < 1) {
      toast.error("Timeout minutes must be at least 1.");
      return;
    }
    if (selectedAction === 'purge' && (action.amount < 1 || action.amount > 100)) {
      toast.error("Purge amount must be between 1 and 100.");
      return;
    }
    if (selectedAction === 'slowmode' && (action.seconds < 0 || action.seconds > 21600)) {
      toast.error("Slowmode must be between 0 and 21600 seconds.");
      return;
    }
    actionMutation.mutate({ action: selectedAction, ...action });
  };

  const securityMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/guilds/${guildId}/security`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to save security settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security', guildId] });
      toast.success("Security settings updated");
    }
  });

  const appealMutation = useMutation({
    mutationFn: async ({ appealId, status }: { appealId: string; status: string }) => {
      const res = await fetch(`/api/guilds/${guildId}/moderation-appeals/${appealId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Failed to update appeal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderationAppeals', guildId] });
      toast.success("Appeal status updated");
    }
  });

  const handleSave = () => {
    const payload = {
      ...settings,
      customBadWords: settings.customBadWords.split(',').map(w => w.trim()).filter(w => w.length > 0),
      maxWarnings: Number(settings.maxWarnings)
    };
    mutation.mutate(payload);
  };

  const getLogColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'banned': return 'text-red-400';
      case 'kicked': return 'text-orange-400';
      case 'muted': return 'text-yellow-400';
      case 'warned': return 'text-accent';
      default: return 'text-primary';
    }
  };

  const getLogBg = (action: string) => {
    switch (action.toLowerCase()) {
      case 'banned': return 'bg-red-400/10';
      case 'kicked': return 'bg-orange-400/10';
      case 'muted': return 'bg-yellow-400/10';
      case 'warned': return 'bg-accent/10';
      default: return 'bg-primary/10';
    }
  };

  if (configLoading || logsLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Moderation</h2>
          <p className="text-on-surface-variant text-sm">Configure AI-powered security rules and view recent community actions.</p>
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
            className="btn-gradient text-on-primary-container px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-xl shadow-primary/20 flex items-center gap-2 disabled:opacity-50 hover:scale-[1.02]"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Auto-Mod Settings */}
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-xl bg-primary/10">
              <span className="material-symbols-outlined text-primary text-2xl">security</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Auto-Mod Rules</h3>
              <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Global Filters</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { id: 'badWords', label: "Bad Words Filter", desc: "AI-driven detection of harmful language.", icon: "forum" },
              { id: 'linkSpam', label: "Anti-Link Spam", desc: "Block unauthorized external links.", icon: "link" },
              { id: 'capsSpam', label: "Caps Lock Filter", desc: "Prevent excessive use of capital letters.", icon: "format_size" },
              { id: 'emojiSpam', label: "Emoji Spam Filter", desc: "Rate-limit excessive emoji usage.", icon: "mood" },
            ].map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-5 rounded-xl bg-surface-container-high border border-outline-variant/10 hover:border-outline-variant/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/10">
                    <span className="material-symbols-outlined text-xl text-on-surface-variant">{rule.icon}</span>
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white mb-0.5">{rule.label}</div>
                    <div className="text-xs text-on-surface-variant">{rule.desc}</div>
                  </div>
                </div>
                <button
                  onClick={() => setSettings(s => ({ ...s, [rule.id]: !s[rule.id as keyof typeof settings] }))}
                  className={cn(
                    "w-11 h-6 rounded-full p-1 transition-all relative",
                    settings[rule.id as keyof typeof settings] ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/20'
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full bg-white transition-transform",
                    settings[rule.id as keyof typeof settings] ? 'translate-x-5' : 'translate-x-0'
                  )} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-8 border-t border-outline-variant/10 space-y-6">
            <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-widest">Advanced Configuration</h4>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 px-1">Custom Bad Words List (Comma Separated)</label>
              <textarea
                value={settings.customBadWords}
                onChange={e => setSettings({ ...settings, customBadWords: e.target.value })}
                className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-5 py-3.5 text-sm text-white outline-none focus:border-primary transition-colors min-h-[80px] resize-none"
                placeholder="apple, banana, grape..."
              />
              <p className="text-[10px] text-on-surface-variant mt-2 px-1 opacity-70">These words will trigger the bad words filter even if they aren't traditionally harmful.</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 px-1">Max Warnings Before Auto-Kick</label>
              <div className="flex gap-4">
                <input
                  type="number"
                  min="0"
                  value={settings.maxWarnings}
                  onChange={e => setSettings({ ...settings, maxWarnings: parseInt(e.target.value) || 0 })}
                  className="w-32 bg-surface-container-high border border-outline-variant/10 rounded-xl px-5 py-3 text-sm text-white outline-none focus:border-primary transition-colors"
                />
                <div className="flex-1 px-4 py-3 bg-surface-container-high/50 border border-outline-variant/10 rounded-xl text-xs text-on-surface-variant flex items-center">
                  Set to 0 to disable automated kicking.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Logs */}
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-xl bg-accent/10">
              <span className="material-symbols-outlined text-accent text-2xl">history</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Security Logs</h3>
              <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Recent Infractions</p>
            </div>
          </div>

          <div className="space-y-4">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-center justify-between p-5 rounded-xl bg-surface-container-high border border-outline-variant/10">
                <div className="flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs", getLogBg(log.action), getLogColor(log.action))}>
                    {log.action.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-white">{log.user_id}</span>
                      <span className={cn("text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-md border border-white/5", getLogBg(log.action), getLogColor(log.action))}>
                        {log.action}
                      </span>
                    </div>
                    <div className="text-xs text-on-surface-variant">Reason: {log.reason}</div>
                    <div className="text-[10px] text-on-surface-variant mt-1 opacity-50">{new Date(log.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-center py-12 bg-surface-container-high rounded-2xl border border-dashed border-outline-variant/20">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 opacity-20">verified_user</span>
                <p className="text-on-surface-variant font-bold uppercase tracking-widest text-[10px]">No recent infractions detected</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-8 space-y-4">
          <h3 className="text-xl font-bold text-white">Manual Security Controls</h3>
          <p className="text-xs text-on-surface-variant">Pick an action, then fill only the fields needed for that action.</p>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="col-span-2 bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
            >
              <option value="warn">Warn User</option>
              <option value="clear_warnings">Clear User Warnings</option>
              <option value="kick">Kick User</option>
              <option value="ban">Ban User</option>
              <option value="timeout">Timeout User</option>
              <option value="untimeout">Remove Timeout</option>
              <option value="purge">Purge Messages</option>
              <option value="slowmode">Set Slowmode</option>
            </select>

            {['warn', 'clear_warnings', 'kick', 'ban', 'timeout', 'untimeout'].includes(selectedAction) && (
              <>
                <input
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="Search member by name or ID"
                  className="col-span-2 bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
                />
                {memberQuery.trim().length >= 2 && (
                  <div className="col-span-2 max-h-40 overflow-y-auto rounded-xl border border-outline-variant/10 bg-surface-container-high">
                    {members.length === 0 && <div className="px-3 py-2 text-xs text-on-surface-variant">No members found.</div>}
                    {members.map((m: any) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setAction({ ...action, userId: m.id });
                          setMemberQuery(`${m.displayName} (${m.id})`);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-white hover:bg-surface-container-highest"
                      >
                        {m.displayName} • {m.username} • {m.id}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  value={action.userId}
                  onChange={(e) => setAction({ ...action, userId: e.target.value })}
                  placeholder="Selected User ID"
                  className="col-span-2 bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
                />
              </>
            )}

            {['warn', 'kick', 'ban', 'timeout', 'untimeout', 'clear_warnings'].includes(selectedAction) && (
              <input
                value={action.reason}
                onChange={(e) => setAction({ ...action, reason: e.target.value })}
                placeholder="Reason"
                className="col-span-2 bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
              />
            )}

            {selectedAction === 'timeout' && (
              <input
                type="number"
                value={action.minutes}
                onChange={(e) => setAction({ ...action, minutes: Number(e.target.value || 10) })}
                placeholder="Minutes"
                className="col-span-2 bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
              />
            )}

            {['purge', 'lock', 'unlock', 'slowmode'].includes(selectedAction) && (
              <select
                value={action.channelId}
                onChange={(e) => setAction({ ...action, channelId: e.target.value })}
                className="col-span-2 bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">Select channel</option>
                {channels.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}

            {selectedAction === 'purge' && (
              <input
                type="number"
                value={action.amount}
                onChange={(e) => setAction({ ...action, amount: Number(e.target.value || 10) })}
                placeholder="Messages to delete (1-100)"
                className="col-span-2 bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
              />
            )}

            {selectedAction === 'slowmode' && (
              <input
                type="number"
                value={action.seconds}
                onChange={(e) => setAction({ ...action, seconds: Number(e.target.value || 0) })}
                placeholder="Slowmode seconds (0-21600)"
                className="col-span-2 bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
              />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={executeModerationAction}
              disabled={actionMutation.isPending}
              className="px-4 py-2 bg-primary rounded-lg text-xs font-black text-on-primary uppercase tracking-widest disabled:opacity-50"
            >
              {actionMutation.isPending ? "Executing..." : "Execute Action"}
            </button>
            <button
              onClick={() => setAction({ userId: "", reason: "", minutes: 10, amount: 10, channelId: "", seconds: 0 })}
              className="px-4 py-2 bg-surface-container-high rounded-lg text-xs font-bold text-white"
            >
              Reset Fields
            </button>
          </div>
          {actionMutation.isError && <p className="text-error text-xs">{(actionMutation.error as Error).message}</p>}
          {actionMutation.isSuccess && <p className="text-green-400 text-xs">Action executed successfully.</p>}
        </div>

        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-8 space-y-4">
          <h3 className="text-xl font-bold text-white">Raid Mode Controls</h3>
          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => securityMutation.mutate({ ...(security || {}), raid_mode_enabled: true })} className="px-4 py-3 rounded-xl bg-red-500/20 text-red-300 font-bold text-xs">Enable</button>
            <button onClick={() => securityMutation.mutate({ ...(security || {}), raid_mode_enabled: false })} className="px-4 py-3 rounded-xl bg-green-500/20 text-green-300 font-bold text-xs">Disable</button>
            <div className="px-4 py-3 rounded-xl bg-surface-container-high text-xs text-on-surface-variant flex items-center justify-center">Status: {(security as any)?.raid_mode_enabled ? "ON" : "OFF"}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
              Join Threshold / Window Seconds
            </div>
            <input
              type="number"
              defaultValue={(security as any)?.raid_join_threshold || 8}
              onBlur={(e) => securityMutation.mutate({ ...(security || {}), raid_join_threshold: Number(e.target.value || 8), raid_mode_enabled: (security as any)?.raid_mode_enabled || false })}
              className="bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
              placeholder="Join threshold"
            />
            <input
              type="number"
              defaultValue={(security as any)?.raid_window_seconds || 20}
              onBlur={(e) => securityMutation.mutate({ ...(security || {}), raid_window_seconds: Number(e.target.value || 20), raid_mode_enabled: (security as any)?.raid_mode_enabled || false })}
              className="bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
              placeholder="Window (seconds)"
            />
          </div>
          <p className="text-xs text-on-surface-variant">
            If this many members join within the window, anti-raid lockdown triggers automatically.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-8">
          <h3 className="text-xl font-bold text-white mb-4">Moderation Cases</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {cases.length === 0 && <p className="text-xs text-on-surface-variant">No cases yet.</p>}
            {cases.map((c: any) => (
              <div key={c.id} className="p-3 rounded-xl bg-surface-container-high border border-outline-variant/10">
                <p className="text-xs text-primary font-bold">{c.id}</p>
                <p className="text-sm text-white font-bold">{c.action}</p>
                <p className="text-xs text-on-surface-variant">User: {c.user_id} • Mod: {c.moderator_id}</p>
                <p className="text-xs text-on-surface-variant">{c.reason}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Members With Warnings</h3>
            <button
              onClick={() => refetchWarnings()}
              disabled={warningLoading}
              className="px-3 py-1.5 rounded-lg bg-surface-container-high text-xs font-bold text-white hover:bg-surface-container-highest disabled:opacity-50 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              {warningLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto mb-8">
            {warningSummary.length === 0 && <p className="text-xs text-on-surface-variant">No warned members.</p>}
            {warningSummary.map((w: any) => (
              <div key={w.user_id} className="p-3 rounded-xl bg-surface-container-high border border-outline-variant/10">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">{w.username}</p>
                  <span className="text-xs font-black text-secondary">{w.warning_count} warns</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">{w.latest_reason}</p>
                <p className="text-[10px] text-on-surface-variant mt-1">{new Date(w.latest_created_at).toLocaleString()}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      setAction({ ...action, userId: w.user_id });
                      setSelectedAction('clear_warnings');
                      setMemberQuery(`${w.username} (${w.user_id})`);
                    }}
                    className="px-3 py-1 rounded-lg bg-surface-container-highest text-xs font-bold text-white"
                  >
                    Prepare Clear
                  </button>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-xl font-bold text-white mb-4">Appeals Inbox</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {appeals.length === 0 && <p className="text-xs text-on-surface-variant">No appeals yet.</p>}
            {appeals.map((a: any) => (
              <div key={a.id} className="p-3 rounded-xl bg-surface-container-high border border-outline-variant/10">
                <p className="text-xs text-primary font-bold">Case: {a.case_id}</p>
                <p className="text-xs text-on-surface-variant">User: {a.user_id}</p>
                <p className="text-sm text-white">{a.reason}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => appealMutation.mutate({ appealId: a.id, status: 'approved' })} className="px-3 py-1 rounded-lg bg-green-500/20 text-green-300 text-xs font-bold">Approve</button>
                  <button onClick={() => appealMutation.mutate({ appealId: a.id, status: 'rejected' })} className="px-3 py-1 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
