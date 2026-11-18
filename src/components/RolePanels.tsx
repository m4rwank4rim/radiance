import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import {
    Plus,
    Trash2,
    Send,
    Layout,
    MousePointer2,
    Hash,
    CheckCircle2,
    AlignLeft,
    Palette,
    ArrowLeft,
    LayoutTemplate
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

interface RoleButton {
    label: string;
    emoji: string;
    role_id: string;
    style: string;
}

export default function RolePanels({ hideHeader = false }: { hideHeader?: boolean }) {
    const { guildId } = useParams();
    const queryClient = useQueryClient();

    const [isCreating, setIsCreating] = useState(false);
    const [newPanel, setNewPanel] = useState({
        title: "",
        description: "",
        color: "#d0bcff",
        channel_id: "",
        author_name: "",
        author_icon: "",
        image_url: ""
    });
    const [newButtons, setNewButtons] = useState<RoleButton[]>([]);

    // Fetch Panels
    const { data: panels = [], isLoading } = useQuery({
        queryKey: ['role-panels', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/role-panels`);
            return res.json();
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

    // Fetch Roles
    const { data: roles = [] } = useQuery({
        queryKey: ['roles', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/roles`);
            return res.json();
        }
    });

    const createPanelMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch(`/api/guilds/${guildId}/role-panels`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Failed to create panel");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['role-panels', guildId] });
            setIsCreating(false);
            setNewPanel({ title: "", description: "", color: "#d0bcff", channel_id: "" });
            setNewButtons([]);
            toast.success("Role panel created!");
        }
    });

    const deletePanelMutation = useMutation({
        mutationFn: async (panelId: string) => {
            const res = await fetch(`/api/guilds/${guildId}/role-panels/${panelId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error("Failed to delete panel");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['role-panels', guildId] });
            toast.success("Panel deleted");
        }
    });

    const deployPanelMutation = useMutation({
        mutationFn: async (panelId: string) => {
            const res = await fetch(`/api/guilds/${guildId}/role-panels/${panelId}/deploy`, {
                method: 'POST'
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to deploy panel");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['role-panels', guildId] });
            toast.success("Panel deployed to Discord!");
        },
        onError: (err: any) => {
            toast.error(err.message);
        }
    });

    const handleAddButton = () => {
        if (newButtons.length >= 25) return toast.error("Maximum 25 buttons allowed");
        setNewButtons([...newButtons, { label: "New Role", emoji: "", role_id: "", style: "Primary" }]);
    };

    const handleRemoveButton = (index: number) => {
        setNewButtons(newButtons.filter((_, i) => i !== index));
    };

    const handleUpdateButton = (index: number, updates: Partial<RoleButton>) => {
        const updated = [...newButtons];
        updated[index] = { ...updated[index], ...updates };
        setNewButtons(updated);
    };

    const getPreviewButtonStyle = (style: string) => {
        switch (style) {
            case "Primary": return "bg-[#5865F2] hover:bg-[#4752C4] text-white";
            case "Secondary": return "bg-[#4E5058] hover:bg-[#686D73] text-white";
            case "Success": return "bg-[#248046] hover:bg-[#1a6334] text-white";
            case "Danger": return "bg-[#DA373C] hover:bg-[#a1282c] text-white";
            default: return "bg-[#5865F2] hover:bg-[#4752C4] text-white";
        }
    };

    if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            {!hideHeader ? (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-4xl">smart_button</span>
                            Role Panels
                        </h2>
                        <p className="text-on-surface-variant font-medium mt-1">Create interactive button-based role assignment panels.</p>
                    </div>
                    {!isCreating && (
                        <button
                            onClick={() => setIsCreating(true)}
                            className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 cursor-pointer"
                        >
                            <Plus size={18} /> Create New Panel
                        </button>
                    )}
                </div>
            ) : (
                !isCreating && (
                    <div className="flex justify-end">
                        <button
                            onClick={() => setIsCreating(true)}
                            className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 cursor-pointer"
                        >
                            <Plus size={18} /> Create New Panel
                        </button>
                    </div>
                )
            )}

            {isCreating ? (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4 duration-500">
                    {/* Left Column: Editor */}
                    <div className="xl:col-span-7 flex flex-col gap-6">

                        {/* Upper Control Bar */}
                        <div className="bg-surface-container-low rounded-2xl border border-white/5 p-3 flex justify-between items-center shadow-xl relative z-20">
                            <button
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 hover:bg-white/5 rounded-xl text-white font-bold tracking-tight flex items-center gap-2 transition-all cursor-pointer text-sm"
                            >
                                <ArrowLeft size={16} /> Back to Panels
                            </button>
                            <button
                                onClick={() => createPanelMutation.mutate({ ...newPanel, buttons: newButtons })}
                                disabled={!newPanel.title || !newPanel.channel_id || newButtons.length === 0 || createPanelMutation.isPending}
                                className="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 text-sm shadow-lg shadow-primary/20 cursor-pointer"
                            >
                                <Send size={16} /> {createPanelMutation.isPending ? "Deploying..." : "Create Panel"}
                            </button>
                        </div>

                        {/* Editor Form */}
                        <div className="bg-surface-container-low rounded-[2rem] border border-white/5 p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

                            {/* Identity Section */}
                            <div className="space-y-4 relative z-10">
                                <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <LayoutTemplate size={12} /> Panel Identity
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        placeholder="Embed Title"
                                        value={newPanel.title}
                                        onChange={(e) => setNewPanel({ ...newPanel, title: e.target.value })}
                                        className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                                    />
                                    <select
                                        value={newPanel.channel_id}
                                        onChange={(e) => setNewPanel({ ...newPanel, channel_id: e.target.value })}
                                        className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold appearance-none cursor-pointer"
                                    >
                                        <option value="">Select Target Channel...</option>
                                        {channels.map((chan: any) => (
                                            <option key={chan.id} value={chan.id}>#{chan.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="h-[1px] w-full bg-outline-variant/10 my-2" />

                            <div className="space-y-4 relative z-10">
                                <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <AlignLeft size={12} /> Description Content
                                </label>
                                <textarea
                                    placeholder="Type your panel description here..."
                                    value={newPanel.description}
                                    onChange={(e) => setNewPanel({ ...newPanel, description: e.target.value })}
                                    className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium h-32 resize-none"
                                />
                                <div className="grid grid-cols-1 gap-4 mt-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input
                                            type="text"
                                            placeholder="Author Name"
                                            value={newPanel.author_name}
                                            onChange={(e) => setNewPanel({ ...newPanel, author_name: e.target.value })}
                                            className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Author Icon URL"
                                            value={newPanel.author_icon}
                                            onChange={(e) => setNewPanel({ ...newPanel, author_icon: e.target.value })}
                                            className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Main Image URL"
                                        value={newPanel.image_url}
                                        onChange={(e) => setNewPanel({ ...newPanel, image_url: e.target.value })}
                                        className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="h-[1px] w-full bg-outline-variant/10 my-2" />

                            <div className="space-y-4 relative z-10">
                                <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Palette size={12} /> Embed Color
                                </label>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-3 w-1/3">
                                        <div className="h-12 w-12 rounded-xl border-2 border-outline-variant/20 overflow-hidden shrink-0 cursor-pointer shadow-lg relative group">
                                            <input
                                                type="color"
                                                value={newPanel.color}
                                                onChange={(e) => setNewPanel({ ...newPanel, color: e.target.value })}
                                                className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer p-0 m-0 opacity-0 z-10"
                                            />
                                            <div className="w-full h-full" style={{ backgroundColor: newPanel.color }} />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <input
                                                type="text"
                                                value={newPanel.color.toUpperCase()}
                                                onChange={(e) => setNewPanel({ ...newPanel, color: e.target.value })}
                                                className="w-full bg-transparent text-white font-black tracking-widest text-sm focus:outline-none uppercase"
                                                placeholder="#FFFFFF"
                                                maxLength={7}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="h-[1px] w-full bg-outline-variant/10 my-2" />

                            {/* Dynamic Buttons Builder */}
                            <div className="space-y-4 relative z-10">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                        <MousePointer2 size={12} /> Interactive Roles ({newButtons.length}/25)
                                    </label>
                                    <button onClick={handleAddButton} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-primary/20 transition-all cursor-pointer">
                                        <Plus size={14} /> Add Button
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {newButtons.length === 0 && (
                                        <div className="py-12 text-center bg-black/20 rounded-2xl border border-dashed border-outline-variant/10">
                                            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">No buttons added</p>
                                        </div>
                                    )}
                                    {newButtons.map((btn, index) => (
                                        <div key={index} className="p-4 bg-black/20 rounded-2xl border border-white/5 space-y-4 relative group">
                                            <button
                                                onClick={() => handleRemoveButton(index)}
                                                className="absolute top-2 right-2 p-1.5 text-error/50 hover:bg-error/10 hover:text-error rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <div className="grid grid-cols-5 gap-3 pr-8">
                                                <input
                                                    type="text"
                                                    value={btn.emoji}
                                                    onChange={(e) => handleUpdateButton(index, { emoji: e.target.value })}
                                                    placeholder="😁"
                                                    className="col-span-1 bg-surface-container border border-outline-variant/10 rounded-lg p-2 text-center text-xs focus:ring-1 focus:ring-primary outline-none"
                                                />
                                                <input
                                                    type="text"
                                                    value={btn.label}
                                                    onChange={(e) => handleUpdateButton(index, { label: e.target.value })}
                                                    placeholder="Button Label"
                                                    className="col-span-4 bg-surface-container border border-outline-variant/10 rounded-lg p-2 text-sm text-white font-bold focus:ring-1 focus:ring-primary outline-none"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <select
                                                    value={btn.role_id}
                                                    onChange={(e) => handleUpdateButton(index, { role_id: e.target.value })}
                                                    className="bg-surface-container border border-outline-variant/10 rounded-lg p-2 text-xs font-bold text-white focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                                                >
                                                    <option value="">Select Discord Role...</option>
                                                    {roles.map((r: any) => (
                                                        <option key={r.id} value={r.id}>{r.name}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    value={btn.style}
                                                    onChange={(e) => handleUpdateButton(index, { style: e.target.value })}
                                                    className="bg-surface-container border border-outline-variant/10 rounded-lg p-2 text-xs font-bold text-white focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                                                >
                                                    <option value="Primary">Blurple / Primary</option>
                                                    <option value="Secondary">Gray / Secondary</option>
                                                    <option value="Success">Green / Success</option>
                                                    <option value="Danger">Red / Danger</option>
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Live Data Preview */}
                    <div className="xl:col-span-5 relative">
                        <div className="sticky top-24 space-y-6">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-[#5865F2]/10 flex items-center justify-center text-[#5865F2]">
                                    <LayoutTemplate size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Live Preview</h3>
                                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Real-time Discord format</p>
                                </div>
                            </div>

                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="relative"
                            >
                                <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 blur-3xl opacity-50 ring-1 ring-inset ring-white/5 pointer-events-none rounded-[3rem]" />

                                <div className="bg-[#1b1b1e]/60 backdrop-blur-3xl rounded-[2rem] p-6 max-w-full overflow-hidden antialiased border border-white/[0.05] shadow-[0_32px_64px_rgba(0,0,0,0.5)] ring-1 ring-white/5 relative z-10 hover:border-white/10 transition-colors">
                                    <div className="flex items-start gap-4 mb-2">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1e1f22] to-black overflow-hidden shrink-0 mt-0.5 border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)] p-0.5">
                                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Bot" alt="Bot" className="w-full h-full object-cover rounded-[14px]" />
                                        </div>
                                        <div className="flex-1 min-w-0 pt-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-white font-black text-[16px] tracking-tight hover:text-primary transition-colors cursor-pointer drop-shadow-md">Radiance Bot</span>
                                                <span className="bg-primary text-white text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 leading-none uppercase font-black tracking-widest shadow-[0_0_15px_rgba(var(--color-primary),0.5)]">
                                                    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                                                        <path d="M7.4 1H8.6L10.1 2.5V3.8L11.4 5.3H12.7L14.2 6.8V8L12.7 9.5H11.4L10.1 11V12.2L8.6 13.7H7.4L5.9 12.2V11L4.6 9.5H3.3L1.8 8V6.8L3.3 5.3H4.6L5.9 3.8V2.5L7.4 1ZM7.7 2.1L6.5 3.3V4.3L5.5 5.3H4.5L3.3 6.5V7.5L4.5 8.7H5.5L6.5 9.7V10.7L7.7 11.9H8.3L9.5 10.7V9.7L10.5 8.7H11.5L12.7 7.5V6.5L11.5 5.3H10.5L9.5 4.3V3.3L8.3 2.1H7.7ZM10.3 5.3L11 6 7 10 5 8 5.7 7.3 7 8.6 10.3 5.3Z" />
                                                    </svg>
                                                    SYSTEM
                                                </span>
                                                <span className="text-[#949ba4] text-[10px] font-bold uppercase tracking-wider ml-1 opacity-70">Just now</span>
                                            </div>

                                            <motion.div layout>
                                                {(newPanel.author_name || newPanel.title || newPanel.description || newPanel.image_url) ? (
                                                    <div className="relative group">
                                                        <div
                                                            className="absolute -inset-0.5 bg-gradient-to-r blur-xl opacity-20 group-hover:opacity-40 transition duration-500 rounded-2xl"
                                                            style={{ backgroundImage: `linear-gradient(to right, ${newPanel.color || '#202225'}, transparent)` }}
                                                        />

                                                        <div className="relative bg-[#252528]/80 backdrop-blur-xl rounded-2xl max-w-[432px] overflow-hidden flex border-l-4 shadow-xl ring-1 ring-white/5" style={{ borderColor: newPanel.color || '#202225' }}>
                                                            <div className="p-5 flex flex-col gap-3 w-full">

                                                                {newPanel.author_name && (
                                                                    <div className="flex items-center gap-3 mb-1">
                                                                        {newPanel.author_icon && <img src={newPanel.author_icon} alt="Author" className="w-7 h-7 rounded-full object-cover ring-2 ring-[#353438]" onError={(e) => e.currentTarget.style.display = 'none'} />}
                                                                        <span className="text-white font-extrabold tracking-tight text-[15px] drop-shadow-sm">{newPanel.author_name}</span>
                                                                    </div>
                                                                )}

                                                                <div className="flex gap-5">
                                                                    <div className="flex-1 flex flex-col gap-2">
                                                                        {newPanel.title && (
                                                                            <div className="font-black text-[17px] tracking-tight break-words text-white">
                                                                                {newPanel.title}
                                                                            </div>
                                                                        )}
                                                                        {newPanel.description && (
                                                                            <div className="text-[#dbdee1] text-[14px] font-medium whitespace-pre-wrap leading-relaxed">
                                                                                {newPanel.description}
                                                                            </div>
                                                                        )}
                                                                        {newPanel.image_url && (
                                                                            <div className="mt-3 rounded-xl overflow-hidden border border-white/10 ring-1 ring-black/50 shadow-md max-w-full">
                                                                                <img src={newPanel.image_url} alt="Embed Media" className="w-full object-cover max-h-[300px]" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : null}

                                                {/* Simulated Buttons inside Discord Layout */}
                                                {newButtons.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-2 max-w-[432px]">
                                                        {newButtons.map((btn, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={cn(
                                                                    "px-3 py-1.5 rounded-[4px] text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none",
                                                                    getPreviewButtonStyle(btn.style)
                                                                )}
                                                            >
                                                                {btn.emoji && <span>{btn.emoji}</span>}
                                                                <span className="font-semibold">{btn.label || "Untilted"}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </motion.div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Panels List Grid */
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {panels.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-surface-container-low rounded-3xl border border-dashed border-outline-variant/20">
                            <div className="w-16 h-16 rounded-2xl bg-surface-container-high mx-auto flex items-center justify-center mb-4">
                                <Layout className="text-on-surface-variant opacity-20" size={32} />
                            </div>
                            <p className="text-on-surface-variant font-bold uppercase tracking-widest text-xs">No panels created yet</p>
                        </div>
                    ) : (
                        panels.map((panel: any) => (
                            <div key={panel.id} className="bg-surface-container-low rounded-3xl border border-outline-variant/10 p-6 flex flex-col gap-6 group hover:border-primary/30 transition-all shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-10 pointer-events-none" style={{ backgroundColor: panel.color }} />

                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 shadow-inner" style={{ backgroundColor: panel.color + "20" }}>
                                            <Layout style={{ color: panel.color }} size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-white tracking-tight text-lg">{panel.title}</h4>
                                            <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2 mt-0.5">
                                                <Hash size={10} /> {channels.find((c: any) => c.id === panel.channel_id)?.name || "Unknown Channel"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => deployPanelMutation.mutate(panel.id)}
                                            disabled={deployPanelMutation.isPending}
                                            className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-on-primary transition-all flex items-center gap-2 px-3 font-bold text-[10px] uppercase tracking-widest cursor-pointer"
                                        >
                                            <Send size={14} /> {panel.message_id ? "Re-Deploy" : "Deploy"}
                                        </button>
                                        <button
                                            onClick={() => deletePanelMutation.mutate(panel.id)}
                                            className="p-2 bg-error/10 text-error rounded-lg hover:bg-error hover:text-on-error transition-all cursor-pointer"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 relative z-10">
                                    {panel.role_panel_buttons?.map((btn: any) => (
                                        <div key={btn.id} className="px-3 py-1.5 rounded-[4px] bg-[#2b2d31] border border-black/20 flex items-center gap-2 text-[11px] font-semibold text-[#dbdee1] shadow-sm">
                                            {btn.emoji && <span>{btn.emoji}</span>}
                                            {btn.label}
                                        </div>
                                    ))}
                                </div>

                                {panel.message_id && (
                                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between relative z-10">
                                        <span className="text-[9px] font-bold text-success uppercase tracking-widest flex items-center gap-1">
                                            <CheckCircle2 size={12} /> Active on Discord
                                        </span>
                                        <code className="text-[9px] text-on-surface-variant font-mono bg-black/20 px-2 py-1 rounded-md">{panel.message_id}</code>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
