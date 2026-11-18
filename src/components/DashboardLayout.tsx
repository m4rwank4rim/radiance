import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useParams, useNavigate } from "react-router-dom";
import { LogOut, Menu, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export default function DashboardLayout() {
  const { guildId } = useParams();
  const navigate = useNavigate();

  const { data: guild } = useQuery({
    queryKey: ['guild', guildId],
    queryFn: async () => {
      const { data: { session } } = await supabase!.auth.getSession();
      const providerToken = session?.provider_token || localStorage.getItem('discord_provider_token');
      const res = await fetch("/api/guilds", {
        headers: { Authorization: `Bearer ${providerToken}` }
      });
      const guilds = await res.json();
      return guilds.find((g: any) => g.id === guildId) || null;
    },
    enabled: !!guildId
  });

  const { data: branding } = useQuery({
    queryKey: ['brandingTheme', guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/branding`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!guildId
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      if (!supabase) return { user_metadata: { full_name: "Developer Admin", avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" } };
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user || null;
    },
    staleTime: Infinity
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

const NAV_ITEMS: { icon: string; label: string; path: string }[] = [
    { icon: "dashboard", label: "Overview", path: "/dashboard/" + guildId },
    { icon: "analytics", label: "Analytics Hub", path: "/dashboard/" + guildId + "/analytics" },
    { icon: "emoji_events", label: "Leaderboard", path: "/dashboard/" + guildId + "/leaderboard" },
    { icon: "security", label: "Moderation", path: "/dashboard/" + guildId + "/moderation" },
    { icon: "gpp_good", label: "Advanced Security", path: "/dashboard/" + guildId + "/security" },
    { icon: "support_agent", label: "Tickets", path: "/dashboard/" + guildId + "/tickets" },
    { icon: "list_alt", label: "Logging", path: "/dashboard/" + guildId + "/logging" },
    { icon: "shopping_bag", label: "Economy Store", path: "/dashboard/" + guildId + "/store" },
    { icon: "psychology", label: "AI Support", path: "/dashboard/" + guildId + "/ai" },
    { icon: "architecture", label: "AI Architect", path: "/dashboard/" + guildId + "/architect" },
    { icon: "view_quilt", label: "Embeds & Panels", path: "/dashboard/" + guildId + "/embeds" },
    { icon: "waving_hand", label: "Welcome", path: "/dashboard/" + guildId + "/welcome" },
    { icon: "mic", label: "Dynamic Voice", path: "/dashboard/" + guildId + "/voice" },
    { icon: "military_tech", label: "Leveling", path: "/dashboard/" + guildId + "/levels" },
    { icon: "terminal", label: "Custom Commands", path: "/dashboard/" + guildId + "/commands" },
    { icon: "lock_person", label: "Command Permissions", path: "/dashboard/" + guildId + "/permissions" },
    { icon: "payments", label: "Billing", path: "/dashboard/" + guildId + "/billing" },
    { icon: "history", label: "Restore Audit", path: "/dashboard/" + guildId + "/restore-audit" },
    { icon: "settings", label: "Settings", path: "/dashboard/" + guildId + "/settings" },
  ];

  const filteredItems = NAV_ITEMS.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (branding?.brand_name) {
      document.title = `${branding.brand_name} - ${location.pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}`;
    }
  }, [branding, location]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsMobile(true);
        setSidebarOpen(false);
      } else {
        setIsMobile(false);
        setSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      localStorage.removeItem('discord_provider_token');
    }
    navigate("/");
  };

  return (
    <div
      className="flex min-h-screen bg-void text-zinc-100 selection:bg-primary selection:text-white overflow-hidden font-sans"
      style={{
        ['--brand-primary' as any]: branding?.primary_color || '#8B5CF6',
        ['--brand-accent' as any]: branding?.accent_color || '#f472b6'
      }}
    >
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-start justify-center pt-[15vh] px-4"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -20 }}
              className="w-full max-w-2xl glass-card rounded-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/5 flex items-center gap-4 bg-surface-container-low/50">
                <span className="material-symbols-outlined text-primary text-2xl">search</span>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search modules, settings, or tools..."
                  className="bg-transparent border-none outline-none text-xl text-white w-full font-medium placeholder:text-zinc-500"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <div className="px-2 py-1 rounded-lg bg-surface-container-highest border border-white/10 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  ESC
                </div>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
                {filteredItems.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {filteredItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center justify-between p-4 rounded-xl hover:bg-primary/10 transition-all group border border-transparent hover:border-primary/20"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-zinc-400 group-hover:text-primary transition-colors">
                            <span className="material-symbols-outlined">{item.icon}</span>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white group-hover:text-primary transition-colors">{item.label}</div>
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Module</div>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-zinc-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">arrow_forward</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center">
                    <span className="material-symbols-outlined text-4xl text-zinc-600 mb-4">search_off</span>
                    <p className="text-zinc-400 font-bold">No results found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-void border-t border-white/5 flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">keyboard_arrow_up</span><span className="material-symbols-outlined text-sm">keyboard_arrow_down</span> Navigate</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">keyboard_return</span> Select</span>
                </div>
                <div>Radiance Search</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{
          width: sidebarOpen ? 280 : 0,
          opacity: sidebarOpen ? 1 : 0,
          x: 0
        }}
        className={cn(
          "fixed lg:sticky top-0 h-screen z-50 flex flex-col py-6 px-4 glass-card rounded-r-2xl m-3 shadow-floating transition-all duration-300 overflow-hidden",
          isMobile ? (sidebarOpen ? "translate-x-0" : "-translate-x-full") : ""
        )}
        style={{ marginBottom: 0 }}
      >
        <div className="flex items-center gap-3 mb-8 px-3">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt="Logo" className="w-10 h-10 rounded-xl object-cover shadow-neon" />
          ) : (
            <div className="w-10 h-10 rounded-xl primary-gradient flex items-center justify-center shadow-neon">
              <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            </div>
          )}
          <div>
            <h1 className="text-lg font-black text-white leading-none tracking-tight">{branding?.brand_name || "Radiance"}</h1>
            <p className="uppercase tracking-widest text-[9px] text-zinc-500 mt-0.5 font-semibold">Premium Suite</p>
          </div>
        </div>

        <button 
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-3 px-4 py-3 mb-6 bg-surface-container rounded-xl border border-white/5 transition-all group hover:bg-surface-container-high hover:border-primary/20"
        >
          <span className="material-symbols-outlined text-zinc-500 group-hover:text-primary transition-colors">search</span>
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest flex-1 text-left">Quick Search</span>
          <div className="px-2 py-0.5 rounded-lg bg-surface-container-highest border border-white/5 text-[8px] font-bold text-zinc-500">
            ⌘K
          </div>
        </button>

        <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-2 mb-4">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path === `/dashboard/${guildId}` && location.pathname === `/dashboard/${guildId}/`) ||
              (item.path === `/dashboard/${guildId}/embeds` && location.pathname === `/dashboard/${guildId}/role-panels`);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => isMobile && setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 text-[10px] font-semibold uppercase tracking-widest",
                  isActive
                    ? "bg-gradient-to-r from-primary/20 to-transparent text-white shadow-[inset_0_0_20px_rgba(139,92,246,0.1)] border-l-2 border-primary"
                    : "text-zinc-400 hover:text-white hover:bg-surface-container rounded-lg"
                )}
                style={isActive ? { textShadow: '0 0 20px rgba(139,92,246,0.5)' } : undefined}
              >
                <span className={cn("material-symbols-outlined", isActive && "fill-1 text-primary")}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4">
          <div className="p-4 rounded-xl bg-surface-container border border-white/5">
            <div className="flex items-center gap-3 mb-3">
              {guild?.icon ? (
                <img src={guild.icon} alt="Server" className="w-9 h-9 rounded-lg" />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-surface-container-highest flex items-center justify-center font-bold text-sm text-primary">
                  {guild?.name?.charAt(0) || "?"}
                </div>
              )}
              <div className="text-left overflow-hidden">
                <div className="text-[10px] font-bold text-white truncate">{guild?.name || "Loading..."}</div>
                <div className="text-[8px] uppercase tracking-widest text-zinc-500 font-semibold">Current Server</div>
              </div>
            </div>
            <Link to="/servers" className="w-full py-2.5 primary-gradient rounded-xl text-white text-[10px] font-bold uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-neon">
              <span className="material-symbols-outlined text-sm">swap_horiz</span>
              Switch Server
            </Link>
          </div>

          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2 w-full text-zinc-500 hover:text-red-400 transition-colors text-xs font-semibold uppercase tracking-widest hover:bg-red-500/10 rounded-lg">
            <span className="material-symbols-outlined text-sm">logout</span>
            Logout
          </button>
        </div>
      </motion.aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden lg:ml-3">
        {isMobile && (
          <header className={cn(
            "h-16 flex items-center justify-between px-6 shrink-0 z-30 lg:hidden transition-all duration-300",
            scrolled ? "glass shadow-depth-1" : "bg-transparent"
          )}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl hover:bg-surface-container transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5 text-zinc-300" /> : <Menu className="w-5 h-5 text-zinc-300" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-neon">
                <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
              </div>
              <span className="font-bold text-sm text-white tracking-tight">{branding?.brand_name?.toUpperCase() || "RADIANCE"}</span>
            </div>
            <div className="w-9 h-9" />
          </header>
        )}

        <div className="flex-1 overflow-y-auto p-6 lg:p-8 relative">
          <div className="max-w-7xl mx-auto relative">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}