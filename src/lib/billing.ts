export async function openUpgradeCheckout(guildId: string, plan: "business" | "enterprise" = "business") {
  const res = await fetch(`/api/billing/checkout-url/${guildId}?plan=${plan}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) {
    const message = String(data?.error || "Unable to open checkout.");
    if (message.toLowerCase().includes("not configured")) {
      window.open(`/dashboard/${guildId}/billing?simulation=1&plan=${plan}`, "_self");
      return;
    }
    throw new Error(message);
  }
  window.open(data.url, "_blank");
}

export async function openBillingPortal(guildId: string) {
  const res = await fetch(`/api/billing/portal/${guildId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) {
    const message = String(data?.error || "Unable to open billing portal.");
    if (message.toLowerCase().includes("not configured")) {
      window.open(`/dashboard/${guildId}/billing?simulation=1`, "_self");
      return;
    }
    throw new Error(message);
  }
  window.open(data.url, "_blank");
}
