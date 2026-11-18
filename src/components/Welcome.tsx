import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
    Save,
    TrendingUp,
    MessageSquare,
    Hash,
    Info,
    Image as ImageIcon,
    Type,
    Palette,
    Eye,
    Settings2,
    Sparkles
} from "lucide-react";
import { cn } from "../lib/utils";

export default function Welcome() {
    const { guildId } = useParams();
    const queryClient = useQueryClient();

    // Welcome Settings
    const [welcomeEnabled, setWelcomeEnabled] = useState(false);
    const [welcomeMessage, setWelcomeMessage] = useState("");
    const [welcomeChannel, setWelcomeChannel] = useState("");
    const [welcomeBg, setWelcomeBg] = useState("");
    const [welcomeTextColor, setWelcomeTextColor] = useState("#ffffff");
    const [welcomeAccentColor, setWelcomeAccentColor] = useState("#d0bcff");
    const [welcomeLayout, setWelcomeLayout] = useState("centered");
    const [welcomeBlur, setWelcomeBlur] = useState(2);
    const [welcomeOpacity, setWelcomeOpacity] = useState(40);
    const [welcomeRadius, setWelcomeRadius] = useState(24);
    const [welcomeGlass, setWelcomeGlass] = useState(true);

    // Farewell Settings
    const [farewellEnabled, setFarewellEnabled] = useState(false);
    const [farewellMessage, setFarewellMessage] = useState("");
    const [farewellChannel, setFarewellChannel] = useState("");
    const [farewellBg, setFarewellBg] = useState("");
    const [farewellTextColor, setFarewellTextColor] = useState("#ffffff");
    const [farewellAccentColor, setFarewellAccentColor] = useState("#ffb2b7");
    const [farewellLayout, setFarewellLayout] = useState("centered");
    const [farewellBlur, setFarewellBlur] = useState(2);
    const [farewellOpacity, setFarewellOpacity] = useState(40);
    const [farewellRadius, setFarewellRadius] = useState(24);
    const [farewellGlass, setFarewellGlass] = useState(true);

    const [activeTab, setActiveTab] = useState<"welcome" | "farewell">("welcome");

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
            const canvas = guild.active_modules?.canvas || {};
            setWelcomeEnabled(guild.welcome_enabled || false);
            setWelcomeMessage(guild.welcome_message || "Welcome {user} to {server}!");
            setWelcomeChannel(guild.welcome_channel || "");
            setWelcomeBg(canvas.welcome_background_url || "");
            setWelcomeTextColor(canvas.welcome_text_color || "#ffffff");
            setWelcomeAccentColor(canvas.welcome_accent_color || "#d0bcff");
            setWelcomeLayout(canvas.welcome_layout || "centered");
            setWelcomeBlur(canvas.welcome_blur ?? 2);
            setWelcomeOpacity(canvas.welcome_opacity ?? 40);
            setWelcomeRadius(canvas.welcome_radius ?? 24);
            setWelcomeGlass(canvas.welcome_glass ?? true);

            setFarewellEnabled(guild.farewell_enabled || false);
            setFarewellMessage(guild.farewell_message || "{user} has left the server.");
            setFarewellChannel(guild.farewell_channel || "");
            setFarewellBg(canvas.farewell_background_url || "");
            setFarewellTextColor(canvas.farewell_text_color || "#ffffff");
            setFarewellAccentColor(canvas.farewell_accent_color || "#ffb2b7");
            setFarewellLayout(canvas.farewell_layout || "centered");
            setFarewellBlur(canvas.farewell_blur ?? 2);
            setFarewellOpacity(canvas.farewell_opacity ?? 40);
            setFarewellRadius(canvas.farewell_radius ?? 24);
            setFarewellGlass(canvas.farewell_glass ?? true);
        }
    }, [guild]);

    const updateSettingsMutation = useMutation({
        mutationFn: async (settings: any) => {
            const res = await fetch(`/api/guilds/${guildId}/welcome/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (!res.ok) throw new Error("Failed to update settings");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['guild', guildId] });
            toast.success("Branded Canvas settings saved!");
        },
        onError: (err: any) => {
            toast.error(err.message);
        }
    });

    const handleSave = () => {
        updateSettingsMutation.mutate({
            welcome_enabled: welcomeEnabled,
            welcome_message: welcomeMessage,
            welcome_channel: welcomeChannel,
            farewell_enabled: farewellEnabled,
            farewell_message: farewellMessage,
            farewell_channel: farewellChannel,
            canvas: {
                welcome_background_url: welcomeBg,
                welcome_text_color: welcomeTextColor,
                welcome_accent_color: welcomeAccentColor,
                welcome_layout: welcomeLayout,
                welcome_blur: welcomeBlur,
                welcome_opacity: welcomeOpacity,
                welcome_radius: welcomeRadius,
                welcome_glass: welcomeGlass,
                farewell_background_url: farewellBg,
                farewell_text_color: farewellTextColor,
                farewell_accent_color: farewellAccentColor,
                farewell_layout: farewellLayout,
                farewell_blur: farewellBlur,
                farewell_opacity: farewellOpacity,
                farewell_radius: farewellRadius,
                farewell_glass: farewellGlass
            }
        });
    };

    if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

    const CanvasPreview = ({ type, bg, text, accent, message, enabled, layout, blur, opacity, radius, glass }: any) => (
        <div className={cn(
            "relative w-full aspect-[2/1] overflow-hidden border border-white/10 shadow-2xl transition-all duration-500",
            !enabled && "grayscale contrast-75 opacity-50"
        )} style={{ borderRadius: `${radius}px` }}>
            {/* Background */}
            {bg ? (
                <img src={bg} alt="Canvas Background" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-surface-container-high to-surface" />
            )}

            {/* Overlay */}
            <div
                className="absolute inset-0 transition-all duration-300"
                style={{
                    backgroundColor: `rgba(0,0,0,${opacity / 100})`,
                    backdropBlur: glass ? `${blur}px` : '0px',
                    WebkitBackdropFilter: glass ? `blur(${blur}px)` : 'none'
                }}
            />

            {/* Content Mockup */}
            <div className={cn(
                "relative h-full flex p-5 transition-all duration-500",
                layout === 'centered' ? "flex-col items-center justify-center text-center gap-2" :
                    layout === 'left' ? "flex-row items-center justify-start text-left gap-6" :
                        "flex-col items-start justify-center text-left gap-2" // Compact
            )}>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={cn(
                        "rounded-full border-4 overflow-hidden shadow-xl shrink-0 transition-all duration-500",
                        layout === 'compact' ? "w-12 h-12" : "w-16 h-16"
                    )}
                    style={{ borderColor: accent }}
                >
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" className="w-full h-full bg-surface-container-highest" />
                </motion.div>

                <div className={cn(
                    "flex flex-col gap-0.5 max-w-[85%]",
                    layout === 'centered' ? "items-center" : "items-start"
                )}>
                    <h3 className={cn(
                        "font-black tracking-tighter uppercase leading-none",
                        layout === 'compact' ? "text-lg" : "text-xl"
                    )} style={{ color: text }}>
                        {type === 'welcome' ? "WELCOME" : "GOODBYE"}
                    </h3>

                    <p className={cn(
                        "font-bold line-clamp-2 leading-tight",
                        layout === 'compact' ? "text-xs" : "text-base"
                    )} style={{ color: accent }}>
                        {message.replace('{user}', 'User#0001').replace('{server}', 'Radiance Pro').replace('{count}', '1,234')}
                    </p>
                </div>

                <div className="absolute top-4 right-4 flex items-center gap-1.5 opacity-30">
                    <Sparkles size={10} className="text-white" />
                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Canvas V2</span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20">Canvas System</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    </div>
                    <h2 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4">
                        Visual Engagement
                    </h2>
                    <p className="text-on-surface-variant font-medium mt-1">Design high-impact visual greetings for your community members.</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={handleSave}
                        disabled={updateSettingsMutation.isPending}
                        className="px-8 py-3 bg-primary text-on-primary rounded-xl font-black flex items-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
                    >
                        {updateSettingsMutation.isPending ? (
                            <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                        ) : <><Save size={20} /> Deploy Changes</>}
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 p-1.5 bg-surface-container-low border border-white/5 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveTab("welcome")}
                    className={cn(
                        "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                        activeTab === "welcome" ? "bg-primary text-on-primary shadow-lg shadow-primary/10" : "text-on-surface-variant hover:text-white"
                    )}
                >
                    <span className="material-symbols-outlined text-lg">login</span>
                    Welcome
                </button>
                <button
                    onClick={() => setActiveTab("farewell")}
                    className={cn(
                        "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                        activeTab === "farewell" ? "bg-accent text-on-accent shadow-lg shadow-accent/10" : "text-on-surface-variant hover:text-white"
                    )}
                >
                    <span className="material-symbols-outlined text-lg">logout</span>
                    Farewell
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-10">
                {/* Configuration Panel */}
                <div className="xl:col-span-3 space-y-8">
                    <div className="glass-card p-10 rounded-[2.5rem] border border-outline-variant/10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                            <Settings2 size={240} strokeWidth={1} />
                        </div>

                        <div className="flex items-center justify-between mb-10 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className={cn(
                                    "w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-inner",
                                    activeTab === 'welcome' ? "bg-primary/10 text-primary border border-primary/20" : "bg-accent/10 text-accent border border-accent/20"
                                )}>
                                    <span className="material-symbols-outlined text-3xl">
                                        {activeTab === 'welcome' ? 'waves' : 'door_open'}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                                        {activeTab === 'welcome' ? 'Welcome' : 'Farewell'} Canvas
                                    </h3>
                                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest leading-none">Modules & Visuals</p>
                                </div>
                            </div>
                            <button
                                onClick={() => activeTab === 'welcome' ? setWelcomeEnabled(!welcomeEnabled) : setFarewellEnabled(!farewellEnabled)}
                                className={cn(
                                    "px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                                    (activeTab === 'welcome' ? welcomeEnabled : farewellEnabled)
                                        ? "bg-primary/20 text-primary border-primary/30"
                                        : "bg-surface-container-highest text-on-surface-variant border-white/5"
                                )}
                            >
                                {(activeTab === 'welcome' ? welcomeEnabled : farewellEnabled) ? "Enabled" : "Disabled"}
                            </button>
                        </div>

                        <div className={cn(
                            "grid grid-cols-1 md:grid-cols-2 gap-8 transition-all duration-500 relative z-10",
                            !(activeTab === 'welcome' ? welcomeEnabled : farewellEnabled) && "opacity-40 pointer-events-none blur-[1px]"
                        )}>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
                                        <MessageSquare size={14} className="text-primary" /> Message Template
                                    </label>
                                    <textarea
                                        value={activeTab === 'welcome' ? welcomeMessage : farewellMessage}
                                        onChange={(e) => activeTab === 'welcome' ? setWelcomeMessage(e.target.value) : setFarewellMessage(e.target.value)}
                                        className="w-full bg-surface-container-low border border-white/5 rounded-2xl p-5 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[140px] text-sm leading-relaxed"
                                        placeholder={activeTab === 'welcome' ? "Welcome {user}!" : "Goodbye {user}!"}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
                                        <Hash size={14} className="text-primary" /> Dispatch Channel
                                    </label>
                                    <div className="relative group/select">
                                        <select
                                            value={activeTab === 'welcome' ? welcomeChannel : farewellChannel}
                                            onChange={(e) => activeTab === 'welcome' ? setWelcomeChannel(e.target.value) : setFarewellChannel(e.target.value)}
                                            className="w-full bg-surface-container-low border border-white/5 rounded-2xl p-5 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none font-bold cursor-pointer"
                                        >
                                            <option value="">Select a destination...</option>
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

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
                                        <ImageIcon size={14} className="text-primary" /> Background Image URL
                                    </label>
                                    <input
                                        type="text"
                                        value={activeTab === 'welcome' ? welcomeBg : farewellBg}
                                        onChange={(e) => activeTab === 'welcome' ? setWelcomeBg(e.target.value) : setFarewellBg(e.target.value)}
                                        className="w-full bg-surface-container-low border border-white/5 rounded-2xl p-5 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-xs font-medium"
                                        placeholder="https://example.com/image.png"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
                                            <Palette size={14} className="text-primary" /> Accent Color
                                        </label>
                                        <div className="flex items-center gap-3 bg-surface-container-low border border-white/5 p-3 rounded-2xl">
                                            <input
                                                type="color"
                                                value={activeTab === 'welcome' ? welcomeAccentColor : farewellAccentColor}
                                                onChange={(e) => activeTab === 'welcome' ? setWelcomeAccentColor(e.target.value) : setFarewellAccentColor(e.target.value)}
                                                className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer overflow-hidden p-0"
                                            />
                                            <span className="text-[10px] font-black text-white uppercase tabular-nums">
                                                {activeTab === 'welcome' ? welcomeAccentColor : farewellAccentColor}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
                                            <Type size={14} className="text-primary" /> Text Color
                                        </label>
                                        <div className="flex items-center gap-3 bg-surface-container-low border border-white/5 p-3 rounded-2xl">
                                            <input
                                                type="color"
                                                value={activeTab === 'welcome' ? welcomeTextColor : farewellTextColor}
                                                onChange={(e) => activeTab === 'welcome' ? setWelcomeTextColor(e.target.value) : setFarewellTextColor(e.target.value)}
                                                className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer overflow-hidden p-0"
                                            />
                                            <span className="text-[10px] font-black text-white uppercase tabular-nums">
                                                {activeTab === 'welcome' ? welcomeTextColor : farewellTextColor}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                        <Sparkles size={12} /> Advanced Styling
                                    </h4>

                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                                                <TrendingUp size={12} className="text-primary" /> Layout Engine
                                            </label>
                                            <div className="flex gap-2 p-1.5 bg-surface-container-low border border-white/5 rounded-2xl w-fit">
                                                {['centered', 'left', 'compact'].map(l => (
                                                    <button
                                                        key={l}
                                                        onClick={() => activeTab === 'welcome' ? setWelcomeLayout(l) : setFarewellLayout(l)}
                                                        className={cn(
                                                            "px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all",
                                                            (activeTab === 'welcome' ? welcomeLayout : farewellLayout) === l
                                                                ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                                                                : "text-on-surface-variant hover:text-white"
                                                        )}
                                                    >
                                                        {l}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between bg-surface-container-low border border-white/5 p-5 rounded-2xl group/glass">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                                                    <Eye size={18} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-white leading-none mb-1">Glass FX Engine</span>
                                                    <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-tighter">Enable Backdrop Blur Effects</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => activeTab === 'welcome' ? setWelcomeGlass(!welcomeGlass) : setFarewellGlass(!farewellGlass)}
                                                className={cn(
                                                    "w-12 h-6 rounded-full relative transition-all duration-500",
                                                    (activeTab === 'welcome' ? welcomeGlass : farewellGlass) ? "bg-primary shadow-[0_0_20px_rgba(208,188,255,0.3)]" : "bg-surface-container-highest"
                                                )}
                                            >
                                                <motion.div
                                                    animate={{ x: (activeTab === 'welcome' ? welcomeGlass : farewellGlass) ? 28 : 4 }}
                                                    className="w-4 h-4 bg-white rounded-full absolute top-1"
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-6">
                                        {[
                                            { label: 'Opacity', val: activeTab === 'welcome' ? welcomeOpacity : farewellOpacity, set: activeTab === 'welcome' ? setWelcomeOpacity : setFarewellOpacity, max: 100 },
                                            { label: 'Blur', val: activeTab === 'welcome' ? welcomeBlur : farewellBlur, set: activeTab === 'welcome' ? setWelcomeBlur : setFarewellBlur, max: 20 },
                                            { label: 'Radius', val: activeTab === 'welcome' ? welcomeRadius : farewellRadius, set: activeTab === 'welcome' ? setWelcomeRadius : setFarewellRadius, max: 60 },
                                        ].map(s => (
                                            <div key={s.label}>
                                                <label className="block text-[8px] font-black uppercase tracking-widest text-on-surface-variant mb-2">{s.label}: {s.val}</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max={s.max}
                                                    value={s.val}
                                                    onChange={(e) => s.set(parseInt(e.target.value))}
                                                    className="w-full accent-primary"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview Panel */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="sticky top-10">
                        <div className="flex items-center justify-between mb-6">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                                <Eye size={14} /> Real-time Preview
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_#ffb2b7]"></span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Live</span>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="bg-surface-container-low p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
                                <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
                                <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-accent/5 rounded-full blur-[60px]" />

                                <CanvasPreview
                                    type={activeTab}
                                    bg={activeTab === 'welcome' ? welcomeBg : farewellBg}
                                    text={activeTab === 'welcome' ? welcomeTextColor : farewellTextColor}
                                    accent={activeTab === 'welcome' ? welcomeAccentColor : farewellAccentColor}
                                    message={activeTab === 'welcome' ? welcomeMessage : farewellMessage}
                                    enabled={activeTab === 'welcome' ? welcomeEnabled : farewellEnabled}
                                    layout={activeTab === 'welcome' ? welcomeLayout : farewellLayout}
                                    blur={activeTab === 'welcome' ? welcomeBlur : farewellBlur}
                                    opacity={activeTab === 'welcome' ? welcomeOpacity : farewellOpacity}
                                    radius={activeTab === 'welcome' ? welcomeRadius : farewellRadius}
                                    glass={activeTab === 'welcome' ? welcomeGlass : farewellGlass}
                                />

                                <div className="mt-8 pt-8 border-t border-white/5 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden border border-white/10 shrink-0">
                                        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Radiance" alt="Bot" className="w-full h-full" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black text-white hover:underline cursor-pointer">Radiance Pro</span>
                                            <span className="px-1.5 py-0.5 bg-primary text-[8px] font-black text-on-primary rounded uppercase tracking-tighter">BOT</span>
                                            <span className="text-[9px] text-on-surface-variant">Today at 12:00 PM</span>
                                        </div>
                                        <div className="p-3 bg-[#2b2d31] rounded-lg border border-white/5 inline-block min-w-[200px]">
                                            <div className="w-full h-2 bg-white/5 rounded-full mb-2" />
                                            <div className="w-2/3 h-2 bg-white/5 rounded-full" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="glass-card p-6 rounded-2xl border border-outline-variant/10">
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4">Supported Variables</h5>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { key: "{user}", desc: "Mentions person" },
                                        { key: "{server}", desc: "Guild name" },
                                        { key: "{count}", desc: "Total members" },
                                        { key: "{tag}", desc: "Username#0001" },
                                    ].map((v, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 bg-surface-container rounded-lg border border-white/5">
                                            <code className="text-[10px] font-bold text-primary">{v.key}</code>
                                            <span className="text-[9px] font-medium text-on-surface-variant truncate">{v.desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
