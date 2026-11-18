import { motion } from "motion/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "../lib/utils";

export default function DashboardOverview() {
  const { guildId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['stats', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/stats/${guildId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.details || err.error || "Failed to fetch stats");
      }
      return res.json();
    },
    enabled: !!guildId,
    refetchInterval: 10000,
  });

  const { data: config, isLoading: configLoading, error: configError } = useQuery({
    queryKey: ['guildConfig', guildId],
    queryFn: async () => {
      console.log(`Fetching config for guild: ${guildId}`);
      const res = await fetch(`/api/guilds/${guildId}/config`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.details || err.error || "Failed to fetch config");
      }
      return res.json();
    },
    enabled: !!guildId,
    refetchInterval: 30000,
  });

  const { data: diagnostics, refetch: refetchDiagnostics, isFetching: diagnosticsRefreshing } = useQuery({
    queryKey: ['diagnostics', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/diagnostics`);
      if (!res.ok) {
        throw new Error("Failed to fetch diagnostics");
      }
      return res.json();
    },
    enabled: !!guildId,
    refetchInterval: 20000,
  });

  const { data: diagnosticsHistory = [], refetch: refetchDiagnosticsHistory } = useQuery({
    queryKey: ['diagnosticsHistory', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/diagnostics/history`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!guildId,
    refetchInterval: 30000,
  });

  const { data: activityLogs = [] } = useQuery({
    queryKey: ['activityLogs', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/activity-logs`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!guildId,
    refetchInterval: 5000,
  });

  if (statsLoading || configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-neon" />
      </div>
    );
  }

  if (statsError || configError || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <span className="material-symbols-outlined text-error text-5xl mb-4">error</span>
        <h3 className="text-xl font-bold text-white mb-2">Failed to load server data</h3>
        <p className="text-zinc-500 text-sm max-w-xs">
          {(statsError as Error)?.message || (configError as Error)?.message || "The server connection was aborted. Please try refreshing the page."}
        </p>
        <button
          onClick={() => queryClient.invalidateQueries()}
          className="mt-6 px-6 py-2.5 bg-surface-container-high text-white rounded-xl font-semibold text-xs border border-white/10 hover:border-primary/30 transition-all"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const activeModules = config?.active_modules || {
    moderation: true,
    leveling: true,
    commands: true
  };

  const togglePlugin = async (pluginId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/guilds/${guildId}/plugins/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId, enabled })
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['guildConfig', guildId] });
      }
    } catch (err) {
      console.error("Failed to toggle plugin:", err);
    }
  };

  const exportDiagnosticsChecklist = () => {
    const failed = (diagnostics?.checks || []).filter((c: any) => !c.ok);
    const lines = [
      `Radiance Diagnostics Checklist`,
      `Guild: ${stats?.name || guildId}`,
      `Generated: ${new Date().toISOString()}`,
      `Failed checks: ${failed.length}`,
      "",
      ...failed.map((check: any, idx: number) =>
        `${idx + 1}. ${check.label}\n   - Severity: ${check.severity || "warning"}\n   - Details: ${check.details}\n   - Fix: ${check.tip || "Review module settings."}\n   - Route: ${check.route || "N/A"}`
      )
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `radiance-diagnostics-${guildId || "guild"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveDiagnosticsSnapshot = async (action: string, note?: string, targetCheckId?: string) => {
    await fetch(`/api/guilds/${guildId}/diagnostics/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: note || null, targetCheckId: targetCheckId || null })
    });
    await Promise.all([refetchDiagnostics(), refetchDiagnosticsHistory()]);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-1">
            {stats?.name || config?.name || "Overview"}
          </h2>
          <p className="text-zinc-500 text-sm font-medium">Real-time server metrics and system health</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-surface-container rounded-xl text-zinc-300 transition-all text-[10px] font-semibold uppercase tracking-widest border border-white/5 hover:border-white/10">
            <span className="material-symbols-outlined text-sm">download</span>
            Export Data
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-primary/20 rounded-xl text-primary transition-all text-[10px] font-bold uppercase tracking-widest shadow-neon border border-primary/20 hover:bg-primary/30">
            <span className="material-symbols-outlined text-sm">refresh</span>
            Sync
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Members", value: stats.memberGrowth[stats.memberGrowth.length - 1]?.members?.toLocaleString() || "0", icon: "group", trend: stats.trends?.members || "0%", color: "text-primary", bg: "bg-primary/10", glow: "shadow-neon" },
          { label: "Messages (24h)", value: stats.messages.toLocaleString(), icon: "forum", trend: stats.trends?.messages || "0%", color: "text-secondary", bg: "bg-secondary/10", glow: "shadow-secondary-glow" },
          { label: "Commands Used", value: stats.commandsUsed.toLocaleString(), icon: "terminal", trend: stats.trends?.commands || "Stable", color: "text-tertiary", bg: "bg-tertiary/10", glow: "shadow-neon-cyan" },
          { label: "Active in Voice", value: stats.activeVoice.toLocaleString(), icon: "keyboard_voice", trend: stats.trends?.voice || "0%", color: "text-bioluminescent", bg: "bg-bioluminescent/10", glow: "shadow-neon-cyan" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className="glass-card p-5 rounded-2xl relative overflow-hidden group"
          >
            <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500", stat.glow, "animate-pulse-glow")} />
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={cn("p-2.5 rounded-xl", stat.bg)}>
                <span className={cn("material-symbols-outlined text-lg", stat.color)}>{stat.icon}</span>
              </div>
              <span className={cn("text-[10px] font-bold uppercase tracking-widest", stat.trend.includes('+') ? "text-bioluminescent" : "text-zinc-500")}>
                {stat.trend}
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">{stat.label}</p>
              <h3 className="text-3xl font-black tracking-tighter text-white">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="lg:col-span-2 glass-card rounded-2xl overflow-hidden flex flex-col"
        >
          <div className="p-6 pb-0">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h4 className="text-lg font-bold tracking-tight text-white">Member Growth</h4>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Activity over the last 30 days</p>
              </div>
              <div className="flex gap-1.5 bg-surface-container-low p-1 rounded-lg">
                <button className="px-3 py-1.5 text-[10px] font-bold uppercase bg-primary text-white rounded-lg tracking-widest shadow-neon">30D</button>
                <button className="px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-500 hover:text-white transition-colors tracking-widest">90D</button>
                <button className="px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-500 hover:text-white transition-colors tracking-widest">1Y</button>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-[280px] w-full mt-2 px-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.memberGrowth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" fontSize={10} fontWeight="600" tickLine={false} axisLine={false} tickFormatter={(val) => val.toUpperCase()} />
                <YAxis stroke="#52525b" fontSize={10} fontWeight="600" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0e0e10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f4f4f5', fontSize: '11px', fontWeight: '600' }}
                  itemStyle={{ color: '#8B5CF6' }}
                />
                <Area type="monotone" dataKey="members" stroke="#8B5CF6" strokeWidth={3} fillOpacity={1} fill="url(#colorMembers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="glass-card p-5 rounded-2xl"
          >
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-bioluminescent shadow-neon-cyan animate-pulse"></span>
              System Status
            </h4>
            <div className="space-y-3">
              {[
                { label: "API Latency", value: stats.systemStatus?.apiLatency || "24ms", icon: "speed", color: "text-tertiary" },
                { label: "Uptime", value: stats.systemStatus?.uptime || "99.99%", icon: "cloud_done", color: "text-primary" },
                { label: "Voice Nodes", value: stats.systemStatus?.voiceNodes || "12 Active", icon: "dns", color: "text-white" },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-surface-container-low border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-zinc-500 text-sm">{item.icon}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{item.label}</span>
                  </div>
                  <span className={cn("text-xs font-bold tabular-nums", item.color)}>{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="glass-card p-5 rounded-2xl"
          >
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-5">Active Modules</h4>
            <div className="space-y-3">
              {[
                { name: "Auto-Mod", active: activeModules.moderation, icon: "shield", id: 'moderation' },
                { name: "Leveling System", active: activeModules.leveling, icon: "auto_graph", id: 'leveling' },
              ].map((mod, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-surface-container-highest flex items-center justify-center border border-white/5">
                      <span className="material-symbols-outlined text-sm text-zinc-400">{mod.icon}</span>
                    </div>
                    <span className="text-xs font-semibold text-zinc-300">{mod.name}</span>
                  </div>
                  <div
                    onClick={() => {
                      const newModules = { ...activeModules, [mod.id]: !mod.active };
                      fetch(`/api/guilds/${guildId}/config`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ active_modules: newModules })
                      }).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['guildConfig', guildId] });
                      });
                    }}
                    className={cn(
                      "w-11 h-6 rounded-full p-1 transition-all relative cursor-pointer border",
                      mod.active ? 'bg-primary border-primary shadow-neon' : 'bg-surface-container-highest border-white/10'
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full bg-white transition-transform",
                      mod.active ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="glass-card p-5 rounded-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Diagnostics</h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportDiagnosticsChecklist}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-container-highest border border-white/5 text-[9px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                >
                  Export
                </button>
                <button
                  onClick={() => refetchDiagnostics()}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-container-highest border border-white/5 text-[9px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                >
                  {diagnosticsRefreshing ? "Running..." : "Run"}
                </button>
              </div>
            </div>
            <div className="mb-4 p-3 rounded-xl bg-surface-container-low border border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Integration Health</span>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                diagnostics?.failedCount > 0 ? "text-warning" : "text-bioluminescent"
              )}>
                {diagnostics?.failedCount > 0 ? `${diagnostics.failedCount} Issues` : "All Good"}
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {(diagnostics?.checks || []).slice(0, 6).map((check: any) => (
                <div key={check.id} className="p-2.5 rounded-xl bg-surface-container-low border border-white/5">
                  <p className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                    <span>{check.ok ? "✓" : "✗"}</span>
                    {check.label}
                    <span className={cn(
                      "ml-auto text-[8px] uppercase tracking-widest font-bold",
                      check.severity === "error" ? "text-error" : check.severity === "warning" ? "text-warning" : "text-zinc-500"
                    )}>
                      {check.severity || "info"}
                    </span>
                  </p>
                  {!check.ok && check.route && (
                    <button
                      onClick={() => navigate(check.route)}
                      className="text-[9px] font-semibold uppercase tracking-widest text-primary mt-2 hover:text-white transition-colors"
                    >
                      Open Setting →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
        className="glass-card rounded-2xl overflow-hidden"
      >
        <div className="p-5 border-b border-white/5 bg-surface-container-low/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <span className="material-symbols-outlined text-primary text-sm">terminal</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Live Activity Console</h4>
              <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">Real-time system events</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bioluminescent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-bioluminescent"></span>
            </span>
            <span className="text-[9px] font-bold text-bioluminescent uppercase tracking-widest">Live</span>
          </div>
        </div>
        <div className="p-4 bg-void min-h-[180px] max-h-[260px] overflow-y-auto font-mono text-[11px]">
          {activityLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-600 italic">
              Waiting for incoming events...
            </div>
          ) : (
            <div className="space-y-1.5">
              {activityLogs.map((log: any, idx: number) => (
                <div key={idx} className="flex gap-3 group">
                  <span className="text-zinc-600 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-widest shrink-0",
                    log.type === 'error' ? 'bg-error/10 text-error' : 
                    log.type === 'warning' ? 'bg-warning/10 text-warning' : 
                    'bg-primary/10 text-primary'
                  )}>
                    {log.type || 'info'}
                  </span>
                  <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <footer className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 items-center border-t border-white/5 pt-8">
        <div className="flex items-center gap-5">
          <div className="flex -space-x-3">
            {[1, 2, 3, 4].map((i) => (
              <img
                key={i}
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Staff${i}`}
                alt={`Staff ${i}`}
                className="w-9 h-9 rounded-full border-2 border-void object-cover bg-surface-container-high"
              />
            ))}
            <div className="w-9 h-9 rounded-full border-2 border-void bg-surface-container-highest flex items-center justify-center text-[10px] font-bold text-white">+{Math.max(0, Math.floor((stats.activeVoice || 0) / 10))}</div>
          </div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">Online moderators</p>
        </div>
        <div className="flex justify-end gap-10">
          <div className="text-right">
            <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">Region</p>
            <p className="text-sm font-bold text-white">{stats.region || "Global"}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">Last Deploy</p>
            <p className="text-sm font-bold text-white">{stats.lastDeploy || "Recent"}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}