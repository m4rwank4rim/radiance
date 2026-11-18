import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

const COMMAND_CATEGORIES = [
  {
    name: "General",
    icon: "grid_view",
    commands: ["rank", "profile", "top", "stats", "ping", "emojis"]
  },
  {
    name: "Moderation",
    icon: "shield",
    commands: ["ban", "kick", "timeout", "untimeout", "purge", "warn", "warnings", "clear-warnings"]
  },
  {
    name: "Administration",
    icon: "settings",
    commands: ["diagnose", "slowmode", "raidmode", "appeal"]
  }
];

interface PermissionRecord {
  command_name: string;
  allowed_roles: string[];
  admin_only: boolean;
}

interface CommandSettings {
  allowed_roles: string[];
  admin_only: boolean;
}

export default function CommandPermissions() {
  const { guildId } = useParams();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("General");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/roles`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!guildId
  });

  const { data: permissions = [] } = useQuery<PermissionRecord[]>({
    queryKey: ['commandPermissions', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/command-permissions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!guildId
  });

  const mutation = useMutation({
    mutationFn: async (permissions: PermissionRecord[]) => {
      const res = await fetch(`/api/guilds/${guildId}/command-permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions })
      });
      if (!res.ok) throw new Error("Failed to save permissions");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandPermissions', guildId] });
      toast.success("Permissions updated successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update permissions");
    }
  });

  const [localPermissions, setLocalPermissions] = useState<Record<string, CommandSettings>>({});

  useEffect(() => {
    if (permissions) {
      const initial: Record<string, CommandSettings> = {};
      permissions.forEach((p) => {
        initial[p.command_name] = { 
          allowed_roles: Array.isArray(p.allowed_roles) ? p.allowed_roles : [], 
          admin_only: !!p.admin_only 
        };
      });
      setLocalPermissions(initial);
    }
  }, [permissions]);

  const handleUpdateLocal = (cmd: string, field: keyof CommandSettings, val: any) => {
    setLocalPermissions(prev => ({
      ...prev,
      [cmd]: {
        ...(prev[cmd] || { allowed_roles: [], admin_only: false }),
        [field]: val
      }
    }));
  };

  const toggleRole = (cmd: string, roleId: string) => {
    const currentRoles = localPermissions[cmd]?.allowed_roles || [];
    const newRoles = currentRoles.includes(roleId)
      ? currentRoles.filter(id => id !== roleId)
      : [...currentRoles, roleId];
    handleUpdateLocal(cmd, 'allowed_roles', newRoles);
  };

  const handleSaveAll = () => {
    const payload = Object.entries(localPermissions).map(([command_name, settings]: [string, CommandSettings]) => ({
      command_name,
      allowed_roles: settings.allowed_roles,
      admin_only: settings.admin_only
    }));
    mutation.mutate(payload);
  };

  const currentCategory = COMMAND_CATEGORIES.find(c => c.name === activeCategory);
  const filteredCommands = currentCategory?.commands.filter(cmd => 
    cmd.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-4xl">lock_person</span>
            Command Control
          </h2>
          <p className="text-on-surface-variant font-medium mt-1">Fine-tune who can access specific bot commands.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group hidden md:block">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm group-focus-within:text-primary transition-colors">search</span>
            <input 
              type="text" 
              placeholder="Quick search commands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-4 py-3 bg-surface-container-low border border-white/5 rounded-2xl text-sm text-white outline-none focus:border-primary/50 transition-all w-64 shadow-xl shadow-black/20"
            />
          </div>
          <button
            onClick={handleSaveAll}
            disabled={mutation.isPending}
            className="px-8 py-3 bg-primary text-on-primary rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            {mutation.isPending ? "Syncing..." : "Apply Changes"}
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 bg-surface-container-lowest p-1.5 rounded-[1.5rem] border border-white/5 w-fit">
        {COMMAND_CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(cat.name)}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2.5",
              activeCategory === cat.name 
                ? "bg-primary text-on-primary shadow-lg shadow-primary/20" 
                : "text-on-surface-variant hover:text-white hover:bg-white/5"
            )}
          >
            <span className="material-symbols-outlined text-sm">{cat.icon}</span>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {filteredCommands.map((cmd) => (
              <div 
                key={cmd} 
                className="bg-surface-container-low rounded-[2.5rem] p-8 border border-white/5 shadow-2xl relative overflow-hidden group hover:border-primary/20 transition-all"
              >
                <div className="flex flex-col gap-6 relative z-10">
                  {/* Command Title & Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <span className="material-symbols-outlined text-xl">terminal</span>
                      </div>
                      <h3 className="text-xl font-black text-white tracking-tight">/{cmd}</h3>
                    </div>
                    
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">Admin Only</span>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={localPermissions[cmd]?.admin_only || false}
                          onChange={(e) => handleUpdateLocal(cmd, 'admin_only', e.target.checked)}
                          className="sr-only"
                        />
                        <div className={cn(
                          "w-12 h-6 rounded-full transition-colors border border-white/10",
                          localPermissions[cmd]?.admin_only ? "bg-primary" : "bg-surface-container-highest"
                        )}></div>
                        <div className={cn(
                          "absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform",
                          localPermissions[cmd]?.admin_only ? "translate-x-6" : "translate-x-0"
                        )}></div>
                      </div>
                    </label>
                  </div>

                  {/* Role Selector */}
                  <div className={cn(
                    "space-y-4 transition-opacity duration-300",
                    localPermissions[cmd]?.admin_only ? "opacity-30 pointer-events-none" : "opacity-100"
                  )}>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Allowed Roles</p>
                      <span className="text-[10px] font-bold text-primary/60">{localPermissions[cmd]?.allowed_roles.length || 0} Selected</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                      {roles.map((role: any) => {
                        const isSelected = localPermissions[cmd]?.allowed_roles.includes(role.id);
                        return (
                          <button
                            key={role.id}
                            onClick={() => toggleRole(cmd, role.id)}
                            className={cn(
                              "px-4 py-2 rounded-xl text-[10px] font-bold transition-all border",
                              isSelected 
                                ? "bg-primary/20 text-primary border-primary/30" 
                                : "bg-surface-container-high text-on-surface-variant border-white/5 hover:border-white/10"
                            )}
                            style={{ 
                              color: isSelected ? undefined : (role.color !== '#000000' ? role.color : undefined),
                              borderColor: isSelected ? undefined : (role.color !== '#000000' ? `${role.color}20` : undefined)
                            }}
                          >
                            {role.name}
                          </button>
                        );
                      })}
                      {roles.length === 0 && (
                        <div className="w-full py-4 text-center border border-dashed border-white/5 rounded-2xl">
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">No roles found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Decorative background element */}
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all"></div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredCommands.length === 0 && (
        <div className="py-20 text-center glass-card rounded-[3rem] border border-white/5">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4">search_off</span>
          <h3 className="text-xl font-black text-white mb-2">No commands found</h3>
          <p className="text-on-surface-variant font-medium">Try adjusting your search query or switching categories.</p>
        </div>
      )}
    </div>
  );
}
