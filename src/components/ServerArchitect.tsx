import { useState } from "react";
import { useParams } from "react-router-dom";
import {
    LayoutGrid,
    Sparkles,
    Layout,
    Hash,
    Volume2,
    ShieldAlert,
    CheckCircle2,
    Loader2,
    Wand2,
    Save,
    Trash2
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

interface AIStructure {
    categories: {
        name: string;
        channels: { name: string; type: 'text' | 'voice' }[];
    }[];
    roles: {
        name: string;
        color: string;
        permissions: string[];
    }[];
}

export default function ServerArchitect() {
    const { guildId } = useParams();
    const [prompt, setPrompt] = useState("");
    const [preview, setPreview] = useState<AIStructure | null>(null);
    const [mode, setMode] = useState<'purge' | 'sync'>('sync');

    const generateMutation = useMutation({
        mutationFn: async (userPrompt: string) => {
            const res = await fetch(`/api/guilds/${guildId}/ai/architect/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: userPrompt })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to generate structure");
            }

            return res.json();
        },
        onSuccess: (data) => {
            setPreview(data);
            toast.success("AI generated a potential structure for your server!");
        },
        onError: (err: any) => {
            console.error("Architect Generation Error:", err);
            toast.error(err.message || "AI failed to generate a structure. Try being more specific.");
        }
    });

    const executeMutation = useMutation({
        mutationFn: async (template: AIStructure) => {
            const res = await fetch(`/api/guilds/${guildId}/ai/architect/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template, mode })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to build server");
            return data;
        },
        onSuccess: () => {
            toast.success("Server structure built successfully! Check your Discord.");
            setPreview(null);
            setPrompt("");
        },
        onError: (err: any) => {
            console.error("Architect Execution Error:", err);
            toast.error(err.message || "Failed to build assets.");
        }
    });

    const updateCategoryName = (index: number, name: string) => {
        if (!preview) return;
        const newCategories = [...preview.categories];
        newCategories[index].name = name;
        setPreview({ ...preview, categories: newCategories });
    };

    const deleteCategory = (index: number) => {
        if (!preview) return;
        const newCategories = preview.categories.filter((_, i) => i !== index);
        setPreview({ ...preview, categories: newCategories });
    };

    const deleteChannel = (catIndex: number, chanIndex: number) => {
        if (!preview) return;
        const newCategories = [...preview.categories];
        newCategories[catIndex].channels = newCategories[catIndex].channels.filter((_, i) => i !== chanIndex);
        setPreview({ ...preview, categories: newCategories });
    };

    const deleteRole = (index: number) => {
        if (!preview) return;
        const newRoles = preview.roles.filter((_, i) => i !== index);
        setPreview({ ...preview, roles: newRoles });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="relative p-10 rounded-[40px] bg-surface-container-low border border-white/5 overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-[120px] rounded-full -mr-48 -mt-48" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                                <LayoutGrid className="text-primary" size={24} />
                            </div>
                            <span className="px-4 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em]">Phase 16: AI Architect</span>
                        </div>
                        <h2 className="text-4xl font-black text-white tracking-tight mb-2">Build Your Dream Server</h2>
                        <p className="text-on-surface-variant max-w-xl text-sm font-medium leading-relaxed">
                            Describe your community in plain English. Radiance will use
                            <span className="text-primary font-bold"> Advanced AI Models</span> to design and build
                            every channel, category, and role for you.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="bg-black/20 p-1.5 rounded-2xl border border-white/5 flex gap-2">
                            <button
                                onClick={() => setMode('sync')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${mode === 'sync' ? 'bg-primary text-on-primary shadow-lg' : 'text-on-surface-variant hover:text-white'}`}
                            >
                                Safe Sync
                            </button>
                            <button
                                onClick={() => setMode('purge')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${mode === 'purge' ? 'bg-error text-on-error shadow-lg' : 'text-on-surface-variant hover:text-white'}`}
                            >
                                Fresh Start
                            </button>
                        </div>
                        <p className="text-[9px] text-center font-bold text-on-surface-variant/60 uppercase tracking-widest">
                            {mode === 'sync' ? 'Keeps existing channels' : 'Purges entire server'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Section */}
                <div className="space-y-6">
                    <div className="bg-surface-container-low p-8 rounded-[32px] border border-white/5 shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <Sparkles className="text-primary" size={20} />
                            <h3 className="text-lg font-black text-white uppercase tracking-wider">Describe Your Concept</h3>
                        </div>

                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., A professional esports server for VALORANT with separate sections for team practice, public matches, staff, and a VIP lounge with custom roles for Iron to Radiant."
                            className="w-full h-48 bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-6 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none mb-6"
                        />

                        <button
                            onClick={() => generateMutation.mutate(prompt)}
                            disabled={!prompt || generateMutation.isPending}
                            className="w-full py-4 bg-primary text-on-primary rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                            {generateMutation.isPending ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    AI Architect is Thinking...
                                </>
                            ) : (
                                <>
                                    <Wand2 size={18} /> Generate Server Template
                                </>
                            )}
                        </button>
                    </div>

                    <div className="p-6 rounded-3xl bg-secondary/10 border border-secondary/20">
                        <div className="flex items-start gap-4">
                            <ShieldAlert className="text-secondary shrink-0" size={20} />
                            <div>
                                <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">Safety First</h4>
                                <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
                                    The AI Architect will <span className="text-white font-bold">{mode === 'purge' ? 'DELETE ALL' : 'ONLY CREATE'}</span> assets.
                                    {mode === 'sync' && ' It will never delete your existing channels or roles.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview Section */}
                <div className="bg-surface-container-low p-8 rounded-[32px] border border-white/5 shadow-xl min-h-[500px] flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <Layout className="text-primary" size={20} />
                            <h3 className="text-lg font-black text-white uppercase tracking-wider">Interactive Preview</h3>
                        </div>
                        {preview && (
                            <button
                                onClick={() => setPreview(null)}
                                className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest hover:text-white transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {!preview ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-30 select-none">
                            <LayoutGrid size={80} className="mb-4" />
                            <p className="text-sm font-bold uppercase tracking-[0.3em]">No Template Generated</p>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col">
                            <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
                                {/* Roles */}
                                <div>
                                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Proposed Roles (Click to Remove)</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {preview.roles.map((role, i) => (
                                            <div
                                                key={i}
                                                onClick={() => deleteRole(i)}
                                                className="group px-3 py-1.5 rounded-lg bg-surface-container-highest border border-white/5 flex items-center gap-2 cursor-pointer hover:border-error/40 transition-all"
                                            >
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color }} />
                                                <span className="text-xs font-bold text-white group-hover:text-error transition-colors">{role.name}</span>
                                                <Trash2 size={10} className="text-error opacity-0 group-hover:opacity-100 transition-all" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Infrastructure */}
                                <div>
                                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Proposed Infrastructure</h4>
                                    <div className="space-y-4">
                                        {preview.categories.map((cat, i) => (
                                            <div key={i} className="p-4 rounded-2xl bg-surface-container-highest/40 border border-white/5 relative group/cat">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <Layout size={14} className="text-on-surface-variant" />
                                                        <input
                                                            value={cat.name}
                                                            onChange={(e) => updateCategoryName(i, e.target.value)}
                                                            className="bg-transparent border-none text-[10px] font-black text-white uppercase tracking-widest focus:outline-none focus:text-primary transition-colors w-full"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => deleteCategory(i)}
                                                        className="opacity-0 group-hover/cat:opacity-100 p-1 hover:text-error transition-all"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {cat.channels.map((chan, j) => (
                                                        <div key={j} className="group/chan flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-black/20 hover:bg-black/40 transition-all">
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                {chan.type === 'text' ? <Hash size={12} /> : <Volume2 size={12} />}
                                                                <span className="text-[10px] font-medium text-on-surface-variant truncate">{chan.name}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => deleteChannel(i, j)}
                                                                className="opacity-0 group-hover/chan:opacity-100 text-on-surface-variant hover:text-error transition-all"
                                                            >
                                                                <Trash2 size={10} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => executeMutation.mutate(preview)}
                                disabled={executeMutation.isPending}
                                className={`mt-8 w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg ${mode === 'purge' ? 'bg-error text-on-error shadow-error/20' : 'bg-secondary text-on-secondary shadow-secondary/20'}`}
                            >
                                {executeMutation.isPending ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        Building in Discord...
                                    </>
                                ) : (
                                    <>
                                        {mode === 'purge' ? <Trash2 size={18} /> : <CheckCircle2 size={18} />}
                                        {mode === 'purge' ? 'Wipe & Deploy Fresh' : 'Deploy Sync Update'}
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
