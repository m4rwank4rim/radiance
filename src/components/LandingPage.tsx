import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useQuery } from "@tanstack/react-query";

export default function LandingPage() {
  const [session, setSession] = useState<any>(null);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const { data: stats } = useQuery({
    queryKey: ['globalStats'],
    queryFn: async () => {
      const res = await fetch('/api/global-stats');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    }
  });

  const { data: billingPlansData } = useQuery({
    queryKey: ["publicBillingPlans"],
    queryFn: async () => {
      const res = await fetch("/api/billing/plans");
      if (!res.ok) return { plans: [] };
      return res.json();
    }
  });

  const billingPlans = billingPlansData?.plans || [];
  const planOrder = ["free", "business", "enterprise"];
  const sortedPlans = [...billingPlans].sort((a: any, b: any) => planOrder.indexOf(String(a.id)) - planOrder.indexOf(String(b.id)));

  const features = [
    { icon: "shield", title: "AI Moderation", desc: "Automated protection against spam, raids, and threats 24/7." },
    { icon: "support_agent", title: "Ticket Intelligence", desc: "AI-powered summaries and smart reply suggestions." },
    { icon: "analytics", title: "Executive Analytics", desc: "Clear KPIs and growth metrics for your community." },
    { icon: "auto_awesome", title: "AI Architect", desc: "Generate server structures from plain-language prompts." },
    { icon: "restore", title: "Backup & Restore", desc: "Snapshot and recover roles, channels, and settings." },
    { icon: "palette", title: "White-label", desc: "Full brand customization for a professional look." },
  ];

  const statsData = [
    { value: typeof stats?.activeServers === "number" ? Number(stats.activeServers).toLocaleString() : "2,847", label: "Active Servers" },
    { value: typeof stats?.weeklyUsers === "number" ? Number(stats.weeklyUsers).toLocaleString() : "1.2M", label: "Weekly Users" },
    { value: stats?.uptime || "99.99%", label: "Uptime" },
    { value: "<50ms", label: "Avg Response" },
  ];

  const featureHighlights = [
    {
      icon: "smart_toy",
      title: "AI Moderation",
      subtitle: "24/7 Automated Protection",
      description: "Real-time threat detection with intelligent incident workflows. Protects your community while you sleep.",
      metrics: [{ label: "Threats Blocked", value: "2.4M+" }, { label: "False Positives", value: "<0.1%" }],
      color: "#8B5CF6"
    },
    {
      icon: "psychology",
      title: "AI Support",
      subtitle: "Intelligent Ticket Handling",
      description: "Automatic summaries, smart reply suggestions, and SLA tracking. Cut response times in half.",
      metrics: [{ label: "Avg Response", value: "12s" }, { label: "SLA Compliance", value: "98%" }],
      color: "#00f0ff"
    },
    {
      icon: "trending_up",
      title: "Analytics Hub",
      subtitle: "Data-Driven Decisions",
      description: "Track growth, engagement, and retention. Executive-ready reports with actionable insights.",
      metrics: [{ label: "Reports Generated", value: "840K+" }, { label: "Data Points", value: "Real-time" }],
      color: "#00ffaa"
    },
    {
      icon: "bolt",
      title: "Performance",
      subtitle: "Blazing Fast Response",
      description: "Optimized infrastructure delivers sub-50ms response times globally. Always-on reliability.",
      metrics: [{ label: "Latency", value: "<50ms" }, { label: "Availability", value: "99.99%" }],
      color: "#f472b6"
    },
  ];

  return (
    <div className="bg-void text-white overflow-x-hidden min-h-screen font-sans">
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/5 backdrop-blur-xl">
        <div className="flex justify-between items-center px-6 h-16 max-w-7xl mx-auto">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-neon">
              <span className="material-symbols-outlined text-white text-lg">bolt</span>
            </div>
            <span className="text-lg font-black text-white tracking-tight">Radiance</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-widest">
            <a className="text-zinc-400 hover:text-white transition-colors" href="#features">Features</a>
            <a className="text-zinc-400 hover:text-white transition-colors" href="#modules">Modules</a>
            <a className="text-zinc-400 hover:text-white transition-colors" href="#pricing">Pricing</a>
            <a className="text-zinc-400 hover:text-white transition-colors" href="#stats">Stats</a>
          </div>
          <div className="flex items-center gap-3">
            {session ? (
              <Link to="/servers" className="primary-gradient px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest text-white shadow-neon hover:scale-105 transition-transform">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-zinc-400 hover:text-white transition-colors text-xs font-semibold uppercase tracking-widest hidden sm:block">Login</Link>
                <Link to="/login" className="primary-gradient px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest text-white shadow-neon hover:scale-105 transition-transform">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>
        <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-[120px] rounded-b-full" />
          <div className="absolute top-1/3 left-[-20%] w-[600px] h-[600px] bg-electric-blue/10 blur-[150px] rounded-full" />
          <div className="absolute bottom-1/3 right-[-10%] w-[500px] h-[500px] bg-neon-purple/10 blur-[120px] rounded-full" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,black_70%,transparent_100%)]" />
        </div>

        <section className="relative pt-32 pb-24 px-6 max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-glass border border-white/10 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bioluminescent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-bioluminescent"></span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">Version 4.0 Released</span>
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white mb-6 leading-[0.9]">
              <span className="block">The Premier</span>
              <span className="bg-gradient-to-r from-primary via-neon-purple to-secondary bg-clip-text text-transparent">Discord Suite</span>
            </h1>

            <p className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-400 leading-relaxed mb-10">
              Advanced AI moderation, intelligent analytics, and enterprise-grade tools. Everything your community needs, nothing it doesn't.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to={session ? "/servers" : "/login"} className="group relative primary-gradient px-8 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest text-white shadow-neon hover:scale-[1.03] transition-all overflow-hidden">
                <span className="relative z-10 flex items-center gap-2">
                  Launch Dashboard
                  <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </span>
              </Link>
              <Link to={session ? "/servers" : "/login"} className="px-8 py-4 rounded-2xl font-semibold text-sm uppercase tracking-widest text-zinc-300 glass-panel hover:bg-surface-container-high transition-all border border-white/5">
                View Demo
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-20 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-2xl glass-card p-1 overflow-hidden">
              <div className="rounded-xl bg-surface-container overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-void/50">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-[10px] text-zinc-500 ml-2">radiance-suite</span>
                </div>
                <div className="p-6 font-mono text-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-neon-purple">$</span>
                    <span className="text-white">radiance</span>
                    <span className="text-zinc-500">setup</span>
                    <span className="text-bioluminescent">--guild</span>
                    <span className="text-primary">"my-server"</span>
                  </div>
                  <div className="space-y-1 text-xs text-zinc-500">
                    <div><span className="text-bioluminescent">✓</span> AI Moderation configured</div>
                    <div><span className="text-bioluminescent">✓</span> Ticket system initialized</div>
                    <div><span className="text-bioluminescent">✓</span> Analytics dashboard ready</div>
                    <div><span className="text-bioluminescent">✓</span> White-label branding applied</div>
                    <div className="text-primary mt-2">Ready to scale! 🚀</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="stats" className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statsData.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card p-6 text-center"
                >
                  <div className="text-2xl md:text-3xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-1">{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-semibold">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-3">Capabilities</p>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">AI-Powered Features</h2>
              <p className="text-zinc-400 max-w-xl mx-auto">Next-generation tools that adapt to your community's needs in real-time.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feat, i) => (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="group glass-card p-6 hover:border-primary/30 transition-all duration-300 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4 border border-primary/20 group-hover:border-primary/40 transition-colors">
                    <span className="material-symbols-outlined text-primary text-2xl">{feat.icon}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{feat.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{feat.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="modules" className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />
          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-16">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-3">Dashboard</p>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">Complete Control Panel</h2>
              <p className="text-zinc-400 max-w-xl mx-auto">Every tool you need, organized in one premium interface.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {featureHighlights.map((feat, i) => (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card overflow-hidden group"
                  onMouseEnter={() => setActiveFeature(i)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${feat.color}20`, border: `1px solid ${feat.color}40` }}>
                          <span className="material-symbols-outlined text-xl" style={{ color: feat.color }}>{feat.icon}</span>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">{feat.subtitle}</p>
                          <h3 className="text-xl font-bold text-white">{feat.title}</h3>
                        </div>
                      </div>
                    </div>
                    <p className="text-zinc-400 text-sm mb-6">{feat.description}</p>
                    <div className="flex gap-6">
                      {feat.metrics.map((m) => (
                        <div key={m.label}>
                          <div className="text-2xl font-black text-white">{m.value}</div>
                          <div className="text-[10px] uppercase tracking-widest text-zinc-500">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="h-1 w-full bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(to right, ${feat.color}, transparent)` }} />
                </motion.div>
              ))}
            </div>

            <div className="mt-12 glass-card p-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                {[
                  { icon: "gpp_good", label: "Moderation", desc: "Automod & safety" },
                  { icon: "military_tech", label: "Leveling", desc: "XP & rewards" },
                  { icon: "support_agent", label: "Tickets", desc: "Smart support" },
                  { icon: "terminal", label: "Commands", desc: "Custom triggers" },
                  { icon: "waving_hand", label: "Welcome", desc: "Onboarding flows" },
                  { icon: "list_alt", label: "Logging", desc: "Audit trails" },
                  { icon: "view_quilt", label: "Embeds", desc: "Rich messages" },
                  { icon: "more_horiz", label: "And more", desc: "20+ modules" },
                ].map((m) => (
                  <div key={m.label} className="p-4 rounded-xl hover:bg-surface-container transition-colors">
                    <span className="material-symbols-outlined text-2xl text-primary mb-2 block">{m.icon}</span>
                    <div className="text-sm font-bold text-white">{m.label}</div>
                    <div className="text-[10px] text-zinc-500">{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="glass-card p-8 md:p-12 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">Enterprise-Grade Security</h2>
                <p className="text-zinc-400 mb-8 max-w-lg mx-auto">Bank-level encryption, SOC 2 compliance, and 99.99% uptime guarantee. Your data is safe with us.</p>
                <div className="flex flex-wrap justify-center gap-4">
                  {["AES-256 Encryption", "SOC 2 Compliant", "99.99% Uptime", "GDPR Ready"].map((badge) => (
                    <div key={badge} className="px-4 py-2 rounded-full bg-surface-container border border-white/5 text-xs font-semibold text-zinc-300 uppercase tracking-widest">
                      {badge}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-3">Pricing</p>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">Simple, Transparent Pricing</h2>
              <p className="text-zinc-400">No hidden fees. Cancel anytime.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {billingPlans.map((plan: any) => {
                const isBusiness = String(plan.id) === "business";
                const isFree = String(plan.id) === "free";
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className={`glass-card p-8 relative ${isBusiness ? "border-primary shadow-neon scale-[1.02]" : ""}`}
                  >
                    {isBusiness && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-secondary px-4 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest text-white shadow-neon">
                        Most Popular
                      </div>
                    )}
                    <h3 className="text-xl font-bold text-white mb-1">{plan.label}</h3>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-5xl font-black text-white">${Number(plan.priceMonthly || 0)}</span>
                      <span className="text-zinc-500">/month</span>
                    </div>
                    <ul className="space-y-3 mb-8">
                      {(isFree ? ["Core moderation", "Basic analytics", "5 modules"] : isBusiness ? ["AI Moderation", "All modules", "Priority support", "White-label"] : ["Everything in Business", "Dedicated support", "Custom integrations", "SLA guarantee"]).map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                          <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      to={session ? "/servers" : "/login"}
                      className={`block text-center py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${isBusiness ? "primary-gradient text-white shadow-neon hover:scale-[1.02]" : "border border-white/10 text-zinc-300 hover:bg-surface-container"}`}
                    >
                      {isFree ? "Start Free" : `Choose ${plan.label}`}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Ready to Launch?</h2>
              <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto">Join thousands of communities already using Radiance to build better experiences.</p>
              <Link
                to={session ? "/servers" : "/login"}
                className="group relative inline-flex items-center gap-2 primary-gradient px-10 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest text-white shadow-neon hover:scale-[1.03] transition-all overflow-hidden"
              >
                <span className="relative z-10">Start Building Today</span>
                <span className="material-symbols-outlined relative z-10 group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </Link>
            </motion.div>
          </div>
        </section>

        <footer className="py-12 px-6 border-t border-white/5">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-lg">bolt</span>
              </div>
              <span className="font-bold text-white">Radiance Suite</span>
            </div>
            <div className="flex gap-6 text-xs text-zinc-500 uppercase tracking-widest">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
              <a href="#" className="hover:text-white transition-colors">Docs</a>
            </div>
            <p className="text-[10px] text-zinc-600">&copy; 2026 Radiance Suite. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
