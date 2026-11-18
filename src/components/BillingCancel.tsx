import { Link, useSearchParams } from "react-router-dom";

export default function BillingCancel() {
  const [params] = useSearchParams();
  const guildId = params.get("guildId");
  const plan = params.get("plan") || "business";
  const dashboardPath = guildId ? `/dashboard/${guildId}/billing` : "/servers";

  return (
    <div className="min-h-screen bg-background text-on-background flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 space-y-4">
        <h1 className="text-3xl font-black text-white">Checkout canceled</h1>
        <p className="text-sm text-on-surface-variant">
          No charge was made. You can retry anytime when you are ready to upgrade to <strong className="text-white">{plan}</strong>.
        </p>
        <Link to={dashboardPath} className="inline-flex px-4 py-2 rounded-xl bg-surface-container-high border border-outline-variant/20 text-white text-sm font-bold">
          Back to Billing
        </Link>
      </div>
    </div>
  );
}
