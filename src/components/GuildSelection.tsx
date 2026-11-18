import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Plus } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { cn } from "../lib/utils";

export default function GuildSelection() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [providerToken, setProviderToken] = useState<string | null>(null);
  const [pendingGuildId, setPendingGuildId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Read directly from Vite-injected env — no API call needed
  const discordClientId = process.env.DISCORD_CLIENT_ID || null;

  useEffect(() => {
    const checkUser = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setUser({ user_metadata: { full_name: "Developer Admin", avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" } });
        return;
      }

      // Try to get session immediately
      let { data: { session } } = await supabase.auth.getSession();

      // If no session, wait a brief moment for storage sync (common with OAuth popups)
      if (!session) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        session = retrySession;
      }

      if (!session) {
        console.log("No session found in GuildSelection, redirecting to login");
        navigate("/login");
        return;
      }

      setUser(session.user);
      setProviderToken(session.provider_token || localStorage.getItem('discord_provider_token') || null);
    };

    checkUser();
  }, [navigate]);

  const { data: guilds = [], isLoading, error: queryError, refetch: refetchGuilds } = useQuery({
    queryKey: ['guilds', providerToken],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (providerToken) {
        headers['Authorization'] = `Bearer ${providerToken}`;
      }

      const res = await fetch("/api/guilds", { headers });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.details || errData?.error || "Failed to fetch guilds");
      }
      return res.json();
    },
    enabled: !!user,
    retry: false
  });

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      localStorage.removeItem('discord_provider_token');
    }
    navigate("/");
  };

  const handleInviteBot = (guildId?: string) => {
    if (discordClientId) {
      let inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&permissions=8&scope=bot%20applications.commands`;
      if (guildId) {
        inviteUrl += `&guild_id=${guildId}&disable_guild_select=true`;
      }
      const popup = window.open(inviteUrl, "_blank");
      if (popup) {
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            if (guildId) setPendingGuildId(guildId);
            // Wait 7s for: Discord guildCreate event → Supabase upsert → cache update
            setTimeout(() => {
              refetchGuilds();
              setPendingGuildId(null);
            }, 7000);
          }
        }, 500);
      } else {
        // Fallback: If popup blocker prevents opening, redirect the current window
        window.location.href = inviteUrl;
      }
    } else {
      console.warn("Discord Client ID not loaded yet");
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/guilds/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncResult(`Successfully synced ${data.synced} servers!`);
        refetchGuilds();
      } else {
        setSyncResult(`Sync failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setSyncResult(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  };


  if (isLoading && !guilds.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131316] text-on-surface font-sans selection:bg-primary/30 relative overflow-hidden">
      {/* Glow Background Decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[60%] bg-[radial-gradient(circle_at_50%_-20%,rgba(208,188,255,0.15)_0%,rgba(19,19,22,0)_60%)] pointer-events-none" />
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-primary-container/5 blur-[100px] rounded-full pointer-events-none"></div>

      {/* TopAppBar Navigation Shell */}
      <nav className="fixed top-0 w-full z-50 bg-[#131316]/80 backdrop-blur-xl flex justify-between items-center px-8 h-16 shadow-[0_32px_64px_rgba(139,92,246,0.06)]">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-xl font-bold tracking-tighter text-white">Radiance Suite</Link>
        </div>

        {/* Navigation Links - Hidden on Mobile, Shown on Desktop */}
        <div className="hidden md:flex items-center space-x-8 font-inter tracking-tight">
          <a className="text-[#cbc3d7] hover:text-white transition-colors text-sm font-medium" href="#">Dashboard</a>
          <a className="text-[#cbc3d7] hover:text-white transition-colors text-sm font-medium" href="#">Analytics</a>
          <a className="text-[#cbc3d7] hover:text-white transition-colors text-sm font-medium" href="#">Settings</a>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-4">
            <button className="material-symbols-outlined text-[#cbc3d7] hover:bg-[#353438]/50 p-2 rounded-lg transition-all duration-300">notifications</button>
            <button className="material-symbols-outlined text-[#cbc3d7] hover:bg-[#353438]/50 p-2 rounded-lg transition-all duration-300">help_outline</button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container border-2 border-primary/20 shadow-lg shadow-purple-500/10">
              <img
                src={user?.user_metadata?.avatar_url || "https://picsum.photos/seed/user/100/100"}
                alt="User"
                className="w-full h-full object-cover"
              />
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-[#1f1f22] text-[#cbc3d7] hover:text-error transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Canvas */}
      <main className="pt-32 pb-20 px-4 relative z-10 min-h-screen">
        <div className="max-w-2xl mx-auto">
          {/* Header Section */}
          <header className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
              Select a Server
            </h1>
            <p className="text-[#cbc3d7] max-w-md mx-auto text-lg font-light tracking-wide leading-relaxed opacity-80">
              Choose an ecosystem to manage your premium bot configurations and tools.
            </p>
          </header>

          {queryError && (
            <div className="mb-12 p-6 rounded-2xl bg-error/5 border border-error/20 text-error text-center">
              <p className="font-bold mb-2">Discord Sync Error</p>
              <p className="text-sm opacity-80">{queryError.message}</p>
              <button
                onClick={handleLogout}
                className="mt-6 px-6 py-2.5 bg-error/10 hover:bg-error/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Reconnect Discord
              </button>
            </div>
          )}

          {/* Server List Bento/Column */}
          <div className="space-y-4">
            {guilds.map((guild: any, i: number) => (
              <motion.div
                key={guild.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div
                  onClick={() => guild.active ? navigate(`/dashboard/${guild.id}`) : handleInviteBot(guild.id)}
                  className={cn(
                    "group relative bg-[#1b1b1e] hover:bg-[#1f1f22] transition-all duration-300 rounded-xl p-5 flex items-center justify-between cursor-pointer border-white/5 border hover:shadow-2xl hover:shadow-purple-500/5 hover:-translate-y-0.5",
                    !guild.active && "opacity-80 hover:opacity-100"
                  )}
                >
                  <div className="flex items-center space-x-5">
                    {guild.icon ? (
                      <img
                        src={guild.icon}
                        alt={guild.name}
                        className={cn(
                          "w-14 h-14 rounded-full object-cover shadow-lg",
                          guild.active ? "border-0 shadow-primary/20" : "border border-white/10"
                        )}
                      />
                    ) : (
                      <div className={cn(
                        "w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shadow-lg",
                        guild.active
                          ? "primary-gradient text-on-primary shadow-primary/20"
                          : "bg-[#353438] text-primary border border-primary/20"
                      )}>
                        {guild.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-white tracking-tight">{guild.name}</h3>
                      <div className="flex items-center mt-1 gap-2">
                        {guild.active ? (
                          <span className="text-[10px] font-bold tracking-[0.1em] text-primary uppercase">Radiance Active</span>
                        ) : pendingGuildId === guild.id ? (
                          <span className="text-[10px] font-bold tracking-[0.1em] text-yellow-400 uppercase flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                            Syncing...
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold tracking-[0.1em] text-[#cbc3d7] uppercase">Setup Required</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={cn("flex items-center", guild.active ? "text-primary" : "text-[#cbc3d7]")}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: guild.active ? "'FILL' 1" : "" }}>
                      {guild.active ? "check_circle" : "chevron_right"}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}

            {guilds.length === 0 && !isLoading && (
              <div className="text-center py-20 bg-[#1b1b1e]/40 border border-dashed border-white/10 rounded-xl">
                <span className="material-symbols-outlined text-5xl text-[#cbc3d7] mb-4 opacity-20">search_off</span>
                <p className="text-[#cbc3d7] font-bold uppercase tracking-widest text-xs">No Manageable Servers Found</p>
              </div>
            )}
          </div>

          {/* Footer Action */}
          <footer className="mt-12 text-center space-y-4">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
              <button
                onClick={() => refetchGuilds()}
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl bg-[#1f1f22] border border-white/10 text-[#cbc3d7] hover:text-white text-sm font-semibold hover:bg-[#28282c] transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-base ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
                {isLoading ? 'Checking...' : 'Refresh Server List'}
              </button>

              <button
                onClick={handleForceSync}
                disabled={isSyncing}
                className="px-5 py-2.5 rounded-xl bg-[#6366f1]/20 border border-[#6366f1]/40 text-[#a5b4fc] hover:text-white text-sm font-semibold hover:bg-[#6366f1]/30 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-base ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                {isSyncing ? 'Syncing...' : 'Force Sync Bot'}
              </button>
            </div>

            {syncResult && (
              <p className="text-xs text-primary animate-pulse font-medium">{syncResult}</p>
            )}

            {pendingGuildId && (
              <p className="text-xs text-yellow-400/70 mt-2">Bot is syncing — this takes up to 7 seconds after joining.</p>
            )}
            
            <div className="pt-2">
              <div className="inline-flex items-center text-[#cbc3d7] space-x-1.5 group">
                <span className="text-sm">Don't see your server?</span>
                <button
                  onClick={() => handleInviteBot()}
                  className="text-primary text-sm font-bold hover:text-white transition-colors flex items-center underline underline-offset-4 decoration-primary/30 hover:decoration-primary"
                >
                  Add to New Server
                  <span className="material-symbols-outlined text-sm ml-1 group-hover:translate-x-0.5 transition-transform">add_circle</span>
                </button>
              </div>
            </div>
          </footer>
        </div>
      </main>

      {/* Mobile Shell Reference (Contextual FAB / Mobile Shell) */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-[#1b1b1e]/90 backdrop-blur-2xl px-6 py-4 flex justify-around items-center z-50 border-t border-white/5">
        <button className="flex flex-col items-center text-[#d0bcff]">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>dns</span>
          <span className="text-[10px] uppercase tracking-widest mt-1 font-bold">Servers</span>
        </button>
        <button className="flex flex-col items-center text-[#cbc3d7]">
          <span className="material-symbols-outlined">layers</span>
          <span className="text-[10px] uppercase tracking-widest mt-1 font-bold">Templates</span>
        </button>
        <button className="flex flex-col items-center text-[#cbc3d7]">
          <span className="material-symbols-outlined">extension</span>
          <span className="text-[10px] uppercase tracking-widest mt-1 font-bold">Plugins</span>
        </button>
        <button className="flex flex-col items-center text-[#cbc3d7]">
          <span className="material-symbols-outlined">payments</span>
          <span className="text-[10px] uppercase tracking-widest mt-1 font-bold">Billing</span>
        </button>
      </div>
    </div>
  );
}
