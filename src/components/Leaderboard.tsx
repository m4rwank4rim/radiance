import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    Trophy,
    Medal,
    Star,
    Crown,
    ArrowUpCircle,
    Zap
} from "lucide-react";
import { motion } from "motion/react";

interface LeaderboardEntry {
    user_id: string;
    username: string;
    avatar: string | null;
    xp: number;
    level: number;
    rank: number;
}

export default function Leaderboard() {
    const { guildId } = useParams();

    const { data: entries, isLoading } = useQuery<LeaderboardEntry[]>({
        queryKey: ['leaderboard', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/leaderboard`);
            if (!res.ok) throw new Error("Failed to fetch leaderboard");
            return res.json();
        }
    });

    if (isLoading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    const topThree = (entries || []).slice(0, 3);
    const rest = (entries || []).slice(3);

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <Crown className="text-yellow-400" size={24} />;
        if (rank === 2) return <Medal className="text-gray-300" size={24} />;
        if (rank === 3) return <Medal className="text-amber-600" size={24} />;
        return <span className="text-on-surface-variant font-black">#{rank}</span>;
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-[2.5rem] border border-primary/20 text-primary mb-2 shadow-[0_0_50px_-12px_rgba(139,92,246,0.3)]">
                    <Trophy size={40} />
                </div>
                <h2 className="text-5xl font-black text-white tracking-tighter uppercase italic">Hall of Fame</h2>
                <p className="text-on-surface-variant max-w-lg mx-auto font-medium">The elite members who dominate the server economy and activity rankings.</p>
            </div>

            {/* Podium */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end max-w-5xl mx-auto px-4">
                {/* 2nd Place */}
                {topThree[1] && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="order-2 md:order-1 flex flex-col items-center"
                    >
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gray-400 blur-[30px] opacity-20 group-hover:opacity-40 transition-opacity" />
                            <img
                                src={topThree[1].avatar || `https://ui-avatars.com/api/?name=${topThree[1].username}&background=random`}
                                className="w-24 h-24 rounded-full border-4 border-gray-400 relative z-10 shadow-2xl"
                                alt={topThree[1].username}
                            />
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-surface-container rounded-full border-2 border-gray-400 flex items-center justify-center z-20">
                                <Medal className="text-gray-400" size={18} />
                            </div>
                        </div>
                        <div className="mt-6 text-center">
                            <div className="text-xl font-black text-white truncate w-40">{topThree[1].username}</div>
                            <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Level {topThree[1].level}</div>
                            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full text-xs font-black text-white border border-white/10">
                                <Zap size={12} className="text-yellow-400" /> {topThree[1].xp.toLocaleString()} XP
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* 1st Place */}
                {topThree[0] && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="order-1 md:order-2 flex flex-col items-center pb-8"
                    >
                        <div className="relative group">
                            <div className="absolute inset-0 bg-primary blur-[50px] opacity-40 group-hover:opacity-60 transition-opacity animate-pulse" />
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]">
                                <Crown size={48} />
                            </div>
                            <img
                                src={topThree[0].avatar || `https://ui-avatars.com/api/?name=${topThree[0].username}&background=random`}
                                className="w-36 h-36 rounded-full border-8 border-primary relative z-10 shadow-[0_0_40px_-5px_rgba(139,92,246,0.6)]"
                                alt={topThree[0].username}
                            />
                            <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-surface-container rounded-full border-4 border-primary flex items-center justify-center z-20 shadow-xl">
                                <span className="text-white font-black">#1</span>
                            </div>
                        </div>
                        <div className="mt-8 text-center">
                            <div className="text-3xl font-black text-white tracking-tight truncate w-60">{topThree[0].username}</div>
                            <div className="text-lg font-black text-primary uppercase tracking-[0.2em] mt-1 animate-pulse">Immortal</div>
                            <div className="mt-4 inline-flex items-center gap-2 px-6 py-2 bg-primary/20 rounded-full text-sm font-black text-white border border-primary/30 shadow-lg">
                                <Zap size={14} className="text-yellow-400" /> {topThree[0].xp.toLocaleString()} XP
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* 3rd Place */}
                {topThree[2] && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="order-3 md:order-3 flex flex-col items-center"
                    >
                        <div className="relative group">
                            <div className="absolute inset-0 bg-amber-700 blur-[30px] opacity-20 group-hover:opacity-40 transition-opacity" />
                            <img
                                src={topThree[2].avatar || `https://ui-avatars.com/api/?name=${topThree[2].username}&background=random`}
                                className="w-24 h-24 rounded-full border-4 border-amber-600 relative z-10 shadow-2xl"
                                alt={topThree[2].username}
                            />
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-surface-container rounded-full border-2 border-amber-600 flex items-center justify-center z-20">
                                <Medal className="text-amber-600" size={18} />
                            </div>
                        </div>
                        <div className="mt-6 text-center">
                            <div className="text-xl font-black text-white truncate w-40">{topThree[2].username}</div>
                            <div className="text-sm font-bold text-amber-600/70 uppercase tracking-widest mt-1">Level {topThree[2].level}</div>
                            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full text-xs font-black text-white border border-white/10">
                                <Zap size={12} className="text-yellow-400" /> {topThree[2].xp.toLocaleString()} XP
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* List View */}
            <div className="max-w-4xl mx-auto space-y-3">
                {rest.map((entry, i) => (
                    <motion.div
                        key={entry.user_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-surface-container-low p-4 rounded-2xl border border-white/5 flex items-center justify-between group hover:bg-surface-container hover:border-white/10 transition-all cursor-default"
                    >
                        <div className="flex items-center gap-6">
                            <div className="w-10 text-center flex justify-center">
                                {getRankIcon(entry.rank)}
                            </div>
                            <div className="relative">
                                <img
                                    src={entry.avatar || `https://ui-avatars.com/api/?name=${entry.username}&background=random`}
                                    className="w-12 h-12 rounded-xl group-hover:scale-110 transition-transform"
                                />
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-surface-container rounded-full" />
                            </div>
                            <div>
                                <div className="text-white font-black group-hover:text-primary transition-colors">{entry.username}</div>
                                <div className="text-[10px] uppercase font-black tracking-widest text-on-surface-variant flex items-center gap-2">
                                    <Star size={10} className="text-yellow-400" /> Tier {Math.floor(entry.level / 10) + 1} Member
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-8 px-4">
                            <div className="text-right">
                                <div className="text-white font-black tracking-tight">{entry.xp.toLocaleString()}</div>
                                <div className="text-[10px] uppercase font-black tracking-widest text-on-surface-variant">Total XP</div>
                            </div>
                            <div className="text-right w-20">
                                <div className="text-primary font-black text-xl leading-none">{entry.level}</div>
                                <div className="text-[10px] uppercase font-black tracking-widest text-on-surface-variant">Level</div>
                            </div>
                            <ArrowUpCircle size={20} className="text-white/5 group-hover:text-primary transition-colors" />
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
