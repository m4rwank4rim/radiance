import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { openUpgradeCheckout } from "../lib/billing";
import { toast } from "sonner";

export default function Tickets() {
    const { guildId } = useParams();
    const queryClient = useQueryClient();
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [replyMessage, setReplyMessage] = useState("");
    const [deployChannelId, setDeployChannelId] = useState("");
    const [slaPriority, setSlaPriority] = useState("normal");
    const [premiumError, setPremiumError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const { data: channels = [] } = useQuery({
        queryKey: ['channels', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/channels`);
            if (!res.ok) throw new Error("Failed to fetch channels");
            return res.json();
        },
        enabled: !!guildId
    });

    const { data: tickets = [], isLoading } = useQuery({
        queryKey: ['tickets', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/tickets`);
            if (!res.ok) return [];
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
    const ticketIntelLocked = !(entitlements?.features?.ticket_intelligence);

    const { data: slaRows = [] } = useQuery({
        queryKey: ['ticketSla', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/tickets/sla`);
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!guildId
    });

    const deployMutation = useMutation({
        mutationFn: async (channelId: string) => {
            const res = await fetch(`/api/guilds/${guildId}/tickets/deploy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId })
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Failed to deploy ticket panel" }))).error);
            return res.json();
        },
        onSuccess: () => {
            setTimeout(() => queryClient.invalidateQueries({ queryKey: ['channels', guildId] }), 1000);
        },
        onError: (err: any) => setPremiumError(err?.message || "Failed to deploy ticket panel")
    });

    const { data: messages = [], refetch: refetchMessages } = useQuery({
        queryKey: ['messages', guildId, selectedTicket?.channel_thread_id],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/tickets/${selectedTicket.channel_thread_id}/messages`);
            if (!res.ok) throw new Error("Failed to fetch messages");
            return res.json();
        },
        enabled: !!guildId && !!selectedTicket,
        refetchInterval: 3000 // Poll every 3 seconds
    });

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const replyMutation = useMutation({
        mutationFn: async ({ threadId, message }: { threadId: string, message: string }) => {
            const res = await fetch(`/api/guilds/${guildId}/tickets/${threadId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });
            if (!res.ok) throw new Error("Failed to send reply");
            return res.json();
        },
        onSuccess: () => {
            setReplyMessage("");
            refetchMessages();
        }
    });

    const closeMutation = useMutation({
        mutationFn: async (ticketId: string) => {
            const res = await fetch(`/api/guilds/${guildId}/tickets/${ticketId}/close`, {
                method: 'POST'
            });
            if (!res.ok) throw new Error("Failed to close ticket");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets', guildId] });
            setSelectedTicket(null);
        }
    });

    const slaMutation = useMutation({
        mutationFn: async ({ ticketId, priority }: { ticketId: string; priority: string }) => {
            const res = await fetch(`/api/guilds/${guildId}/tickets/sla`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticket_id: ticketId, priority })
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Failed to set SLA" }))).error);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticketSla', guildId] });
        },
        onError: (err: any) => setPremiumError(err?.message || "Failed to set SLA")
    });

    const summaryMutation = useMutation({
        mutationFn: async (ticketId: string) => {
            const res = await fetch(`/api/guilds/${guildId}/tickets/${ticketId}/summary`, { method: "POST" });
            if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Failed to generate summary" }))).error);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticketSla', guildId] });
        },
        onError: (err: any) => setPremiumError(err?.message || "Failed to generate summary")
    });

    if (isLoading) {
        return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
    }

    const openTickets = tickets.filter((t: any) => t.status === 'open');
    const closedTickets = tickets.filter((t: any) => t.status === 'closed');

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Support Tickets</h2>
                    <p className="text-on-surface-variant text-sm">Manage user inquiries and reply directly to Discord channels.</p>
                </div>
            </div>

            {/* Deployment Configuration Section */}
            <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                        <span className="material-symbols-outlined text-primary text-2xl">rocket_launch</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Deploy Ticket Panel</h3>
                        <p className="text-xs text-on-surface-variant">Send an interactive "Open Ticket" button to a specific channel.</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <select
                        value={deployChannelId}
                        onChange={(e) => setDeployChannelId(e.target.value)}
                        className="flex-1 sm:w-64 bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-primary transition-colors cursor-pointer"
                    >
                        <option value="">Select Channel...</option>
                        {channels.map((ch: any) => (
                            <option key={ch.id} value={ch.id}># {ch.name}</option>
                        ))}
                    </select>
                    <div className="flex flex-col items-end gap-2 relative">
                        <button
                            onClick={() => deployMutation.mutate(deployChannelId)}
                            disabled={ticketIntelLocked || !deployChannelId || deployMutation.isPending}
                            className="btn-gradient text-on-primary-container px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-xl shadow-primary/20 flex items-center gap-2 hover:scale-[1.02] disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-lg">send</span>
                            {deployMutation.isPending ? "Deploying..." : "Deploy"}
                        </button>
                        <AnimatePresence>
                            {deployMutation.isSuccess && (
                                <motion.span
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="text-green-400 text-[10px] font-bold uppercase tracking-widest absolute -bottom-6"
                                >
                                    Panel Deployed!
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {ticketIntelLocked && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-between gap-3">
                    <span>Ticket intelligence features (SLA, summaries, suggested replies) are locked on Free plan.</span>
                    <button
                        onClick={() => guildId && openUpgradeCheckout(guildId, "business").catch((err) => toast.error(err?.message || "Checkout unavailable"))}
                        className="px-3 py-1.5 rounded-md bg-amber-400/20 text-amber-200 text-[11px] font-bold whitespace-nowrap"
                    >
                        Upgrade Plan
                    </button>
                </div>
            )}
            {premiumError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{premiumError}</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6 flex flex-col h-[600px]">
                    <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl flex-1 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-outline-variant/10 bg-surface-container-high/30">
                            <h3 className="font-bold text-white text-sm">Open Tickets ({openTickets.length})</h3>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-2">
                            {openTickets.map((ticket: any) => (
                                <button
                                    key={ticket.id}
                                    onClick={() => setSelectedTicket(ticket)}
                                    className={cn(
                                        "w-full text-left p-4 rounded-xl transition-colors border",
                                        selectedTicket?.id === ticket.id
                                            ? "bg-primary/10 border-primary font-bold text-primary"
                                            : "bg-surface-container-high border-outline-variant/5 text-white hover:bg-surface-container-highest"
                                    )}
                                >
                                    <div className="text-xs text-on-surface-variant mb-1">Ticket • {new Date(ticket.created_at).toLocaleDateString()}</div>
                                    <div className="text-sm">From {ticket.username}</div>
                                </button>
                            ))}
                            {openTickets.length === 0 && (
                                <div className="text-center p-8 text-on-surface-variant opacity-50 text-xs font-bold uppercase tracking-widest">
                                    No open tickets
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    {selectedTicket ? (
                        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl flex flex-col h-[600px] overflow-hidden">
                            <div className="p-4 border-b border-outline-variant/10 bg-surface-container-high/30 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-white text-sm">Replying to {selectedTicket.username}</h3>
                                    <div className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Channel ID: {selectedTicket.channel_thread_id}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={slaPriority}
                                        onChange={e => setSlaPriority(e.target.value)}
                                        className="bg-surface-container-highest border border-outline-variant/10 rounded-lg px-2 py-1 text-xs text-white"
                                    >
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                    <button
                                        onClick={() => slaMutation.mutate({ ticketId: selectedTicket.id, priority: slaPriority })}
                                        disabled={ticketIntelLocked}
                                        className="bg-primary/20 text-primary hover:bg-primary/30 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                                    >
                                        SLA
                                    </button>
                                    <button
                                        onClick={() => summaryMutation.mutate(selectedTicket.id)}
                                        disabled={ticketIntelLocked}
                                        className="bg-secondary/20 text-secondary hover:bg-secondary/30 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                                    >
                                        Summary
                                    </button>
                                    <button
                                        onClick={() => closeMutation.mutate(selectedTicket.id)}
                                        disabled={closeMutation.isPending}
                                        className="bg-error/10 text-error hover:bg-error/20 px-4 py-2 rounded-lg text-xs font-bold transition-colors uppercase tracking-widest"
                                    >
                                        {closeMutation.isPending ? "Closing..." : "Close Ticket"}
                                    </button>
                                </div>
                            </div>

                            {(() => {
                                const sla = slaRows.find((row: any) => row.ticket_id === selectedTicket.id);
                                return sla ? (
                                    <div className="px-4 py-3 bg-surface-container-high border-b border-outline-variant/10 text-xs text-on-surface-variant flex flex-wrap gap-4">
                                        <span>Priority: <strong className="text-white">{sla.priority}</strong></span>
                                        <span>First Response Due: <strong className="text-white">{sla.first_response_due_at ? new Date(sla.first_response_due_at).toLocaleString() : "n/a"}</strong></span>
                                        <span>Breach: <strong className={sla.breached ? "text-red-400" : "text-green-400"}>{sla.breached ? "Yes" : "No"}</strong></span>
                                        {sla.ticket_summaries?.summary && <span className="w-full text-white">Summary: {sla.ticket_summaries.summary}</span>}
                                        {sla.ticket_summaries?.suggested_reply && <span className="w-full text-primary">Suggested reply: {sla.ticket_summaries.suggested_reply}</span>}
                                    </div>
                                ) : null;
                            })()}

                            <div
                                ref={scrollRef}
                                className="flex-1 overflow-y-auto p-6 space-y-4 bg-surface-container-high/10 custom-scrollbar"
                            >
                                {messages.map((msg: any) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "flex flex-col max-w-[85%]",
                                            msg.is_mod ? "items-end ml-auto" : "items-start"
                                        )}
                                    >
                                        <div className={cn(
                                            "px-4 py-3 rounded-2xl text-sm break-words shadow-md",
                                            msg.is_mod
                                                ? "bg-primary-container text-white rounded-tr-none"
                                                : "bg-surface-container-highest text-white rounded-tl-none border border-outline-variant/10"
                                        )}>
                                            {msg.message}
                                        </div>
                                        <div className="text-[10px] text-on-surface-variant mt-1 px-1 font-bold">
                                            {msg.is_mod ? "Moderator" : msg.sender_name} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                ))}

                                {messages.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-center text-on-surface-variant opacity-50 space-y-2">
                                        <span className="material-symbols-outlined text-4xl">forum</span>
                                        <p className="text-xs font-bold tracking-widest uppercase">Start of conversation</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-surface-container-high/30 border-t border-outline-variant/10">
                                <div className="flex gap-4">
                                    <input
                                        type="text"
                                        value={replyMessage}
                                        onChange={e => setReplyMessage(e.target.value)}
                                        placeholder="Type a response..."
                                        className="flex-1 bg-surface-container-highest border border-outline-variant/10 rounded-xl px-4 text-sm text-white outline-none focus:border-primary transition-colors"
                                    />
                                    <button
                                        onClick={() => replyMutation.mutate({ threadId: selectedTicket.channel_thread_id, message: replyMessage })}
                                        disabled={!replyMessage.trim() || replyMutation.isPending}
                                        className="bg-primary text-on-primary font-bold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center p-0 w-12 h-12 shrink-0"
                                    >
                                        {replyMutation.isPending ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">send</span>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl h-[600px] flex flex-col items-center justify-center p-8 text-center text-on-surface-variant opacity-50">
                            <span className="material-symbols-outlined text-6xl mb-4">move_to_inbox</span>
                            <h3 className="text-lg font-bold text-white mb-2">Select a Ticket</h3>
                            <p className="text-sm">Click on a ticket from the left panel to reply to the user via Discord Threads.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
