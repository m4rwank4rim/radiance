import { useLocation, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { openBillingPortal, openUpgradeCheckout } from "../lib/billing";
import { toast } from "sonner";

export default function Billing() {
  const { guildId } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const simulationMode = new URLSearchParams(location.search).get("simulation") === "1";

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ["billingPlans"],
    queryFn: async () => {
      const res = await fetch("/api/billing/plans");
      if (!res.ok) return { plans: [] };
      return res.json();
    }
  });

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ["billingSummary", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/billing/summary/${guildId}`);
      if (!res.ok) throw new Error("Failed to fetch billing summary");
      return res.json();
    },
    enabled: !!guildId
  });

  const simulateMutation = useMutation({
    mutationFn: async (plan: "free" | "business" | "enterprise") => {
      const res = await fetch(`/api/billing/simulate/${guildId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan })
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Failed to simulate plan" }))).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billingSummary", guildId] });
      queryClient.invalidateQueries({ queryKey: ["entitlements", guildId] });
      toast.success("Plan updated");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to simulate plan")
  });

  const currentPlan = String(summary?.subscription?.plan || "free");
  const plans = plansData?.plans || [];
  const featureMeta: Record<string, { label: string; description: string }> = {
    ai_moderation: {
      label: "AI Moderation",
      description: "Automatically detects spam, raids, and risky behavior before it spreads."
    },
    ticket_intelligence: {
      label: "Ticket Intelligence",
      description: "Summarizes tickets, suggests replies, and tracks SLA priority timers."
    },
    backup_restore: {
      label: "Backup and Restore",
      description: "Saves your server structure and settings, then restores them safely when needed."
    },
    executive_analytics: {
      label: "Executive Analytics",
      description: "Shows growth, activity, and health metrics in simple performance dashboards."
    },
    white_label: {
      label: "White-label Branding",
      description: "Customize bot/dashboard branding with your name, colors, and identity."
    }
  };
  const getFeatureMeta = (key: string) => featureMeta[key] || { label: key.replaceAll("_", " "), description: "Premium feature" };

  return (
    <div className="space-y-8 max-w-6xl">
      {simulationMode && (
        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-bold">
          Stripe is not configured yet. You are in simulation mode. Use the Developer Simulation buttons below to test free/business/enterprise behavior.
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Billing</h2>
          <p className="text-on-surface-variant text-sm">Manage subscription, plan upgrades, and feature access.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Current: {currentPlan}</span>
          {currentPlan !== "free" && (
            <button
              onClick={() => guildId && openBillingPortal(guildId).catch((err) => toast.error(err?.message || "Billing portal unavailable"))}
              className="px-4 py-2 rounded-xl bg-surface-container-high border border-outline-variant/20 text-white text-xs font-bold"
            >
              Manage Billing
            </button>
          )}
        </div>
      </div>
      {summaryLoading && <div className="text-xs text-on-surface-variant">Loading billing summary...</div>}
      {summaryError && <div className="text-xs text-red-300">Could not load billing summary. Try refresh.</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan: any) => {
          const isCurrent = currentPlan === plan.id;
          const isFree = plan.id === "free";
          return (
            <div key={plan.id} className={`rounded-2xl border p-6 ${isCurrent ? "border-primary bg-primary/10" : "border-outline-variant/10 bg-surface-container-low"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">{plan.label}</h3>
                {isCurrent && <span className="text-[10px] px-2 py-1 rounded bg-primary text-on-primary font-bold uppercase">Active</span>}
              </div>
              <p className="text-2xl font-black text-white mt-4">
                ${plan.priceMonthly}
                <span className="text-xs font-semibold text-on-surface-variant">/month</span>
              </p>
              <div className="mt-4 space-y-1">
                {(plan.features || []).length === 0 ? (
                  <div className="text-xs text-on-surface-variant">Core features only.</div>
                ) : (
                  plan.features.map((f: string) => (
                    <div key={f} className="text-xs text-on-surface-variant">
                      <div className="text-white font-semibold">- {getFeatureMeta(f).label}</div>
                      <div className="opacity-80">{getFeatureMeta(f).description}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-5">
                {isCurrent ? (
                  <button disabled className="w-full px-4 py-2 rounded-xl bg-surface-container-high text-on-surface-variant text-xs font-bold opacity-70">
                    Current Plan
                  </button>
                ) : isFree ? (
                  <button
                    onClick={() => guildId && simulateMutation.mutate("free")}
                    className="w-full px-4 py-2 rounded-xl bg-surface-container-high border border-outline-variant/20 text-white text-xs font-bold"
                  >
                    Switch to Free
                  </button>
                ) : (
                  <button
                    onClick={() => guildId && openUpgradeCheckout(guildId, plan.id).catch((err) => toast.error(err?.message || "Checkout unavailable"))}
                    className="w-full px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold"
                  >
                    Upgrade to {plan.label}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {plansLoading && <div className="text-xs text-on-surface-variant">Loading plans...</div>}

      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6">
        <h3 className="text-lg font-bold text-white mb-3">Feature Entitlements</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Object.entries(summary?.features || {}).map(([feature, enabled]) => (
            <div key={feature} className={`p-3 rounded-xl border text-xs ${enabled ? "bg-green-500/10 border-green-500/30 text-green-300" : "bg-surface-container-high border-outline-variant/10 text-on-surface-variant"}`}>
              <div className="font-bold">{getFeatureMeta(feature).label}</div>
              <div className="text-[10px] mt-1 opacity-80">{getFeatureMeta(feature).description}</div>
              <div className="text-[10px] mt-1 font-bold uppercase tracking-widest">{enabled ? "Enabled" : "Locked"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6">
        <h3 className="text-lg font-bold text-white mb-2">Developer Simulation (non-production)</h3>
        <p className="text-xs text-on-surface-variant mb-3">Quickly test plan locks in staging/dev.</p>
        <div className="flex gap-2">
          <button onClick={() => simulateMutation.mutate("free")} className="px-3 py-2 rounded-lg bg-surface-container-high text-white text-xs font-bold">Set Free</button>
          <button onClick={() => simulateMutation.mutate("business")} className="px-3 py-2 rounded-lg bg-primary/20 text-primary text-xs font-bold">Set Business</button>
          <button onClick={() => simulateMutation.mutate("enterprise")} className="px-3 py-2 rounded-lg bg-secondary/20 text-secondary text-xs font-bold">Set Enterprise</button>
        </div>
      </div>
    </div>
  );
}
