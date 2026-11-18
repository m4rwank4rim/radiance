import React, { useMemo, useState, ReactNode, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    Save,
    Send,
    Palette,
    Image as ImageIcon,
    Type,
    Link as LinkIcon,
    User,
    AlignLeft,
    LayoutTemplate,
    Info,
    Hash,
    Trash2,
    Clock,
    Download,
    Upload,
    ChevronDown,
    ChevronUp,
    Smile,
    Sparkles,
    Calendar,
    ArrowRight
} from "lucide-react";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import RolePanels from "./RolePanels";
import { openUpgradeCheckout } from "../lib/billing";

const LIMITS = {
    authorName: 256,
    title: 256,
    description: 4096,
    footerText: 2048,
    fieldName: 256,
    fieldValue: 1024,
    maxFields: 25,
} as const;

type PreviewStyle = "premium" | "discord";

const PRESET_COLORS = [
    { name: "Blurple", value: "#5865F2" },
    { name: "Green", value: "#248046" },
    { name: "Pink", value: "#EB459E" },
    { name: "White", value: "#FFFFFF" },
    { name: "Cyan", value: "#00AFF0" },
    { name: "Orange", value: "#F26522" }
];

export default function EmbedCreator() {
    const { guildId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form states
    const [authorName, setAuthorName] = useState("");
    const [authorIcon, setAuthorIcon] = useState("");
    const [authorUrl, setAuthorUrl] = useState("");
    const [title, setTitle] = useState("");
    const [titleUrl, setTitleUrl] = useState("");
    const [description, setDescription] = useState("");
    const [bodyText, setBodyText] = useState("");
    const [color, setColor] = useState("#5865F2");
    const [imageUrl, setImageUrl] = useState("");
    const [imagePosition, setImagePosition] = useState<"bottom" | "top">("bottom");
    const [thumbnailUrl, setThumbnailUrl] = useState("");
    const [footerText, setFooterText] = useState("");
    const [footerIcon, setFooterIcon] = useState("");
    const [includeTimestamp, setIncludeTimestamp] = useState(false);
    const [timestampIso, setTimestampIso] = useState<string>("");
    const [fields, setFields] = useState<{ name: string; value: string; inline: boolean }[]>([]);
    const [previewStyle, setPreviewStyle] = useState<PreviewStyle>("discord");
    const [targetChannel, setTargetChannel] = useState("");

    // Accordion expand/collapse states
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        channel: true,
        titleDesc: true,
        author: false,
        fields: false,
        visuals: true,
        footer: false
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Tab calculation from router path/search params
    const activeTab = useMemo(() => {
        if (location.pathname.endsWith("/role-panels")) {
            return "panels";
        }
        const params = new URLSearchParams(location.search);
        if (params.get("tab") === "scheduled") {
            return "scheduled";
        }
        return "embed";
    }, [location]);

    const handleTabChange = (tab: "embed" | "panels" | "scheduled") => {
        if (tab === "embed") {
            navigate(`/dashboard/${guildId}/embeds`);
        } else if (tab === "panels") {
            navigate(`/dashboard/${guildId}/role-panels`);
        } else {
            navigate(`/dashboard/${guildId}/embeds?tab=scheduled`);
        }
    };

    // Fetch Channels
    const { data: channels = [] } = useQuery({
        queryKey: ['channels', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/channels`);
            return res.json();
        }
    });

    // Fetch Discord custom emojis
    const { data: guildEmojis = [] } = useQuery<{ id: string; name: string; animated: boolean; url: string }[]>({
        queryKey: ['emojis', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/emojis`);
            return res.json();
        },
        staleTime: 60_000
    });

    // Emoji picker state
    const [emojiPickerTarget, setEmojiPickerTarget] = useState<"title" | "description" | null>(null);
    const [emojiSearch, setEmojiSearch] = useState("");
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    // Close picker on outside click
    useEffect(() => {
        if (!emojiPickerTarget) return;
        const handler = (e: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
                setEmojiPickerTarget(null);
                setEmojiSearch("");
            }
        };
        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === "Escape") { setEmojiPickerTarget(null); setEmojiSearch(""); }
        };
        document.addEventListener("mousedown", handler);
        document.addEventListener("keydown", keyHandler);
        return () => {
            document.removeEventListener("mousedown", handler);
            document.removeEventListener("keydown", keyHandler);
        };
    }, [emojiPickerTarget]);

    const insertEmoji = useCallback((emoji: { id: string; name: string; animated: boolean }) => {
        const tag = emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
        if (emojiPickerTarget === "title") {
            setTitle(prev => clampLen(prev + tag, LIMITS.title));
        } else if (emojiPickerTarget === "description") {
            setDescription(prev => clampLen(prev + tag, LIMITS.description));
        }
        setEmojiPickerTarget(null);
        setEmojiSearch("");
    }, [emojiPickerTarget]);

    const filteredEmojis = useMemo(() =>
        emojiSearch.trim()
            ? guildEmojis.filter(e => e.name.toLowerCase().includes(emojiSearch.toLowerCase()))
            : guildEmojis
    , [guildEmojis, emojiSearch]);

    const [isSending, setIsSending] = useState(false);

    const effectiveTimestampIso = includeTimestamp
        ? (timestampIso || new Date().toISOString())
        : "";

    const formattedTimestamp = useMemo(() => {
        if (!effectiveTimestampIso) return "";
        const d = new Date(effectiveTimestampIso);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleString();
    }, [effectiveTimestampIso]);

    const handleSend = async () => {
        if (!targetChannel) {
            toast.error("Please select a target channel first!");
            return;
        }

        setIsSending(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/channels/${targetChannel}/embeds`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    embedData: {
                        authorName, authorIcon, authorUrl,
                        title, titleUrl,
                        description, bodyText,
                        color,
                        imageUrl, thumbnailUrl, imagePosition,
                        footerText, footerIcon,
                        timestamp: effectiveTimestampIso || undefined,
                        fields,
                    }
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to send embed");
            }

            toast.success(`Embed sent to channel successfully!`);
        } catch (error: any) {
            toast.error(error.message || "An error occurred");
        } finally {
            setIsSending(false);
        }
    };

    const handleSave = () => {
        toast.success("Embed draft saved!");
    };

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
            authorName, authorIcon, authorUrl,
            title, titleUrl,
            description, bodyText,
            color,
            imageUrl, thumbnailUrl, imagePosition,
            footerText, footerIcon,
            includeTimestamp,
            timestampIso,
            fields,
        }, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `embed-${title || 'untitled'}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        toast.success("Embed configuration exported!");
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (parsed.authorName !== undefined) setAuthorName(parsed.authorName);
                if (parsed.authorIcon !== undefined) setAuthorIcon(parsed.authorIcon);
                if (parsed.authorUrl !== undefined) setAuthorUrl(parsed.authorUrl);
                if (parsed.title !== undefined) setTitle(parsed.title);
                if (parsed.titleUrl !== undefined) setTitleUrl(parsed.titleUrl);
                if (parsed.description !== undefined) setDescription(parsed.description);
                if (parsed.bodyText !== undefined) setBodyText(parsed.bodyText);
                if (parsed.color !== undefined) setColor(parsed.color);
                if (parsed.imageUrl !== undefined) setImageUrl(parsed.imageUrl);
                if (parsed.imagePosition !== undefined) setImagePosition(parsed.imagePosition);
                if (parsed.thumbnailUrl !== undefined) setThumbnailUrl(parsed.thumbnailUrl);
                if (parsed.footerText !== undefined) setFooterText(parsed.footerText);
                if (parsed.footerIcon !== undefined) setFooterIcon(parsed.footerIcon);
                if (parsed.includeTimestamp !== undefined) setIncludeTimestamp(parsed.includeTimestamp);
                if (parsed.timestampIso !== undefined) setTimestampIso(parsed.timestampIso);
                if (parsed.fields !== undefined && Array.isArray(parsed.fields)) setFields(parsed.fields);
                toast.success("Embed configuration imported successfully!");
            } catch (err) {
                toast.error("Failed to parse JSON file.");
            }
        };
        reader.readAsText(file);
    };

    const handleUpgrade = async () => {
        try {
            if (guildId) {
                await openUpgradeCheckout(guildId);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to launch billing portal");
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-4xl">view_quilt</span>
                        Embeds & Panels
                    </h2>
                    <p className="text-on-surface-variant font-medium mt-1">Design rich embeds, send them live, or create role panels.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-5 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-white rounded-xl font-bold flex items-center gap-2 transition-all text-sm border border-white/5 shadow-md cursor-pointer"
                    >
                        <Upload size={16} /> Import
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImport}
                        accept=".json"
                        className="hidden"
                    />
                    <button
                        onClick={handleExport}
                        className="px-5 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-white rounded-xl font-bold flex items-center gap-2 transition-all text-sm border border-white/5 shadow-md cursor-pointer"
                    >
                        <Download size={16} /> Export
                    </button>
                </div>
            </div>

            {/* Navigation Subtabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/10 pb-4">
                <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-2xl border border-white/5">
                    <button
                        onClick={() => handleTabChange("embed")}
                        className={cn(
                            "px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer",
                            activeTab === "embed"
                                ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                                : "text-on-surface-variant hover:bg-white/5"
                        )}
                    >
                        <Send size={14} /> Send Embed
                    </button>
                    <button
                        onClick={() => handleTabChange("panels")}
                        className={cn(
                            "px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer",
                            activeTab === "panels"
                                ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                                : "text-on-surface-variant hover:bg-white/5"
                        )}
                    >
                        <LayoutTemplate size={14} /> Role Panel
                    </button>
                    <button
                        onClick={() => handleTabChange("scheduled")}
                        className={cn(
                            "px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer",
                            activeTab === "scheduled"
                                ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                                : "text-on-surface-variant hover:bg-white/5"
                        )}
                    >
                        <Clock size={14} /> Scheduled
                    </button>
                </div>

                {activeTab === "embed" && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            className="px-5 py-2.5 bg-surface-container-high text-white rounded-xl font-bold flex items-center gap-2 hover:bg-surface-container-highest transition-all text-sm cursor-pointer shadow-md"
                        >
                            <Save size={16} /> Save Draft
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={isSending}
                            className={cn(
                                "px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm shadow-lg shadow-primary/20 cursor-pointer",
                                isSending && "opacity-50 pointer-events-none"
                            )}
                        >
                            {isSending ? (
                                <span className="animate-spin material-symbols-outlined text-sm">sync</span>
                            ) : (
                                <Send size={16} />
                            )}
                            {isSending ? "Sending..." : "Send Embed"}
                        </button>
                    </div>
                )}
            </div>

            {/* Tab Contents Switching */}
            <div>
                {activeTab === "embed" && (
                    <div
                        className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-200"
                    >
                        {/* Left Column: Form Controls */}
                        <div className="xl:col-span-7 space-y-6">
                            <div className="bg-surface-container-low rounded-3xl border border-outline-variant/10 shadow-2xl relative overflow-hidden p-6">
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                    <LayoutTemplate size={120} />
                                </div>

                                <div className="flex items-center gap-4 mb-6 relative z-10">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <Palette size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white uppercase tracking-tighter">Configuration</h3>
                                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Build your embed message</p>
                                    </div>
                                </div>

                                <div className="space-y-4 relative z-10 w-full">
                                    
                                    {/* 1. Target Channel Accordion */}
                                    <div className="border border-outline-variant/10 rounded-2xl overflow-hidden bg-black/20 w-full">
                                        <button
                                            type="button"
                                            onClick={() => toggleSection("channel")}
                                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all text-left"
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 select-none">
                                                <Hash size={14} className="text-primary-fixed-dim" /> Target Channel
                                            </span>
                                            {expandedSections.channel ? <ChevronUp size={16} className="text-primary" /> : <ChevronDown size={16} className="text-on-surface-variant" />}
                                        </button>
                                        <div
                                            className="grid transition-all duration-200 ease-in-out w-full"
                                            style={{ gridTemplateRows: expandedSections.channel ? '1fr' : '0fr', opacity: expandedSections.channel ? 1 : 0 }}
                                        >
                                            <div className="overflow-hidden">
                                            <div className="p-4 pt-0 w-full">
                                                <select
                                                    value={targetChannel}
                                                    onChange={(e) => setTargetChannel(e.target.value)}
                                                    className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium appearance-none cursor-pointer"
                                                >
                                                    <option value="" disabled>Select a channel...</option>
                                                    {channels.filter((c: any) => !c.parent).map((chan: any) => (
                                                        <option key={chan.id} value={chan.id}>#{chan.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Title & Description Accordion */}
                                    <div className="border border-outline-variant/10 rounded-2xl overflow-hidden bg-black/20 w-full">
                                        <button
                                            type="button"
                                            onClick={() => toggleSection("titleDesc")}
                                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all text-left"
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 select-none">
                                                <Type size={14} className="text-primary-fixed-dim" /> Title & Description
                                            </span>
                                            {expandedSections.titleDesc ? <ChevronUp size={16} className="text-primary" /> : <ChevronDown size={16} className="text-on-surface-variant" />}
                                        </button>
                                        <div
                                            className="grid transition-all duration-200 ease-in-out w-full"
                                            style={{ gridTemplateRows: expandedSections.titleDesc ? '1fr' : '0fr', opacity: expandedSections.titleDesc ? 1 : 0 }}
                                        >
                                        <div className="overflow-hidden">
                                            <div className="p-4 pt-0 space-y-4 w-full">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                                    <div className="grid grid-cols-[1fr_auto] gap-2 w-full">
                                                        <input
                                                            type="text"
                                                            placeholder="Embed Title"
                                                            value={title}
                                                            onChange={(e) => setTitle(clampLen(e.target.value, LIMITS.title))}
                                                            className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                                                        />
                                                        <div className="relative" ref={emojiPickerTarget === "title" ? emojiPickerRef : undefined}>
                                                            <button
                                                                type="button"
                                                                onMouseDown={(e) => e.preventDefault()}
                                                                onClick={(e) => { e.stopPropagation(); setEmojiPickerTarget(p => p === "title" ? null : "title"); setEmojiSearch(""); }}
                                                                className={cn(
                                                                    "p-3 border rounded-xl transition-colors shrink-0 flex items-center justify-center cursor-pointer",
                                                                    emojiPickerTarget === "title"
                                                                        ? "bg-primary/10 border-primary/40 text-primary"
                                                                        : "bg-surface-container border-outline-variant/20 hover:bg-surface-container-high text-on-surface-variant hover:text-white"
                                                                )}
                                                                title="Insert server emoji"
                                                            >
                                                                <Smile size={18} />
                                                            </button>
                                                            {emojiPickerTarget === "title" && (
                                                                <EmojiPickerPanel
                                                                    emojis={filteredEmojis}
                                                                    search={emojiSearch}
                                                                    onSearch={setEmojiSearch}
                                                                    onSelect={insertEmoji}
                                                                    onClose={() => { setEmojiPickerTarget(null); setEmojiSearch(""); }}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Title URL (makes it a link)"
                                                        value={titleUrl}
                                                        onChange={(e) => setTitleUrl(e.target.value)}
                                                        className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                                                    />
                                                </div>

                                                <div className="relative w-full">
                                                    <textarea
                                                        placeholder={imagePosition === "top" ? "Intro Text (above image) — supports markdown" : "Description — supports **markdown**, *italics*, `code`, and line breaks"}
                                                        value={description}
                                                        onChange={(e) => setDescription(clampLen(e.target.value, LIMITS.description))}
                                                        className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-4 pr-12 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium h-32 resize-none"
                                                    />
                                                    <div className="absolute bottom-3 right-3" ref={emojiPickerTarget === "description" ? emojiPickerRef : undefined}>
                                                        <button
                                                            type="button"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={(e) => { e.stopPropagation(); setEmojiPickerTarget(p => p === "description" ? null : "description"); setEmojiSearch(""); }}
                                                            className={cn(
                                                                "p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer",
                                                                emojiPickerTarget === "description"
                                                                    ? "bg-primary/20 text-primary"
                                                                    : "bg-black/40 hover:bg-black/60 text-on-surface-variant hover:text-white"
                                                            )}
                                                            title="Insert server emoji"
                                                        >
                                                            <Smile size={16} />
                                                        </button>
                                                        {emojiPickerTarget === "description" && (
                                                            <EmojiPickerPanel
                                                                emojis={filteredEmojis}
                                                                search={emojiSearch}
                                                                onSearch={setEmojiSearch}
                                                                onSelect={insertEmoji}
                                                                onClose={() => { setEmojiPickerTarget(null); setEmojiSearch(""); }}
                                                                alignRight
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] text-on-surface-variant/70 font-semibold px-1 w-full">
                                                    <span className="uppercase tracking-widest text-zinc-500">Supports **bold**, *italic*, `code`, :emoji:</span>
                                                    <span>{description.length}/{LIMITS.description}</span>
                                                </div>

                                                {imagePosition === "top" && (
                                                    <div className="relative w-full mt-4">
                                                        <textarea
                                                            placeholder="Body Text (Main content below image) — supports markdown"
                                                            value={bodyText}
                                                            onChange={(e) => setBodyText(clampLen(e.target.value, LIMITS.description))}
                                                            className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-4 pr-12 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium h-32 resize-none"
                                                        />
                                                        <div className="flex justify-between items-center text-[10px] text-on-surface-variant/70 font-semibold px-1 w-full mt-1">
                                                            <span className="uppercase tracking-widest text-zinc-500">Supports **bold**, *italic*, `code`</span>
                                                            <span>{bodyText.length}/{LIMITS.description}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        </div>
                                    </div>

                                    {/* 3. Author Information Accordion */}
                                    <div className="border border-outline-variant/10 rounded-2xl overflow-hidden bg-black/20 w-full">
                                        <button
                                            type="button"
                                            onClick={() => toggleSection("author")}
                                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all text-left"
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 select-none">
                                                <User size={14} className="text-primary-fixed-dim" /> Author Information
                                            </span>
                                            {expandedSections.author ? <ChevronUp size={16} className="text-primary" /> : <ChevronDown size={16} className="text-on-surface-variant" />}
                                        </button>
                                        <div
                                            className="grid transition-all duration-200 ease-in-out w-full"
                                            style={{ gridTemplateRows: expandedSections.author ? '1fr' : '0fr', opacity: expandedSections.author ? 1 : 0 }}
                                        >
                                        <div className="overflow-hidden">
                                            <div className="p-4 pt-0 space-y-4 w-full">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                                    <input
                                                        type="text"
                                                        placeholder="Author Name"
                                                        value={authorName}
                                                        onChange={(e) => setAuthorName(clampLen(e.target.value, LIMITS.authorName))}
                                                        className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Author URL"
                                                        value={authorUrl}
                                                        onChange={(e) => setAuthorUrl(e.target.value)}
                                                        className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Author Icon URL"
                                                        value={authorIcon}
                                                        onChange={(e) => setAuthorIcon(e.target.value)}
                                                        className="w-full md:col-span-2 bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                                                    />
                                                </div>
                                                <div className="text-[11px] font-semibold text-on-surface-variant/70 w-full">
                                                    Author Name: {authorName.length}/{LIMITS.authorName}
                                                </div>
                                            </div>
                                        </div>
                                        </div>
                                    </div>

                                    {/* 4. Custom Fields Accordion */}
                                    <div className="border border-outline-variant/10 rounded-2xl overflow-hidden bg-black/20 w-full">
                                        <button
                                            type="button"
                                            onClick={() => toggleSection("fields")}
                                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all text-left"
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 select-none">
                                                <LayoutTemplate size={14} className="text-primary-fixed-dim" /> Custom Fields ({fields.length}/{LIMITS.maxFields})
                                            </span>
                                            {expandedSections.fields ? <ChevronUp size={16} className="text-primary" /> : <ChevronDown size={16} className="text-on-surface-variant" />}
                                        </button>
                                        <div
                                            className="grid transition-all duration-200 ease-in-out w-full"
                                            style={{ gridTemplateRows: expandedSections.fields ? '1fr' : '0fr', opacity: expandedSections.fields ? 1 : 0 }}
                                        >
                                        <div className="overflow-hidden">
                                            <div className="p-4 pt-0 space-y-4 w-full">
                                                <div className="flex justify-end w-full">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (fields.length >= LIMITS.maxFields) return;
                                                            setFields([...fields, { name: "", value: "", inline: false }]);
                                                        }}
                                                        disabled={fields.length >= LIMITS.maxFields}
                                                        className="text-[10px] font-bold uppercase bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors cursor-pointer"
                                                    >
                                                        + Add Field
                                                    </button>
                                                </div>

                                                <div className="space-y-3 w-full">
                                                    {fields.map((field, i) => (
                                                        <div key={i} className="bg-black/20 border border-outline-variant/10 rounded-xl p-4 space-y-3 relative group w-full">
                                                            <button
                                                                type="button"
                                                                onClick={() => setFields(fields.filter((_, idx) => idx !== i))}
                                                                className="absolute top-2 right-2 p-1.5 text-error/50 hover:bg-error/10 hover:text-error rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3 pr-8 w-full items-center">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Field Name"
                                                                    value={field.name}
                                                                    onChange={(e) => {
                                                                        const newFields = [...fields];
                                                                        newFields[i].name = clampLen(e.target.value, LIMITS.fieldName);
                                                                        setFields(newFields);
                                                                    }}
                                                                    className="w-full bg-surface-container border border-outline-variant/20 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                                                                />
                                                                <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer select-none w-fit md:justify-self-end">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={field.inline}
                                                                        onChange={(e) => {
                                                                            const newFields = [...fields];
                                                                            newFields[i].inline = e.target.checked;
                                                                            setFields(newFields);
                                                                        }}
                                                                        className="w-4 h-4 rounded appearance-none border border-outline-variant/30 checked:bg-primary checked:border-primary cursor-pointer relative after:content-[''] after:absolute after:hidden checked:after:block after:left-[4px] after:top-[1px] after:w-1.5 after:h-2.5 after:border-solid after:border-white after:border-0 after:border-b-2 after:border-r-2 after:rotate-45"
                                                                    />
                                                                    Display Inline
                                                                </label>
                                                            </div>
                                                            <textarea
                                                                placeholder="Field Value (supports markdown)"
                                                                value={field.value}
                                                                onChange={(e) => {
                                                                    const newFields = [...fields];
                                                                    newFields[i].value = clampLen(e.target.value, LIMITS.fieldValue);
                                                                    setFields(newFields);
                                                                }}
                                                                className="w-full bg-surface-container border border-outline-variant/20 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium h-20 resize-none"
                                                            />
                                                            <div className="text-[11px] font-semibold text-on-surface-variant/70 w-full">
                                                                {field.name.length}/{LIMITS.fieldName} • {field.value.length}/{LIMITS.fieldValue}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {fields.length === 0 && (
                                                        <div className="text-center p-6 border border-dashed border-outline-variant/20 rounded-xl text-on-surface-variant/50 text-sm font-medium w-full">
                                                            No custom fields added.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        </div>
                                    </div>

                                    {/* 5. Visuals & Color Accordion */}
                                    <div className="border border-outline-variant/10 rounded-2xl overflow-hidden bg-black/20 w-full">
                                        <button
                                            type="button"
                                            onClick={() => toggleSection("visuals")}
                                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all text-left"
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 select-none">
                                                <ImageIcon size={14} className="text-primary-fixed-dim" /> Visuals & Color
                                            </span>
                                            {expandedSections.visuals ? <ChevronUp size={16} className="text-primary" /> : <ChevronDown size={16} className="text-on-surface-variant" />}
                                        </button>
                                        <div
                                            className="grid transition-all duration-200 ease-in-out w-full"
                                            style={{ gridTemplateRows: expandedSections.visuals ? '1fr' : '0fr', opacity: expandedSections.visuals ? 1 : 0 }}
                                        >
                                        <div className="overflow-hidden">
                                            <div className="p-4 pt-0 space-y-5 w-full">
                                                {/* Preset Color Chips */}
                                                <div className="space-y-2 w-full">
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">Preset Colors</div>
                                                    <div className="flex flex-wrap gap-2 w-full">
                                                        {PRESET_COLORS.map(c => (
                                                            <button
                                                                key={c.value}
                                                                type="button"
                                                                onClick={() => setColor(c.value)}
                                                                className={cn(
                                                                    "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer",
                                                                    color === c.value
                                                                        ? "border-primary bg-primary/10 text-white"
                                                                        : "border-outline-variant/20 bg-surface-container hover:bg-surface-container-high text-on-surface-variant"
                                                                )}
                                                            >
                                                                <span className="w-3.5 h-3.5 rounded-full border border-white/10 shrink-0" style={{ backgroundColor: c.value }} />
                                                                {c.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                                    <div className="flex items-center gap-3 w-full">
                                                        <div className="h-12 w-12 rounded-xl border-2 border-outline-variant/20 overflow-hidden shrink-0 cursor-pointer shadow-lg relative group">
                                                            <input
                                                                type="color"
                                                                value={color}
                                                                onChange={(e) => setColor(e.target.value)}
                                                                className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer"
                                                            />
                                                            <div className="w-full h-full" style={{ backgroundColor: color }} />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={color}
                                                            onChange={(e) => setColor(e.target.value)}
                                                            placeholder="#FFFFFF"
                                                            className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium uppercase"
                                                        />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Thumbnail Image URL"
                                                        value={thumbnailUrl}
                                                        onChange={(e) => setThumbnailUrl(e.target.value)}
                                                        className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Main Image URL"
                                                        value={imageUrl}
                                                        onChange={(e) => setImageUrl(e.target.value)}
                                                        className="w-full md:col-span-2 bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                                                    />
                                                    <div className="md:col-span-2 flex items-center justify-between bg-black/20 rounded-xl p-3 border border-outline-variant/10 mt-2">
                                                        <div className="text-sm font-semibold text-white">Image Layout</div>
                                                        <div className="flex bg-surface-container rounded-lg p-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => setImagePosition("bottom")}
                                                                className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all", imagePosition === "bottom" ? "bg-primary text-white shadow-md" : "text-on-surface-variant hover:text-white")}
                                                            >Standard</button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setImagePosition("top")}
                                                                className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all", imagePosition === "top" ? "bg-primary text-white shadow-md" : "text-on-surface-variant hover:text-white")}
                                                            >Hero (Top Image)</button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-3 pt-1 w-full">
                                                    <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer select-none w-fit">
                                                        <input
                                                            type="checkbox"
                                                            checked={includeTimestamp}
                                                            onChange={(e) => setIncludeTimestamp(e.target.checked)}
                                                            className="w-4 h-4 rounded appearance-none border border-outline-variant/30 checked:bg-primary checked:border-primary cursor-pointer relative after:content-[''] after:absolute after:hidden checked:after:block after:left-[4px] after:top-[1px] after:w-1.5 after:h-2.5 after:border-solid after:border-white after:border-0 after:border-b-2 after:border-r-2 after:rotate-45"
                                                        />
                                                        Include Timestamp
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                        </div>
                                    </div>

                                    {/* 6. Footer Information Accordion */}
                                    <div className="border border-outline-variant/10 rounded-2xl overflow-hidden bg-black/20 w-full">
                                        <button
                                            type="button"
                                            onClick={() => toggleSection("footer")}
                                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all text-left"
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 select-none">
                                                <Info size={14} className="text-primary-fixed-dim" /> Footer Information
                                            </span>
                                            {expandedSections.footer ? <ChevronUp size={16} className="text-primary" /> : <ChevronDown size={16} className="text-on-surface-variant" />}
                                        </button>
                                        <div
                                            className="grid transition-all duration-200 ease-in-out w-full"
                                            style={{ gridTemplateRows: expandedSections.footer ? '1fr' : '0fr', opacity: expandedSections.footer ? 1 : 0 }}
                                        >
                                        <div className="overflow-hidden">
                                            <div className="p-4 pt-0 space-y-4 w-full">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                                    <input
                                                        type="text"
                                                        placeholder="Footer Text"
                                                        value={footerText}
                                                        onChange={(e) => setFooterText(clampLen(e.target.value, LIMITS.footerText))}
                                                        className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Footer Icon URL"
                                                        value={footerIcon}
                                                        onChange={(e) => setFooterIcon(e.target.value)}
                                                        className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                                                    />
                                                </div>

                                                {includeTimestamp && (
                                                    <div className="space-y-2 pt-2 border-t border-outline-variant/10 w-full">
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">Custom Timestamp Date</div>
                                                        <input
                                                            type="datetime-local"
                                                            value={timestampIso ? toDatetimeLocal(timestampIso) : ""}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                if (!v) return setTimestampIso("");
                                                                const dt = new Date(v);
                                                                setTimestampIso(dt.toISOString());
                                                            }}
                                                            className="w-full bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium cursor-pointer"
                                                        />
                                                        {timestampIso && (
                                                            <div className="text-[11px] font-semibold text-on-surface-variant/70 w-full">
                                                                Preview: {formattedTimestamp || "—"}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="text-[11px] font-semibold text-on-surface-variant/70 w-full">
                                                    Footer Text: {footerText.length}/{LIMITS.footerText}
                                                </div>
                                            </div>
                                        </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* Right Column: Live Preview */}
                        <div className="xl:col-span-5 relative">
                            <div className="sticky top-24 space-y-6">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-[#5865F2]/10 flex items-center justify-center text-[#5865F2]">
                                        <LayoutTemplate size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white uppercase tracking-tighter">Live Preview</h3>
                                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Real-time Discord look</p>
                                    </div>
                                    <div className="ml-auto flex items-center gap-2 bg-black/20 border border-outline-variant/10 rounded-xl p-1">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewStyle("discord")}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors cursor-pointer",
                                                previewStyle === "discord"
                                                    ? "bg-primary text-on-primary"
                                                    : "text-on-surface-variant hover:bg-white/5"
                                            )}
                                        >
                                            Discord
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewStyle("premium")}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors cursor-pointer",
                                                previewStyle === "premium"
                                                    ? "bg-primary text-on-primary"
                                                    : "text-on-surface-variant hover:bg-white/5"
                                            )}
                                        >
                                            Premium
                                        </button>
                                    </div>
                                </div>

                <div className="relative">
                                    <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 blur-3xl opacity-50 ring-1 ring-inset ring-white/5 pointer-events-none rounded-[3rem]" />

                                    <div
                                        className={cn(
                                            "max-w-full overflow-hidden antialiased relative z-10 transition-colors",
                                            previewStyle === "premium"
                                                ? "bg-[#1b1b1e]/60 backdrop-blur-3xl rounded-[2rem] p-6 border border-white/[0.05] shadow-[0_32px_64px_rgba(0,0,0,0.5)] ring-1 ring-white/5 hover:border-white/10"
                                                : "bg-[#313338] rounded-2xl p-6 border border-white/5 shadow-[0_24px_48px_rgba(0,0,0,0.45)]"
                                        )}
                                    >
                                        {/* Avatar & Username */}
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

                                                {/* Embed Body */}
                                                <div>
                                                    {(authorName || title || description || imageUrl || thumbnailUrl || footerText || includeTimestamp || fields.length > 0) ? (
                                                        <div className="relative group">
                                                            <div
                                                                className="absolute -inset-0.5 bg-gradient-to-r blur-xl opacity-20 group-hover:opacity-40 transition duration-500 rounded-2xl"
                                                                style={{ backgroundImage: `linear-gradient(to right, ${color || '#202225'}, transparent)` }}
                                                            />

                                                            <div
                                                                className={cn(
                                                                    "relative max-w-[432px] overflow-hidden flex border-l-4 ring-1 ring-white/5",
                                                                    previewStyle === "premium"
                                                                        ? "bg-[#252528]/80 backdrop-blur-xl rounded-2xl shadow-xl"
                                                                        : "bg-[#2b2d31] rounded-xl shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
                                                                )}
                                                                style={{ borderColor: color || "#202225" }}
                                                            >
                                                                <div className={cn("flex flex-col gap-3 w-full", previewStyle === "premium" ? "p-5" : "p-4")}>

                                                                    {/* Author block */}
                                                                    {authorName && (
                                                                        <div className="flex items-center gap-3 mb-1">
                                                                            {authorIcon && <img src={authorIcon} alt="Author" className="w-7 h-7 rounded-full object-cover ring-2 ring-[#353438]" onError={(e) => e.currentTarget.style.display = 'none'} />}
                                                                            <IfLink url={authorUrl}>
                                                                                <span className={cn("text-white font-semibold tracking-tight drop-shadow-sm", previewStyle === "premium" ? "text-[15px] font-extrabold" : "text-[13px]")}>{authorName}</span>
                                                                            </IfLink>
                                                                        </div>
                                                                    )}

                                                                    {/* Main Embed Content Area with Thumbnail Split */}
                                                                    <div className="flex gap-5">
                                                                        <div className="flex-1 flex flex-col gap-2">
                                                                            {title && (
                                                                                <IfLink url={titleUrl}>
                                                                                    <div
                                                                                        className={cn(
                                                                                            "tracking-tight break-words",
                                                                                            previewStyle === "premium" ? "font-black text-[17px]" : "font-semibold text-[20px] leading-snug",
                                                                                            titleUrl ? "text-[#00a8fc] hover:underline" : "text-white"
                                                                                        )}
                                                                                    >
                                                                                        {title}
                                                                                    </div>
                                                                                </IfLink>
                                                                            )}

                                                                            {description && (
                                                                                <div className={cn("text-[#dbdee1] text-[14px] leading-relaxed", previewStyle === "premium" ? "font-medium" : "font-normal")}>
                                                                                    <DiscordMarkdown text={description} />
                                                                                </div>
                                                                            )}

                                                                            {/* Main Image on Top Mode */}
                                                                            {imagePosition === "top" && imageUrl && (
                                                                                <div className={cn("mt-3 mb-1 overflow-hidden max-w-[400px] ring-1 ring-white/10 bg-black/20", previewStyle === "premium" ? "rounded-xl shadow-lg" : "rounded-lg")}>
                                                                                    <img src={imageUrl} alt="Main" className="w-full max-h-[350px] object-contain cursor-pointer hover:scale-[1.01] transition-transform duration-300" onClick={() => window.open(imageUrl, "_blank", "noopener,noreferrer")} onError={(e) => e.currentTarget.style.display = 'none'} />
                                                                                </div>
                                                                            )}

                                                                            {imagePosition === "top" && bodyText && (
                                                                                <div className={cn("text-[#dbdee1] text-[14px] leading-relaxed mt-2", previewStyle === "premium" ? "font-medium" : "font-normal")}>
                                                                                    <DiscordMarkdown text={bodyText} />
                                                                                </div>
                                                                            )}

                                                                            {/* Custom Fields Grid */}
                                                                            {fields.length > 0 && (
                                                                                <div className={cn("flex flex-wrap gap-x-4 gap-y-2 mt-2 text-[14px]", previewStyle === "discord" && "mt-1")}>
                                                                                    {fields.map((field, i) => (
                                                                                        <div key={i} className={cn("flex flex-col gap-0.5", field.inline ? "min-w-[120px] flex-1 max-w-[48%]" : "w-full")}>
                                                                                            {field.name && <div className={cn("text-white", previewStyle === "premium" ? "font-bold" : "font-semibold text-[12px]")}>{field.name}</div>}
                                                                                            {field.value && (
                                                                                                <div className={cn("text-[#dbdee1] whitespace-pre-wrap", previewStyle === "discord" && "text-[13px]")}>
                                                                                                    <DiscordMarkdown text={field.value} />
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Thumbnail */}
                                                                        {thumbnailUrl && (
                                                                            <div className="shrink-0 max-w-[90px] max-h-[90px] rounded-xl overflow-hidden mt-1 shadow-md ring-1 ring-white/10">
                                                                                <img
                                                                                    src={thumbnailUrl}
                                                                                    alt="Thumbnail"
                                                                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                                                                    onClick={() => window.open(thumbnailUrl, "_blank", "noopener,noreferrer")}
                                                                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Main Image */}
                                                                    {imagePosition !== "top" && imageUrl && (
                                                                        <div className={cn("mt-3 overflow-hidden max-w-[400px] ring-1 ring-white/10 bg-black/20", previewStyle === "premium" ? "rounded-xl shadow-lg" : "rounded-lg")}>
                                                                            <img
                                                                                src={imageUrl}
                                                                                alt="Main"
                                                                                className="w-full max-h-[350px] object-contain cursor-pointer hover:scale-[1.01] transition-transform duration-300"
                                                                                onClick={() => window.open(imageUrl, "_blank", "noopener,noreferrer")}
                                                                                onError={(e) => e.currentTarget.style.display = 'none'}
                                                                            />
                                                                        </div>
                                                                    )}

                                                                    {/* Footer */}
                                                                    {(footerText || includeTimestamp) && (
                                                                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                                                                            {footerText && footerIcon && (
                                                                                <img
                                                                                    src={footerIcon}
                                                                                    alt="Footer"
                                                                                    className="w-5 h-5 rounded-full object-cover"
                                                                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                                                                />
                                                                            )}
                                                                            <span className="text-[#949ba4] text-[10px] font-bold uppercase tracking-widest">
                                                                                {footerText}
                                                                                {footerText && includeTimestamp ? " • " : ""}
                                                                                {includeTimestamp ? formattedTimestamp : ""}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="relative bg-[#252528]/80 backdrop-blur-xl rounded-2xl max-w-[432px] overflow-hidden flex border-l-4 border-white/10 ring-1 ring-white/5">
                                                            <div className="p-5 text-[#dbdee1] text-sm italic opacity-50 font-bold tracking-wide">Enter embed details to see a preview...</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "panels" && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <RolePanels hideHeader={true} />
                    </div>
                )}

                {activeTab === "scheduled" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        {/* Premium Scheduled Placeholder Header */}
                        <div className="bg-surface-container-low rounded-3xl border border-outline-variant/10 shadow-2xl p-8 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
                            <div className="space-y-4 max-w-2xl">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-black text-primary uppercase tracking-widest shadow-md shadow-primary/5">
                                    <Sparkles size={12} className="animate-pulse" /> Pro Automation Feature
                                </div>
                                <h3 className="text-2xl font-black text-white tracking-tight">Auto-Schedule Embeds & Role Panels</h3>
                                <p className="text-on-surface-variant font-medium text-sm leading-relaxed">
                                    Unlock advanced messaging automation. Send guild announcements, schedule server events, cycle level cards, or refresh role panel buttons at any exact date, time, or recurring interval.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                    <div className="flex items-center gap-3 bg-black/20 border border-white/5 rounded-xl p-3.5">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                            <Calendar size={16} />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-xs font-bold text-white">One-time Scheduling</div>
                                            <div className="text-[10px] text-on-surface-variant font-medium">Set precise UTC dates & times</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-black/20 border border-white/5 rounded-xl p-3.5">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                            <Clock size={16} />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-xs font-bold text-white">Recurring Intervals</div>
                                            <div className="text-[10px] text-on-surface-variant font-medium">Repeat daily, weekly, or custom cron</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center text-center p-6 bg-black/20 border border-outline-variant/10 rounded-2xl shrink-0 w-full md:w-64 gap-4">
                                <div className="w-12 h-12 rounded-full primary-gradient flex items-center justify-center text-white shadow-neon shadow-primary/20">
                                    <span className="material-symbols-outlined text-lg">bolt</span>
                                </div>
                                <div>
                                    <div className="text-sm font-black text-white">Automation Suite</div>
                                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mt-0.5">Start Automating Today</p>
                                </div>
                                <button
                                    onClick={handleUpgrade}
                                    className="w-full py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl text-xs font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20 cursor-pointer flex items-center justify-center gap-2"
                                >
                                    Upgrade to Pro <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Simulated List of Scheduled Items */}
                        <div className="bg-surface-container-low rounded-3xl border border-outline-variant/10 shadow-2xl p-6">
                            <h4 className="text-xs font-black uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                                <Clock size={12} className="text-primary" /> Active Schedules (Simulation)
                            </h4>
                            <div className="divide-y divide-white/5">
                                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-surface-container-high border border-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                                            <Type size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white flex items-center gap-2">
                                                Welcome Announcement Embed
                                                <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-[8px] font-black text-primary uppercase tracking-widest rounded-full leading-none">Weekly</span>
                                            </div>
                                            <div className="text-xs text-on-surface-variant font-medium mt-1">Posts rich welcome guidelines to #welcome channel</div>
                                            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Every Monday at 09:00 AM UTC</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-mono text-zinc-500 bg-black/20 px-2.5 py-1 rounded-md border border-white/5">06-22 09:00 UTC</span>
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/25 shrink-0" title="Active" />
                                    </div>
                                </div>
                                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-surface-container-high border border-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                                            <LayoutTemplate size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white flex items-center gap-2">
                                                Verification Panel Button Reset
                                                <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-[8px] font-black text-primary uppercase tracking-widest rounded-full leading-none">Daily</span>
                                            </div>
                                            <div className="text-xs text-on-surface-variant font-medium mt-1">Refreshes interaction roles on active Discord panel</div>
                                            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Every Day at 12:00 AM UTC</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-mono text-zinc-500 bg-black/20 px-2.5 py-1 rounded-md border border-white/5">06-17 00:00 UTC</span>
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/25 shrink-0" title="Active" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper to conditionally wrap in anchor tag
function IfLink({ url, children }: { url: string, children: ReactNode }) {
    if (url && url.startsWith('http')) {
        return <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">{children}</a>;
    }
    return <>{children}</>;
}

// Discord server emoji picker panel
function EmojiPickerPanel({
    emojis,
    search,
    onSearch,
    onSelect,
    onClose,
    alignRight
}: {
    emojis: { id: string; name: string; animated: boolean; url: string }[];
    search: string;
    onSearch: (s: string) => void;
    onSelect: (e: { id: string; name: string; animated: boolean }) => void;
    onClose: () => void;
    alignRight?: boolean;
}) {
    return (
        <div
            className={`absolute z-50 bottom-full mb-2 w-72 bg-[#1e1f22] border border-outline-variant/20 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden ${alignRight ? 'right-0' : 'left-0'}`}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-outline-variant/10">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Server Emojis</span>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-on-surface-variant hover:text-white text-xs font-bold transition-colors cursor-pointer px-1"
                >✕</button>
            </div>
            {/* Search */}
            <div className="px-3 py-2 border-b border-outline-variant/10">
                <input
                    autoFocus
                    type="text"
                    placeholder="Search emojis..."
                    value={search}
                    onChange={(e) => onSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-on-surface-variant/50"
                />
            </div>
            {/* Emoji Grid */}
            <div className="overflow-y-auto max-h-52 p-2">
                {emojis.length === 0 ? (
                    <div className="text-center py-6 text-on-surface-variant/50 text-xs font-medium">
                        {search ? "No emojis found" : "No custom emojis in this server"}
                    </div>
                ) : (
                    <div className="grid grid-cols-7 gap-1">
                        {emojis.map(emoji => (
                            <button
                                key={emoji.id}
                                type="button"
                                title={`:${emoji.name}:`}
                                onClick={() => onSelect(emoji)}
                                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer group relative"
                            >
                                <img
                                    src={emoji.url}
                                    alt={emoji.name}
                                    className="w-7 h-7 object-contain"
                                    loading="lazy"
                                />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-black/90 text-white text-[9px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    :{emoji.name}:
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {emojis.length > 0 && (
                <div className="px-3 py-1.5 border-t border-outline-variant/10 text-[9px] text-on-surface-variant/40 font-semibold uppercase tracking-widest">
                    {emojis.length} emoji{emojis.length !== 1 ? 's' : ''}
                </div>
            )}
        </div>
    );
}

function toDatetimeLocal(iso: string) {
    // Convert ISO to input[type=datetime-local] value (YYYY-MM-DDTHH:mm)
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function clampLen(s: string, max: number) {
    return s.length > max ? s.slice(0, max) : s;
}

// Preserving original Markdown rendering helpers below
function DiscordMarkdown({ text }: { text: string }) {
    const nodes = useMemo(() => renderDiscordMarkdown(text), [text]);
    return <>{nodes}</>;
}

function renderDiscordMarkdown(text: string): ReactNode[] {
    const parts = splitFences(text);
    const out: ReactNode[] = [];

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.type === "code") {
            out.push(
                <pre
                    key={`code-${i}`}
                    className="mt-2 mb-2 rounded-lg bg-[#1e1f22] border border-white/10 px-3 py-2 overflow-auto text-[13px] leading-relaxed text-[#dbdee1]"
                >
                    <code className="font-mono whitespace-pre-wrap">{part.content}</code>
                </pre>
            );
            continue;
        }

        const lines = part.content.split(/\r?\n/);
        let list: string[] = [];
        const flushList = () => {
            if (list.length === 0) return;
            out.push(
                <ul key={`ul-${i}-${out.length}`} className="list-disc ml-5 space-y-1">
                    {list.map((li, idx) => (
                        <li key={idx}>{renderInline(li)}</li>
                    ))}
                </ul>
            );
            list = [];
        };

        for (const rawLine of lines) {
            const line = rawLine.trimEnd();
            const m = line.match(/^\s*(?:[-*]|•)\s+(.*)$/);
            if (m) {
                list.push(m[1] ?? "");
            } else {
                flushList();
                if (line.trim().length === 0) {
                    out.push(<div key={`br-${i}-${out.length}`} className="h-2" />);
                } else {
                    out.push(
                        <div key={`p-${i}-${out.length}`} className="whitespace-pre-wrap">
                            {renderInline(line)}
                        </div>
                    );
                }
            }
        }
        flushList();
    }

    return out;
}

function splitFences(text: string): Array<{ type: "text" | "code"; content: string }> {
    const result: Array<{ type: "text" | "code"; content: string }> = [];
    const fence = "```";
    let cursor = 0;

    while (cursor < text.length) {
        const start = text.indexOf(fence, cursor);
        if (start === -1) {
            result.push({ type: "text", content: text.slice(cursor) });
            break;
        }

        if (start > cursor) {
            result.push({ type: "text", content: text.slice(cursor, start) });
        }

        const afterFence = start + fence.length;
        const end = text.indexOf(fence, afterFence);
        if (end === -1) {
            result.push({ type: "text", content: text.slice(start) });
            break;
        }

        const raw = text.slice(afterFence, end);
        const rawLines = raw.replace(/^\r?\n/, "").split(/\r?\n/);
        const first = rawLines[0] ?? "";
        const isLang = /^[a-z0-9_+-]{1,20}$/i.test(first.trim());
        const content = isLang && rawLines.length > 1 ? rawLines.slice(1).join("\n") : rawLines.join("\n");
        result.push({ type: "code", content });
        cursor = end + fence.length;
    }

    return result;
}

function renderInline(text: string): ReactNode[] {
    const tokens: ReactNode[] = [];
    let remaining = text;
    let key = 0;

    const pushText = (t: string) => {
        if (!t) return;
        tokens.push(<span key={`t-${key++}`}>{t}</span>);
    };

    while (remaining.length > 0) {
        const matches = [
            { type: "link" as const, re: /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/ },
            { type: "code" as const, re: /`([^`]+)`/ },
            { type: "bold" as const, re: /\*\*([^*]+)\*\*/ },
            { type: "italic" as const, re: /\*([^*]+)\*/ },
        ];

        let best: { type: "link" | "code" | "bold" | "italic"; idx: number; m: RegExpMatchArray } | null = null;
        for (const cand of matches) {
            const m = remaining.match(cand.re);
            if (!m || m.index == null) continue;
            if (!best || m.index < best.idx) best = { type: cand.type, idx: m.index, m };
        }

        if (!best) {
            pushText(remaining);
            break;
        }

        pushText(remaining.slice(0, best.idx));

        const full = best.m[0];
        if (best.type === "link") {
            const label = best.m[1] ?? "";
            const url = best.m[2] ?? "";
            tokens.push(
                <a
                    key={`a-${key++}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00a8fc] hover:underline"
                >
                    {label}
                </a>
            );
        } else if (best.type === "code") {
            const code = best.m[1] ?? "";
            tokens.push(
                <code
                    key={`c-${key++}`}
                    className="px-1 py-0.5 rounded bg-black/30 border border-white/10 font-mono text-[13px]"
                >
                    {code}
                </code>
            );
        } else if (best.type === "bold") {
            tokens.push(<strong key={`b-${key++}`}>{best.m[1] ?? ""}</strong>);
        } else if (best.type === "italic") {
            tokens.push(<em key={`i-${key++}`}>{best.m[1] ?? ""}</em>);
        }

        remaining = remaining.slice(best.idx + full.length);
    }

    return tokens;
}
