import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

const AVAILABLE_COMMANDS = [
  { name: "General", commands: ["rank", "profile", "top", "stats", "ping", "emojis"] },
  { name: "Moderation", commands: ["ban", "kick", "timeout", "untimeout", "purge", "slowmode", "warn", "warnings", "clear-warnings"] },
  { name: "Admin", commands: ["diagnose", "raidmode", "appeal"] }
];

export default function CustomCommands() {
  const { guildId } = useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'aliases' | 'custom'>('aliases');
  const [isAdding, setIsAdding] = useState(false);
  const [newCmd, setNewCmd] = useState({ trigger: "", response: "", category: "General", cooldown: 5 });

  // --- Mappings (Aliases) Logic ---
  const { data: mappings = [] } = useQuery({
    queryKey: ['commandMappings', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/command-mappings`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!guildId
  });

  const mappingMutation = useMutation({
    mutationFn: async (mappings: { original_command: string, new_command: string }[]) => {
      const res = await fetch(`/api/guilds/${guildId}/command-mappings/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      if (!res.ok) throw new Error("Failed to save mappings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandMappings', guildId] });
      toast.success("Command aliases updated!");
    }
  });

  const [localMappings, setLocalMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mappings.length > 0) {
      const initial: Record<string, string> = {};
      mappings.forEach((m: any) => initial[m.original_command] = m.new_command);
      setLocalMappings(initial);
    }
  }, [mappings]);

  const handleUpdateLocal = (cmd: string, val: string) => {
    setLocalMappings(prev => ({ ...prev, [cmd]: val.toLowerCase().replace(/\s/g, '') }));
  };

  const handleSaveMappings = () => {
    const payload = Object.entries(localMappings).map(([original_command, new_command]) => ({
      original_command,
      new_command: new_command as string
    }));
    mappingMutation.mutate(payload);
  };

  // --- Custom Commands Logic ---
  const { data: customCommands = [] } = useQuery({
    queryKey: ['customCommands', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/commands`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!guildId
  });

  const createCmdMutation = useMutation({
    mutationFn: async (cmd: any) => {
      const res = await fetch(`/api/guilds/${guildId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd)
      });
      if (!res.ok) throw new Error("Failed to create command");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customCommands', guildId] });
      toast.success("Custom command created!");
      setIsAdding(false);
      setNewCmd({ trigger: "", response: "", category: "General", cooldown: 5 });
    }
  });

  const deleteCmdMutation = useMutation({
    mutationFn: async (cmdId: string) => {
      const res = await fetch(`/api/guilds/${guildId}/commands/${cmdId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Failed to delete command");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customCommands', guildId] });
      toast.success("Command deleted");
    }
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-4xl">terminal</span>
            Command Hub
          </h2>
          <p className="text-on-surface-variant font-medium mt-1">Personalize command aliases and create custom bot responses.</p>
        </div>
        
        {activeTab === 'aliases' && (
          <button
            onClick={handleSaveMappings}
            disabled={mappingMutation.isPending}
            className="px-8 py-3 bg-primary text-on-primary rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            {mappingMutation.isPending ? "Syncing..." : "Apply Aliases"}
          </button>
        )}

        {activeTab === 'custom' && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-8 py-3 bg-primary text-on-primary rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Create New
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-surface-container-lowest p-1.5 rounded-[1.5rem] border border-white/5 w-fit">
        <button
          onClick={() => setActiveTab('aliases')}
          className={cn(
            "px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all",
            activeTab === 'aliases' 
              ? "bg-primary text-on-primary shadow-lg shadow-primary/20" 
              : "text-on-surface-variant hover:text-white hover:bg-white/5"
          )}
        >
          Command Aliases
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={cn(
            "px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all",
            activeTab === 'custom' 
              ? "bg-primary text-on-primary shadow-lg shadow-primary/20" 
              : "text-on-surface-variant hover:text-white hover:bg-white/5"
          )}
        >
          Custom Responses
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'aliases' ? (
          <motion.div
            key="aliases"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {AVAILABLE_COMMANDS.map((cat) => (
              <div key={cat.name} className="space-y-4">
                <div className="flex items-center gap-4 px-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest opacity-50">{cat.name} Commands</h3>
                  <div className="h-px flex-1 bg-white/5"></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {cat.commands.map((cmd) => (
                    <div 
                      key={cmd} 
                      className="bg-surface-container-low rounded-[2rem] p-6 border border-white/5 group hover:border-primary/20 transition-all flex flex-col gap-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-sm">terminal</span>
                          </div>
                          <span className="text-sm font-bold text-white tracking-tight">/{cmd}</span>
                        </div>
                        <button 
                          onClick={() => handleUpdateLocal(cmd, cmd)}
                          className="text-[10px] font-black text-on-surface-variant hover:text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all"
                        >
                          Reset
                        </button>
                      </div>

                      <div className="relative group/input">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-mono font-bold text-sm">/</span>
                        <input
                          type="text"
                          value={localMappings[cmd] || cmd}
                          onChange={(e) => handleUpdateLocal(cmd, e.target.value)}
                          className="w-full bg-surface-container-high border border-white/5 rounded-xl pl-8 pr-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all font-mono font-bold"
                          placeholder={cmd}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="custom"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {isAdding && (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-primary/5 border border-primary/20 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden"
              >
                <div className="flex justify-between items-center relative z-10">
                  <h3 className="text-xl font-black text-white tracking-tight">New Custom Command</h3>
                  <button onClick={() => setIsAdding(false)} className="text-on-surface-variant hover:text-white">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-2">Trigger Keyword</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold">!</span>
                      <input 
                        type="text" 
                        placeholder="e.g. rules"
                        className="w-full bg-surface-container-low border border-white/5 rounded-2xl pl-8 pr-4 py-4 text-sm text-white outline-none focus:border-primary/50 transition-all"
                        value={newCmd.trigger}
                        onChange={e => setNewCmd({...newCmd, trigger: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-2">Category</label>
                    <select 
                      className="w-full bg-surface-container-low border border-white/5 rounded-2xl px-4 py-4 text-sm text-white outline-none focus:border-primary/50 transition-all appearance-none"
                      value={newCmd.category}
                      onChange={e => setNewCmd({...newCmd, category: e.target.value})}
                    >
                      <option>General</option>
                      <option>Information</option>
                      <option>Fun</option>
                      <option>Utility</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-2">Bot Response</label>
                    <textarea 
                      placeholder="What should the bot say?"
                      rows={3}
                      className="w-full bg-surface-container-low border border-white/5 rounded-2xl px-4 py-4 text-sm text-white outline-none focus:border-primary/50 transition-all resize-none"
                      value={newCmd.response}
                      onChange={e => setNewCmd({...newCmd, response: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 relative z-10">
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => createCmdMutation.mutate(newCmd)}
                    disabled={!newCmd.trigger || !newCmd.response || createCmdMutation.isPending}
                    className="px-8 py-3 bg-primary text-on-primary rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    {createCmdMutation.isPending ? "Creating..." : "Create Command"}
                  </button>
                </div>
                
                <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
              </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {customCommands.map((cmd: any) => (
                <div 
                  key={cmd.id} 
                  className="bg-surface-container-low rounded-[2rem] p-6 border border-white/5 group hover:border-primary/20 transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <span className="material-symbols-outlined text-lg">chat_bubble</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-white tracking-tight">!{cmd.trigger}</h4>
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary opacity-60">{cmd.category}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteCmdMutation.mutate(cmd.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                  
                  <div className="bg-surface-container-highest/30 rounded-xl p-4 border border-white/5">
                    <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 italic">"{cmd.response}"</p>
                  </div>
                </div>
              ))}
              
              {customCommands.length === 0 && !isAdding && (
                <div className="lg:col-span-2 py-20 text-center glass-card rounded-[3rem] border border-white/5">
                  <span className="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4">chat_add_on</span>
                  <h3 className="text-xl font-black text-white mb-2">No custom commands yet</h3>
                  <p className="text-on-surface-variant font-medium mb-6">Create your first custom trigger-response command!</p>
                  <button
                    onClick={() => setIsAdding(true)}
                    className="px-8 py-3 bg-surface-container-highest text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-all"
                  >
                    Get Started
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
