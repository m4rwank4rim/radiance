import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Mic,
    Volume2,
    Settings,
    Save,
    Power,
    Hash
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

export default function DynamicVoice() {
    const { guildId } = useParams();
    const queryClient = useQueryClient();

    const [config, setConfig] = useState({
        enabled: false,
        hub_id: "",
        naming_format: "🔊 {user}'s Channel",
        menu_enabled: true
    });

    // Fetch config
    const { isLoading, isError, data } = useQuery({
        queryKey: ['dynamic-voice', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/dynamic-voice`);
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        }
    });

    useEffect(() => {
        if (data) {
            setConfig({
                enabled: data.dynamic_voice_enabled || false,
                hub_id: data.dynamic_voice_hub_id || "",
                naming_format: data.dynamic_voice_naming || "🔊 {user}'s Channel",
                menu_enabled: data.dynamic_voice_menu !== false
            });
        }
    }, [data]);

    // Fetch Voice Channels
    const { data: channels = [] } = useQuery({
        queryKey: ['channels', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/channels`);
            return res.json();
        }
    });

    const voiceChannels = channels.filter((c: any) => c.type === 2); // GUILD_VOICE

    const saveMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/dynamic-voice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (!res.ok) throw new Error("Failed to save configuration");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dynamic-voice', guildId] });
            toast.success("Dynamic Voice settings updated!");
        },
        onError: () => {
            toast.error("Failed to save settings. Make sure you ran the SQL schema migration first!");
        }
    });

    if (isLoading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    if (isError) return (
        <div className="flex flex-col items-center justify-center h-64 bg-surface-container-low rounded-[2rem] border border-error/20 p-8 text-center">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center text-error mb-4">
                <span className="material-symbols-outlined text-3xl">database_off</span>
            </div>
            <h3 className="text-xl font-black text-white mb-2">Database Error</h3>
            <p className="text-on-surface-variant max-w-md text-sm">
                Failed to load Dynamic Voice settings. This usually means the required database columns are missing.
                <br /><br />
                <span className="text-primary font-bold">Please ensure you have run the provided SQL migration script in your Supabase SQL Editor.</span>
            </p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low p-8 rounded-[2rem] border border-white/5 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

                <div className="relative z-10">
                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                            <Mic size={24} />
                        </div>
                        Dynamic Voice Hubs
                    </h2>
                    <p className="text-on-surface-variant font-medium mt-2 max-w-xl">
                        Designate a "Hub" channel. When users join it, the bot will dynamically generate a temporary, private voice channel uniquely for them.
                    </p>
                </div>

                <div className="relative z-10 flex items-center gap-4">
                    <button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                        className="px-8 py-3.5 bg-primary text-on-primary rounded-xl font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50 text-[10px]"
                    >
                        {saveMutation.isPending ? "Saving..." : <><Save size={16} /> Save Config</>}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Config */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-surface-container-low rounded-[2rem] border border-white/5 p-8 shadow-xl relative overflow-hidden">

                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <Settings className="text-primary" size={20} />
                                <h3 className="text-xl font-black text-white tracking-tight">Hub Configuration</h3>
                            </div>

                            {/* Toggle */}
                            <button
                                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                                className={cn(
                                    "w-12 h-6 rounded-full transition-colors relative flex items-center cursor-pointer border border-white/10 shadow-inner",
                                    config.enabled ? "bg-primary" : "bg-surface-container-highest"
                                )}
                            >
                                <div className={cn(
                                    "w-4 h-4 rounded-full bg-white shadow-md transition-all absolute",
                                    config.enabled ? "left-[26px]" : "left-1"
                                )} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                                    <Volume2 size={12} /> Designate Hub Channel
                                </label>
                                <p className="text-xs text-on-surface-variant mb-3 font-medium">Select the voice channel users must join to trigger the creation of a temporary channel.</p>
                                <select
                                    value={config.hub_id}
                                    onChange={(e) => setConfig({ ...config, hub_id: e.target.value })}
                                    className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold appearance-none cursor-pointer h-12"
                                    disabled={!config.enabled}
                                >
                                    <option value="">Select a Voice Channel...</option>
                                    {voiceChannels.map((chan: any) => (
                                        <option key={chan.id} value={chan.id}>🔊 {chan.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="h-[1px] w-full bg-outline-variant/10" />

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                                    <Hash size={12} /> Temp Channel Naming Scheme
                                </label>
                                <p className="text-xs text-on-surface-variant mb-3 font-medium">Use <code className="bg-black/30 px-1 py-0.5 rounded text-white">{'{user}'}</code> to inject the member's current display name into the generated channel.</p>
                                <input
                                    type="text"
                                    value={config.naming_format}
                                    onChange={(e) => setConfig({ ...config, naming_format: e.target.value })}
                                    placeholder="🔊 {user}'s Lounge"
                                    className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium h-12"
                                    disabled={!config.enabled}
                                />
                            </div>

                            <div className="h-[1px] w-full bg-outline-variant/10" />

                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                        <Mic size={12} /> Interactive Voice Menu
                                    </label>
                                    <p className="text-xs text-on-surface-variant font-medium">Spawn a control panel message in the new channel with Lock, Rename, and Kick buttons.</p>
                                </div>
                                <button
                                    onClick={() => setConfig({ ...config, menu_enabled: !config.menu_enabled })}
                                    className={cn(
                                        "w-12 h-6 rounded-full transition-colors relative flex items-center cursor-pointer border border-white/10 shadow-inner",
                                        config.menu_enabled ? "bg-primary" : "bg-surface-container-highest"
                                    )}
                                >
                                    <div className={cn(
                                        "w-4 h-4 rounded-full bg-white shadow-md transition-all absolute",
                                        config.menu_enabled ? "left-[26px]" : "left-1"
                                    )} />
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Info Panel */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-primary/10 rounded-[2rem] border border-primary/20 p-8 shadow-xl">
                        <div className="flex items-center gap-3 mb-4 text-primary">
                            <Power size={20} />
                            <h3 className="text-lg font-black uppercase tracking-wider">How it works</h3>
                        </div>
                        <ul className="space-y-4 text-sm text-primary/80 font-medium">
                            <li className="flex gap-3">
                                <span className="font-bold text-primary">1.</span>
                                <span>User joins the designated Hub Channel.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="font-bold text-primary">2.</span>
                                <span>Bot creates a new voice channel right below it applying your naming scheme.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="font-bold text-primary">3.</span>
                                <span>User is seamlessly dragged into the new channel.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="font-bold text-primary">4.</span>
                                <span>When everyone leaves, the bot automatically deletes it to keep your server clean.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
