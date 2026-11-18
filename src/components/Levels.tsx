import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Settings2,
    Sparkles,
    MessageSquare,
    Hash,
    Image as ImageIcon,
    Palette,
    Type,
    Info,
    Eye,
    Save,
    TrendingUp,
    Award
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export default function Levels() {
    const { guildId } = useParams();
    const queryClient = useQueryClient();
    const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    // Form states
    const [newRewardLevel, setNewRewardLevel] = useState(1);
    const [newRewardRoleId, setNewRewardRoleId] = useState("");

    const [xpRate, setXpRate] = useState(1.0);
    const [levelUpMessage, setLevelUpMessage] = useState("");
    const [levelUpChannel, setLevelUpChannel] = useState("");
    const [levelUpBg, setLevelUpBg] = useState("");
    const [levelUpTextColor, setLevelUpTextColor] = useState("#ffffff");
    const [levelUpAccentColor, setLevelUpAccentColor] = useState("#d0bcff");

    const { data: config } = useQuery({
        queryKey: ['guildConfig', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/config`);
            if (!res.ok) throw new Error("Failed to fetch config");
            const data = await res.json();
            return data;
        },
        enabled: !!guildId
    });

    useEffect(() => {
        if (config) {
            const canvas = config.active_modules?.canvas || {};
            setXpRate(config.xp_rate || 1.0);
            setLevelUpMessage(config.level_up_message || "");
            setLevelUpChannel(config.level_up_channel || "");
            setLevelUpBg(canvas.level_up_background_url || "");
            setLevelUpTextColor(canvas.level_up_text_color || "#ffffff");
            setLevelUpAccentColor(canvas.level_up_accent_color || "#d0bcff");
        }
    }, [config]);

    const { data: channels = [] } = useQuery({
        queryKey: ['channels', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/channels`);
            if (!res.ok) throw new Error("Failed to fetch channels");
            return res.json();
        },
        enabled: !!guildId
    });

    const updateSettingsMutation = useMutation({
        mutationFn: async (settings: any) => {
            const res = await fetch(`/api/guilds/${guildId}/levels/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (!res.ok) throw new Error("Failed to update settings");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['guildConfig', guildId] });
            setIsSettingsModalOpen(false);
        }
    });

    const { data: levels = [], isLoading: levelsLoading } = useQuery({
        queryKey: ['levels', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/levels`);
            if (!res.ok) throw new Error("Failed to fetch levels");
            return res.json();
        },
        enabled: !!guildId
    });

    const { data: rewards = [], isLoading: rewardsLoading } = useQuery({
        queryKey: ['rewards', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/rewards`);
            if (!res.ok) throw new Error("Failed to fetch rewards");
            return res.json();
        },
        enabled: !!guildId
    });

    const { data: roles = [] } = useQuery({
        queryKey: ['roles', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/roles`);
            if (!res.ok) throw new Error("Failed to fetch roles");
            return res.json();
        },
        enabled: !!guildId
    });

    const addRewardMutation = useMutation({
        mutationFn: async (reward: { level: number, role_id: string }) => {
            const res = await fetch(`/api/guilds/${guildId}/rewards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reward)
            });
            if (!res.ok) throw new Error("Failed to add reward");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rewards', guildId] });
            setIsRewardModalOpen(false);
            setNewRewardLevel(1);
            setNewRewardRoleId("");
        }
    });

    const deleteRewardMutation = useMutation({
        mutationFn: async (rewardId: string) => {
            const res = await fetch(`/api/guilds/${guildId}/rewards/${rewardId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error("Failed to delete reward");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rewards', guildId] });
        }
    });

    const CanvasPreview = ({ bg, text, accent, message }: any) => (
        <div className="relative w-full aspect-[3/1] rounded-2xl overflow-hidden border border-white/10 shadow-lg">
            {/* Background */}
            {bg ? (
                <img src={bg} alt="Canvas Background" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-surface-container-high to-surface" />
            )}

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />

            {/* Content Mockup */}
            <div className="relative h-full flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-4 max-w-[70%]">
                    <div className="w-14 h-14 rounded-full border-2 overflow-hidden shadow-lg shrink-0" style={{ borderColor: accent }}>
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" className="w-full h-full bg-surface-container-highest" />
                    </div>
                    <div className="text-left overflow-hidden">
                        <h3 className="text-xs font-black uppercase tracking-widest leading-none mb-1 shrink-0" style={{ color: text }}>LEVEL UP!</h3>
                        <p className="text-[11px] font-bold leading-tight truncate" style={{ color: accent }}>
                            {message.replace('{user}', 'Username').replace('{level}', '10')}
                        </p>
                    </div>
                </div>

                <div className="text-right shrink-0">
                    <div className="text-xl font-black tabular-nums tracking-tighter leading-none" style={{ color: text }}>10</div>
                    <div className="text-[7px] font-black uppercase tracking-widest opacity-60" style={{ color: text }}>Current Level</div>
                </div>

                <div className="absolute top-2 right-4 flex items-center gap-1.5 opacity-30">
                    <Sparkles size={8} className="text-white" />
                    <span className="text-[6px] font-black text-white uppercase tracking-widest">Canvas V2</span>
                </div>
            </div>
        </div>
    );

    const isLoading = levelsLoading || rewardsLoading;

    if (isLoading) {
        return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20">Economy System</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    </div>
                    <h2 className="text-4xl font-black text-white tracking-tighter">Leveling & Rewards</h2>
                    <p className="text-on-surface-variant font-medium mt-1">Configure XP distribution, visual rank cards, and automated role rewards.</p>
                </div>
                <button
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="px-6 py-3 bg-surface-container-low hover:bg-surface-container-high border border-white/5 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Settings2 size={16} />
                    Engine Settings
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass-card rounded-[2.5rem] border border-outline-variant/10 overflow-hidden">
                        <div className="p-8 border-b border-outline-variant/10 bg-surface-container-high/20 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                                    <TrendingUp size={20} />
                                </div>
                                <h3 className="font-black text-white uppercase tracking-tighter">Server Leaderboard</h3>
                            </div>
                            <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-black">Season Active</span>
                        </div>
                        <div className="divide-y divide-outline-variant/5">
                            {levels.map((user: any, i: number) => (
                                <div key={user.user_id} className="p-6 flex items-center gap-8 hover:bg-white/[0.02] transition-colors group">
                                    <div className="w-12 text-center shrink-0">
                                        <span className={cn(
                                            "font-black text-2xl tracking-tighter",
                                            i === 0 ? "text-primary" : i === 1 ? "text-secondary" : i === 2 ? "text-accent" : "text-on-surface-variant opacity-40"
                                        )}>
                                            {i === 0 ? "01" : i === 1 ? "02" : i === 2 ? "03" : (i + 1).toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                    <div className="relative">
                                        {user.avatar ? (
                                            <img src={user.avatar} alt="User" className="w-14 h-14 rounded-2xl border border-white/10 group-hover:scale-105 transition-transform" />
                                        ) : (
                                            <div className="w-14 h-14 rounded-2xl bg-surface-container-highest flex items-center justify-center text-primary font-black text-xl">
                                                {user.username?.charAt(0) || '?'}
                                            </div>
                                        )}
                                        {i < 3 && (
                                            <div className={cn(
                                                "absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-[#131316]",
                                                i === 0 ? "bg-primary text-on-primary" : i === 1 ? "bg-secondary text-on-secondary" : "bg-accent text-on-accent"
                                            )}>
                                                <Award size={12} strokeWidth={3} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-black text-white text-lg tracking-tight leading-none mb-1">{user.username}</div>
                                        <div className="flex items-center gap-3">
                                            <div className="px-2 py-0.5 bg-white/5 rounded text-[10px] font-black uppercase tracking-widest text-primary">Level {user.level}</div>
                                            <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{user.xp.toLocaleString()} XP Points</div>
                                        </div>
                                    </div>
                                    <div className="text-right hidden sm:flex flex-col items-end gap-2">
                                        <div className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest tabular-nums">
                                            {Math.min(100, Math.floor((user.xp % 1000) / 10))}% Progression
                                        </div>
                                        <div className="h-1.5 w-40 bg-surface-container-highest rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(100, (user.xp % 1000) / 10)}%` }}
                                                className="h-full bg-primary shadow-lg shadow-primary/20"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {levels.length === 0 && (
                                <div className="p-20 text-center">
                                    <div className="w-20 h-20 bg-surface-container-low rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/5">
                                        <TrendingUp size={40} className="text-on-surface-variant opacity-20" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">No XP data available yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="glass-card p-10 rounded-[2.5rem] border border-outline-variant/10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                            <Award size={120} />
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8 relative z-10">Reward Roles</h3>
                        <div className="space-y-3 relative z-10">
                            {rewards.length > 0 ? rewards.map((reward: any) => {
                                const role = roles.find((r: any) => r.id === reward.role_id);
                                return (
                                    <div key={reward.id} className="flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.04] rounded-2xl border border-white/5 group/reward transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ color: role?.color || '#8B5CF6' }} />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-white leading-tight">{role?.name || "Unknown Role"}</span>
                                                <span className="text-[10px] uppercase tracking-widest font-black text-primary">Requirement: Lvl {reward.level}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => deleteRewardMutation.mutate(reward.id)}
                                            className="opacity-0 group-hover/reward:opacity-100 p-2 text-accent hover:bg-accent/10 rounded-xl transition-all"
                                        >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-10">
                                    <div className="w-16 h-16 bg-white/[0.02] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
                                        <Award size={24} className="text-on-surface-variant opacity-20" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">No rewards active</p>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setIsRewardModalOpen(true)}
                            className="w-full mt-10 py-4 bg-surface-container-highest text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-all relative z-10"
                        >
                            Authorize New Reward
                        </button>
                    </div>

                    {/* Reward Modal */}
                    <AnimatePresence>
                        {isRewardModalOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 lg:p-12">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setIsRewardModalOpen(false)}
                                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                                />
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                    className="bg-surface border border-outline-variant/10 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative z-10"
                                >
                                    <div className="p-10 border-b border-outline-variant/10 flex justify-between items-center">
                                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">New Level Reward</h3>
                                        <button onClick={() => setIsRewardModalOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-on-surface-variant hover:text-white transition-colors">
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                    <div className="p-10 space-y-6">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                                                <TrendingUp size={14} className="text-primary" /> Target Level
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={newRewardLevel}
                                                onChange={(e) => setNewRewardLevel(parseInt(e.target.value))}
                                                className="w-full bg-surface-container-low border border-white/5 rounded-2xl p-5 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-black"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                                                <Award size={14} className="text-primary" /> Reward Role
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={newRewardRoleId}
                                                    onChange={(e) => setNewRewardRoleId(e.target.value)}
                                                    className="w-full bg-surface-container-low border border-white/5 rounded-2xl p-5 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none font-bold cursor-pointer"
                                                >
                                                    <option value="">Select an award role...</option>
                                                    {roles.map((role: any) => (
                                                        <option key={role.id} value={role.id}>{role.name}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                                                    <span className="material-symbols-outlined">expand_more</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            disabled={!newRewardRoleId || addRewardMutation.isPending}
                                            onClick={() => addRewardMutation.mutate({ level: newRewardLevel, role_id: newRewardRoleId })}
                                            className="w-full py-5 bg-primary text-on-primary rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 mt-4 shadow-xl shadow-primary/20"
                                        >
                                            {addRewardMutation.isPending ? "Allocating..." : "Finalize Reward"}
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Settings Modal */}
                    <AnimatePresence>
                        {isSettingsModalOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setIsSettingsModalOpen(false)}
                                    className="fixed inset-0 bg-black/80 backdrop-blur-md"
                                />
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                    className="bg-surface border border-outline-variant/10 rounded-[3rem] w-full max-w-4xl shadow-2xl relative z-10"
                                >
                                    <div className="p-10 border-b border-outline-variant/10 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                                <Settings2 size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Economy Engine</h3>
                                                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest leading-none">Canvas & Progression</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setIsSettingsModalOpen(false)} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-on-surface-variant hover:text-white transition-colors">
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                    <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-12 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                        <div className="space-y-8">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                                                    <Sparkles size={14} className="text-primary" /> XP Multiplier
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0.1"
                                                    value={xpRate}
                                                    onChange={(e) => setXpRate(parseFloat(e.target.value))}
                                                    className="w-full bg-surface-container-low border border-white/5 rounded-2xl p-5 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-black text-xl"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                                                    <MessageSquare size={14} className="text-primary" /> Announcement Template
                                                </label>
                                                <textarea
                                                    value={levelUpMessage}
                                                    onChange={(e) => setLevelUpMessage(e.target.value)}
                                                    placeholder="GG {user}, you reached level {level}!"
                                                    className="w-full bg-surface-container-low border border-white/5 rounded-2xl p-5 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[140px] text-sm leading-relaxed"
                                                />
                                                <div className="flex gap-2 mt-3">
                                                    <code className="px-2 py-1 bg-primary/10 rounded text-[9px] font-bold text-primary">{"{user}"}</code>
                                                    <code className="px-2 py-1 bg-primary/10 rounded text-[9px] font-bold text-primary">{"{level}"}</code>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                                                    <Hash size={14} className="text-primary" /> Announcement Channel
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        value={levelUpChannel}
                                                        onChange={(e) => setLevelUpChannel(e.target.value)}
                                                        className="w-full bg-surface-container-low border border-white/5 rounded-2xl p-5 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none font-bold cursor-pointer"
                                                    >
                                                        <option value="">Current Channel (Default)</option>
                                                        {channels.map((chan: any) => (
                                                            <option key={chan.id} value={chan.id}>#{chan.name}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                                                        <span className="material-symbols-outlined">expand_more</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                                                    <Eye size={14} className="text-primary" /> Canvas Preview
                                                </label>
                                                <CanvasPreview
                                                    bg={levelUpBg}
                                                    text={levelUpTextColor}
                                                    accent={levelUpAccentColor}
                                                    message={levelUpMessage}
                                                />
                                            </div>

                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                                                        <ImageIcon size={14} className="text-primary" /> Background Image
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={levelUpBg}
                                                        onChange={(e) => setLevelUpBg(e.target.value)}
                                                        className="w-full bg-surface-container-low border border-white/5 rounded-2xl p-5 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-xs"
                                                        placeholder="https://example.com/background.png"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                                                            <Palette size={14} className="text-primary" /> Accent
                                                        </label>
                                                        <div className="flex items-center gap-3 bg-surface-container-low border border-white/5 p-4 rounded-2xl">
                                                            <input
                                                                type="color"
                                                                value={levelUpAccentColor}
                                                                onChange={(e) => setLevelUpAccentColor(e.target.value)}
                                                                className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer p-0"
                                                            />
                                                            <span className="text-[10px] font-black text-white uppercase tabular-nums">{levelUpAccentColor}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                                                            <Type size={14} className="text-primary" /> Text
                                                        </label>
                                                        <div className="flex items-center gap-3 bg-surface-container-low border border-white/5 p-4 rounded-2xl">
                                                            <input
                                                                type="color"
                                                                value={levelUpTextColor}
                                                                onChange={(e) => setLevelUpTextColor(e.target.value)}
                                                                className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer p-0"
                                                            />
                                                            <span className="text-[10px] font-black text-white uppercase tabular-nums">{levelUpTextColor}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10 flex gap-4">
                                                <Info className="shrink-0 text-primary" size={20} />
                                                <div className="text-[11px] text-on-surface-variant leading-relaxed">
                                                    <p className="font-black text-white uppercase tracking-widest mb-1">Engine Information</p>
                                                    Visual level-up cards are generated on dispatch. For optimal performance, ensure background URLs are directly accessible.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-10 pt-0 flex gap-4">
                                        <button
                                            onClick={() => setIsSettingsModalOpen(false)}
                                            className="flex-1 py-5 bg-surface-container-highest text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                                        >
                                            Discard
                                        </button>
                                        <button
                                            onClick={() => updateSettingsMutation.mutate({
                                                xp_rate: xpRate,
                                                level_up_message: levelUpMessage,
                                                level_up_channel: levelUpChannel,
                                                level_up_background_url: levelUpBg,
                                                level_up_text_color: levelUpTextColor,
                                                level_up_accent_color: levelUpAccentColor
                                            })}
                                            disabled={updateSettingsMutation.isPending}
                                            className="flex-[2] py-5 bg-primary text-on-primary rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.99] shadow-xl shadow-primary/20"
                                        >
                                            {updateSettingsMutation.isPending ? "Processing..." : "Commit Engine Changes"}
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
