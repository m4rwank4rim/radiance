import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import {
    Save,
    Hash,
    Info,
    ShieldAlert,
    MessageSquare,
    Users,
    Mic2,
    Settings2
} from "lucide-react";
import { cn } from "../lib/utils";

export default function Logging() {
    const { guildId } = useParams();
    const queryClient = useQueryClient();

    const [enabled, setEnabled] = useState(false);
    const [channelId, setChannelId] = useState("");
    const [logMessages, setLogMessages] = useState(true);
    const [logMembers, setLogMembers] = useState(true);
    const [logVoice, setLogVoice] = useState(true);
    const [logServer, setLogServer] = useState(true);

    // Fetch Guild Config
    const { data: guild, isLoading } = useQuery({
        queryKey: ['guild', guildId],
        queryFn: async () => {
            const { data, error } = await supabase!
                .from('guilds')
                .select('*')
                .eq('id', guildId)
                .single();
            if (error) throw error;
            return data;
        }
    });

    // Fetch Channels
    const { data: channels = [] } = useQuery({
        queryKey: ['channels', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/channels`);
            return res.json();
        }
    });

    useEffect(() => {
        if (guild) {
            setEnabled(guild.logging_enabled || false);
            setChannelId(guild.logging_channel_id || "");
            setLogMessages(guild.log_messages !== false);
            setLogMembers(guild.log_members !== false);
            setLogVoice(guild.log_voice !== false);
            setLogServer(guild.log_server !== false);
        }
    }, [guild]);

    const updateSettingsMutation = useMutation({
        mutationFn: async (settings: any) => {
            const res = await fetch(`/api/guilds/${guildId}/logging/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (!res.ok) throw new Error("Failed to update settings");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['guild', guildId] });
            toast.success("Logging settings updated!");
        },
        onError: (err: any) => {
            toast.error(err.message);
        }
    });

    const handleSave = () => {
        updateSettingsMutation.mutate({
            enabled,
            channel_id: channelId,
            log_messages: logMessages,
            log_members: logMembers,
            log_voice: logVoice,
            log_server: logServer
        });
    };

    if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    const LOG_OPTIONS = [
        { id: 'messages', label: 'Message Events', desc: 'Edits, deletions, and bulk deletes', icon: <MessageSquare size={18} />, state: logMessages, setState: setLogMessages },
        { id: 'members', label: 'Member Events', desc: 'Joins, leaves, and role changes', icon: <Users size={18} />, state: logMembers, setState: setLogMembers },
        { id: 'voice', label: 'Voice Events', desc: 'Channel joins, moves, and leaves', icon: <Mic2 size={18} />, state: logVoice, setState: setLogVoice },
        { id: 'server', label: 'Server Events', desc: 'Channel changes, role updates', icon: <Settings2 size={18} />, state: logServer, setState: setLogServer },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-4xl">list_alt</span>
                        Advanced Logging
                    </h2>
                    <p className="text-on-surface-variant font-medium mt-1">Audit every action that happens in your Discord server.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={updateSettingsMutation.isPending}
                    className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                >
                    {updateSettingsMutation.isPending ? "Saving..." : <><Save size={18} /> Save Settings</>}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {/* Main Toggle & Channel */}
                    <div className="bg-surface-container-low rounded-3xl p-8 border border-outline-variant/10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <ShieldAlert size={120} />
                        </div>

                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary text-2xl">visibility</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Logging Status</h3>
                                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Master Switch</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                                <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>

                        <div className={cn("space-y-6 transition-all duration-300", !enabled && "opacity-40 grayscale pointer-events-none")}>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
                                    <Hash size={12} /> Log Channel
                                </label>
                                <select
                                    value={channelId}
                                    onChange={(e) => setChannelId(e.target.value)}
                                    className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold appearance-none"
                                >
                                    <option value="">Select a channel...</option>
                                    {channels.map((chan: any) => (
                                        <option key={chan.id} value={chan.id}>#{chan.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Event Toggles */}
                    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-300", !enabled && "opacity-40 grayscale pointer-events-none")}>
                        {LOG_OPTIONS.map((opt) => (
                            <div key={opt.id} className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/10 hover:border-primary/20 transition-all group">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                        {opt.icon}
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={opt.state} onChange={(e) => opt.setState(e.target.checked)} />
                                        <div className="w-10 h-5 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                                <h4 className="font-black text-white text-sm uppercase tracking-tight">{opt.label}</h4>
                                <p className="text-[10px] font-medium text-on-surface-variant mt-1">{opt.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-primary/5 rounded-[32px] p-8 border border-primary/10">
                        <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Info size={16} /> Audit Tip
                        </h4>
                        <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
                            Keeping a log of server events is crucial for moderation and security. Radiance provides detailed embeds for each event so you can see exactly what changed.
                        </p>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-[10px] font-bold text-white uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                Deleted Content Recovery
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-bold text-white uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                Channel Move Tracking
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-bold text-white uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                Member Update Logs
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
