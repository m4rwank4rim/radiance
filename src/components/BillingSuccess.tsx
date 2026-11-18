import { Link, useSearchParams } from "react-router-dom";

export default function BillingSuccess() {
  const [params] = useSearchParams();
  const guildId = params.get("guildId");
  const plan = params.get("plan") || "upgraded";
  const dashboardPath = guildId ? `/dashboard/${guildId}/billing` : "/servers";

  return (
    <div className="min-h-screen bg-background text-on-background flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-3xl border border-green-500/30 bg-green-500/10 p-8 space-y-4">
        <h1 className="text-3xl font-black text-white">Payment successful</h1>
        <p className="text-sm text-on-surface-variant">
          Your subscription flow completed. Plan selected: <strong className="text-white">{plan}</strong>.
        </p>
        <p className="text-xs text-on-surface-variant">
          If webhook processing takes a few seconds, refresh the Billing page once.
        </p>
        <Link to={dashboardPath} className="inline-flex px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold">
          Continue to Billing
        </Link>
      </div>
    </div>
  );
}
