import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from "recharts";
import {
    Users,
    MessageSquare,
    Terminal,
    TrendingUp,
    Activity,
    Calendar
} from "lucide-react";
import { motion } from "motion/react";
import { openUpgradeCheckout } from "../lib/billing";
import { toast } from "sonner";

export default function Analytics() {
    const { guildId } = useParams();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['analytics', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/analytics`);
            if (!res.ok) throw new Error("Failed to fetch analytics");
            return res.json();
        }
    });

    const { data: executive } = useQuery({
        queryKey: ['analyticsExecutive', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/analytics/executive`);
            if (!res.ok) return { kpis: null, trends: null, report: null };
            return res.json();
        },
        enabled: !!guildId
    });
    const { data: entitlements } = useQuery({
        queryKey: ['entitlements', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/entitlements`);
            if (!res.ok) return null;
            return res.json();
        },
        enabled: !!guildId
    });
    const analyticsLocked = !(entitlements?.features?.executive_analytics);

    const reportMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/analytics/weekly-report`, { method: "POST" });
            if (!res.ok) throw new Error("Failed to generate report");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['analyticsExecutive', guildId] });
        }
    });

    if (isLoading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    const history = data?.history || [];
    const latest = history[history.length - 1] || {};
    const previous = history[history.length - 2] || {};

    const stats = [
        {
            label: "Total Members",
            value: latest.total_members || 0,
            change: latest.total_members - (previous.total_members || 0),
            icon: Users,
            color: "text-blue-400",
            bg: "bg-blue-400/10"
        },
        {
            label: "Messages (24h)",
            value: latest.messages_24h || 0,
            change: latest.messages_24h - (previous.messages_24h || 0),
            icon: MessageSquare,
            color: "text-green-400",
            bg: "bg-green-400/10"
        },
        {
            label: "Commands Used",
            value: latest.commands_used || 0,
            change: latest.commands_used - (previous.commands_used || 0),
            icon: Terminal,
            color: "text-purple-400",
            bg: "bg-purple-400/10"
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                        <TrendingUp size={24} />
                    </div>
                    Analytics Hub
                </h2>
                <p className="text-on-surface-variant font-medium mt-2">Real-time insights and historical performance tracking for your community.</p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-surface-container-low p-6 rounded-[2rem] border border-white/5 shadow-xl relative overflow-hidden"
                    >
                        <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-4`}>
                            <stat.icon size={24} />
                        </div>
                        <div className="text-on-surface-variant text-xs font-black uppercase tracking-widest mb-1">{stat.label}</div>
                        <div className="text-3xl font-black text-white flex items-end gap-3">
                            {stat.value.toLocaleString()}
                            <span className={`text-xs font-bold ${stat.change >= 0 ? 'text-green-400' : 'text-red-400'} mb-1.5`}>
                                {stat.change >= 0 ? '+' : ''}{stat.change}
                            </span>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-[40px] rounded-full -mr-16 -mt-16" />
                    </motion.div>
                ))}
            </div>

            {/* Executive KPI */}
            <div className="bg-surface-container-low p-6 rounded-[2rem] border border-white/5 shadow-xl">
                <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight">Executive KPI Snapshot</h3>
                        <p className="text-on-surface-variant text-xs">Operational + revenue-readiness indicators for weekly reviews.</p>
                    </div>
                    <button
                        onClick={() => reportMutation.mutate()}
                        disabled={analyticsLocked || reportMutation.isPending}
                        className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
                    >
                        {analyticsLocked ? "Upgrade Required" : (reportMutation.isPending ? "Generating..." : "Generate Weekly Report")}
                    </button>
                </div>
                {analyticsLocked && (
                    <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-between gap-3">
                        <span>Executive analytics and weekly reports are locked on Free plan.</span>
                        <button
                            onClick={() => guildId && openUpgradeCheckout(guildId, "business").catch((err) => toast.error(err?.message || "Checkout unavailable"))}
                            className="px-3 py-1.5 rounded-md bg-amber-400/20 text-amber-200 text-[11px] font-bold whitespace-nowrap"
                        >
                            Upgrade Plan
                        </button>
                    </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="p-3 rounded-xl bg-surface-container-high">
                        <div className="text-xs text-on-surface-variant">Open Incidents</div>
                        <div className="text-2xl font-black text-white">{executive?.kpis?.openIncidents ?? 0}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container-high">
                        <div className="text-xs text-on-surface-variant">SLA Breaches</div>
                        <div className="text-2xl font-black text-white">{executive?.kpis?.slaBreaches ?? 0}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container-high">
                        <div className="text-xs text-on-surface-variant">Members</div>
                        <div className="text-2xl font-black text-white">{executive?.kpis?.members ?? 0}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container-high">
                        <div className="text-xs text-on-surface-variant">Msgs/24h</div>
                        <div className="text-2xl font-black text-white">{executive?.kpis?.messages24h ?? 0}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container-high">
                        <div className="text-xs text-on-surface-variant">Cmds/24h</div>
                        <div className="text-2xl font-black text-white">{executive?.kpis?.commands24h ?? 0}</div>
                    </div>
                </div>
                {executive?.report?.summary && (
                    <div className="mt-4 p-3 rounded-xl bg-primary/10 border border-primary/20 text-sm text-white">
                        {executive.report.summary}
                    </div>
                )}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Member Growth Chart */}
                <div className="bg-surface-container-low p-8 rounded-[2rem] border border-white/5 shadow-xl">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <Activity className="text-primary" size={20} />
                            <h3 className="text-xl font-black text-white tracking-tight">Member Growth</h3>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant bg-white/5 px-3 py-1.5 rounded-full">
                            <Calendar size={12} /> Last 30 Days
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#ffffff40"
                                    fontSize={10}
                                    fontWeight="bold"
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(str) => new Date(str).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                />
                                <YAxis
                                    stroke="#ffffff40"
                                    fontSize={10}
                                    fontWeight="bold"
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1E1B2E',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '1rem',
                                        fontSize: '12px',
                                        fontWeight: 'bold'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total_members"
                                    stroke="#8B5CF6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorMembers)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Activity Chart */}
                <div className="bg-surface-container-low p-8 rounded-[2rem] border border-white/5 shadow-xl">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <Activity className="text-secondary" size={20} />
                            <h3 className="text-xl font-black text-white tracking-tight">Engagement Flow</h3>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#ffffff40"
                                    fontSize={10}
                                    fontWeight="bold"
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(str) => new Date(str).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                />
                                <YAxis
                                    stroke="#ffffff40"
                                    fontSize={10}
                                    fontWeight="bold"
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1E1B2E',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '1rem',
                                        fontSize: '12px',
                                        fontWeight: 'bold'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Bar dataKey="messages_24h" name="Messages" fill="#10B981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="commands_used" name="Commands" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
