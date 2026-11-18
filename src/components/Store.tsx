import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import {
    Plus,
    Trash2,
    ShoppingBag,
    Package,
    Coins,
    ShieldCheck
} from "lucide-react";
import { cn } from "../lib/utils";

export default function Store() {
    const { guildId } = useParams();
    const queryClient = useQueryClient();

    const [isAddingItem, setIsAddingItem] = useState(false);
    const [newItem, setNewItem] = useState({
        name: "",
        description: "",
        price: 100,
        role_id: "",
        icon: "📦",
        stock: -1
    });

    // Fetch Shop Items
    const { data: items = [], isLoading } = useQuery({
        queryKey: ['shop', guildId],
        queryFn: async () => {
            const res = await fetch(`/api/guilds/${guildId}/store`);
            if (!res.ok) return [];
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

    const createItemMutation = useMutation({
        mutationFn: async (item: any) => {
            const res = await fetch(`/api/guilds/${guildId}/store`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!res.ok) throw new Error("Failed to create item");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shop', guildId] });
            setIsAddingItem(false);
            setNewItem({ name: "", description: "", price: 100, role_id: "", icon: "📦", stock: -1 });
            toast.success("Shop item added!");
        }
    });

    const deleteItemMutation = useMutation({
        mutationFn: async (itemId: string) => {
            const res = await fetch(`/api/guilds/${guildId}/store/${itemId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error("Failed to delete item");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shop', guildId] });
            toast.success("Item removed from shop");
        }
    });

    // Fetch User Balance
    const { data: userEconomy } = useQuery({
        queryKey: ['userBalance', guildId, supabase.auth.getUser()],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { balance: 0 };
            const res = await fetch(`/api/guilds/${guildId}/economy/balance/${user.id}`);
            if (!res.ok) return { balance: 0 };
            return res.json();
        }
    });

    const buyItemMutation = useMutation({
        mutationFn: async (itemId: string) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");
            const res = await fetch(`/api/guilds/${guildId}/store/${itemId}/purchase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Purchase failed");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userBalance', guildId] });
            queryClient.invalidateQueries({ queryKey: ['shop', guildId] });
            toast.success("Purchase successful!");
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-4xl">shopping_bag</span>
                        Economy Store
                    </h2>
                    <p className="text-on-surface-variant font-medium mt-1">Manage items that users can buy with their earned coins.</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="px-6 py-3 bg-surface-container-high rounded-2xl border border-white/5 flex flex-col items-end shadow-xl">
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Your Balance</span>
                        <div className="flex items-center gap-2 text-primary">
                            <Coins size={16} />
                            <span className="font-black text-xl">{(userEconomy?.balance || 0).toLocaleString()}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsAddingItem(true)}
                        className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus size={18} /> Add New Item
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {items.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-surface-container-low rounded-3xl border border-dashed border-outline-variant/20">
                        <ShoppingBag className="mx-auto text-on-surface-variant opacity-20 mb-4" size={48} />
                        <p className="text-on-surface-variant font-bold uppercase tracking-widest text-xs">The store is currently empty</p>
                    </div>
                ) : (
                    items.map((item: any) => (
                        <div key={item.id} className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/10 hover:border-primary/30 transition-all flex flex-col group shadow-xl">
                            <div className="flex justify-between items-start mb-4">
                                <div className="text-4xl">{item.icon || '📦'}</div>
                                <button
                                    onClick={() => deleteItemMutation.mutate(item.id)}
                                    className="p-2 text-error bg-error/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-error hover:text-on-error"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <h3 className="text-xl font-black text-white tracking-tight mb-2">{item.name}</h3>
                            <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 mb-6 h-10">{item.description || "No description provided."}</p>

                            <div className="mt-auto space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-primary">
                                        <Coins size={16} />
                                        <span className="font-black text-lg">{item.price.toLocaleString()} Coins</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-on-surface-variant">
                                        <Package size={14} />
                                        {item.stock === -1 ? 'Infinite' : `${item.stock} left`}
                                    </div>
                                </div>

                                <button
                                    onClick={() => buyItemMutation.mutate(item.id)}
                                    disabled={buyItemMutation.isPending || (item.stock === 0) || (userEconomy?.balance || 0) < item.price}
                                    className={cn(
                                        "w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                                        (userEconomy?.balance || 0) >= item.price && item.stock !== 0
                                            ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-on-primary shadow-lg shadow-primary/10"
                                            : "bg-surface-container-high text-on-surface-variant border border-white/5 cursor-not-allowed"
                                    )}
                                >
                                    <ShoppingBag size={14} />
                                    {buyItemMutation.isPending ? "Processing..." : (item.stock === 0 ? "Out of Stock" : "Purchase Item")}
                                </button>

                                {item.role_id && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-high rounded-lg border border-white/5">
                                        <ShieldCheck size={12} className="text-[#d0bcff]" />
                                        <span className="text-[10px] font-bold text-white uppercase tracking-widest truncate">
                                            {roles.find((r: any) => r.id === item.role_id)?.name || "Unknown Role"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add Item Modal */}
            {isAddingItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-surface-container-low rounded-[32px] w-full max-w-lg border border-white/5 overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-[#1b1b1e]">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                                    <ShoppingBag className="text-primary" /> Add Shop Item
                                </h3>
                                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">Configure your product and rewards</p>
                            </div>
                            <button onClick={() => setIsAddingItem(false)} className="material-symbols-outlined text-on-surface-variant hover:text-white transition-colors">close</button>
                        </div>

                        <div className="p-8 space-y-6 bg-[#131316]">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-3">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Item Name</label>
                                    <input
                                        type="text"
                                        value={newItem.name}
                                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                        placeholder="Premium Member Role"
                                        className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-xl p-3 text-white font-bold focus:ring-2 focus:ring-primary/40 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Icon</label>
                                    <input
                                        type="text"
                                        value={newItem.icon}
                                        onChange={(e) => setNewItem({ ...newItem, icon: e.target.value })}
                                        placeholder="💎"
                                        className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-xl p-3 text-center text-xl outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Description</label>
                                <textarea
                                    value={newItem.description}
                                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                    placeholder="Short description of the item..."
                                    className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-primary/40 outline-none transition-all h-20"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
                                        <Coins size={12} /> Price (XP)
                                    </label>
                                    <input
                                        type="number"
                                        value={newItem.price}
                                        onChange={(e) => setNewItem({ ...newItem, price: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-xl p-3 text-white font-black outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
                                        <Package size={12} /> Stock (-1 = inf)
                                    </label>
                                    <input
                                        type="number"
                                        value={newItem.stock}
                                        onChange={(e) => setNewItem({ ...newItem, stock: parseInt(e.target.value) || -1 })}
                                        className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-xl p-3 text-white font-black outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
                                    <ShieldCheck size={12} /> Role Reward (Optional)
                                </label>
                                <select
                                    value={newItem.role_id}
                                    onChange={(e) => setNewItem({ ...newItem, role_id: e.target.value })}
                                    className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-xl p-3 text-white font-bold outline-none appearance-none"
                                >
                                    <option value="">No Role Reward</option>
                                    {roles.map((r: any) => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="p-8 border-t border-white/5 bg-[#1b1b1e] flex justify-end gap-4">
                            <button
                                onClick={() => setIsAddingItem(false)}
                                className="px-6 py-3 rounded-xl font-bold text-white bg-surface-container-highest hover:bg-white/10 transition-all uppercase tracking-widest text-[10px]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => createItemMutation.mutate(newItem)}
                                disabled={!newItem.name || createItemMutation.isPending}
                                className="px-8 py-3 bg-primary text-on-primary rounded-xl font-black uppercase tracking-[0.2em] text-[10px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                            >
                                {createItemMutation.isPending ? "Adding..." : "Add to Shop"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
