import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import {
    Save,
    BrainCircuit,
    Hash,
    MessageCircle,
    HelpCircle,
    Sparkles,
    Info,
    ShieldCheck
} from "lucide-react";
import { cn } from "../lib/utils";

export default function AISupport() {
    const { guildId } = useParams();
    const queryClient = useQueryClient();

    const [enabled, setEnabled] = useState(false);
    const [channelId, setChannelId] = useState("");
    const [knowledgeBase, setKnowledgeBase] = useState("");

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
            setEnabled(guild.ai_enabled || false);
            setChannelId(guild.ai_channel_id || "");
            setKnowledgeBase(guild.ai_knowledge_base || "");
        }
    }, [guild]);

    const updateSettingsMutation = useMutation({
        mutationFn: async (settings: any) => {
            const res = await fetch(`/api/guilds/${guildId}/ai/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (!res.ok) throw new Error("Failed to update settings");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['guild', guildId] });
            toast.success("AI Support settings updated!");
        },
        onError: (err: any) => {
            toast.error(err.message);
        }
    });

    const handleSave = () => {
        updateSettingsMutation.mutate({
            enabled,
            channel_id: channelId,
            knowledge_base: knowledgeBase
        });
    };

    if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-4xl">psychology</span>
                        AI Support Integration
                    </h2>
                    <p className="text-on-surface-variant font-medium mt-1">Automate your community support with advanced Gemini AI.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={updateSettingsMutation.isPending}
                    className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                >
                    {updateSettingsMutation.isPending ? "Saving..." : <><Save size={18} /> Save Config</>}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {/* Main Toggle & Channel */}
                    <div className="bg-surface-container-low rounded-3xl p-8 border border-outline-variant/10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <BrainCircuit size={120} />
                        </div>

                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <Sparkles className="text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">AI Activation</h3>
                                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Toggle Intelligence</p>
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
                                    <Hash size={12} /> AI Support Channel
                                </label>
                                <select
                                    value={channelId}
                                    onChange={(e) => setChannelId(e.target.value)}
                                    className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold appearance-none"
                                >
                                    <option value="">Respond to mentions only (All channels)</option>
                                    {channels.filter((c: any) => !c.parent).map((chan: any) => (
                                        <option key={chan.id} value={chan.id}>#{chan.name}</option>
                                    ))}
                                </select>
                                <p className="text-[9px] font-bold text-on-surface-variant mt-2 uppercase tracking-widest">If a channel is selected, the bot will monitor ALL messages in that channel.</p>
                            </div>
                        </div>
                    </div>

                    {/* Knowledge Base */}
                    <div className={cn("bg-surface-container-low rounded-3xl p-8 border border-outline-variant/10 transition-all duration-300", !enabled && "opacity-40 grayscale pointer-events-none")}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-[#2ed573]/10 flex items-center justify-center text-[#2ed573]">
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <h4 className="font-black text-white text-sm uppercase tracking-tight">AI Knowledge Base</h4>
                                <p className="text-[10px] font-medium text-on-surface-variant">Provide context, rules, and information for the AI to use.</p>
                            </div>
                        </div>

                        <textarea
                            value={knowledgeBase}
                            onChange={(e) => setKnowledgeBase(e.target.value)}
                            placeholder="Example: This server is for Radiance Suite support. Rules: No spamming. Important links: https://docs.example.com. Owners: AdminOne, AdminTwo."
                            className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-6 text-white text-sm focus:ring-2 focus:ring-primary/40 outline-none transition-all h-64 font-medium resize-none shadow-inner"
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-primary/5 rounded-[32px] p-8 border border-primary/10">
                        <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Info size={16} /> AI Tip
                        </h4>
                        <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
                            The AI uses the **Gemini 2.5 Flash** model for fast and accurate responses. You can train it by providing detailed information in the Knowledge Base.
                        </p>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-1"><MessageCircle size={14} className="text-primary" /></div>
                                <div>
                                    <h5 className="text-[10px] font-black text-white uppercase tracking-widest">Automatic Replies</h5>
                                    <p className="text-[9px] text-on-surface-variant">Bots can handle common questions while you're away.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="mt-1"><HelpCircle size={14} className="text-primary" /></div>
                                <div>
                                    <h5 className="text-[10px] font-black text-white uppercase tracking-widest">Context Awareness</h5>
                                    <p className="text-[9px] text-on-surface-variant">AI understands server rules and FAQ if provided.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
