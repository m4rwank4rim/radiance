import dotenv from "dotenv";

dotenv.config();

const BASE_URL = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const GUILD_ID = process.env.VERIFY_GUILD_ID || "1490619387869139108";

async function check(path: string, expectedOk = true) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url);
  if (expectedOk && !res.ok) {
    throw new Error(`Check failed: ${url} (${res.status})`);
  }
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function run() {
  const checks = [
    `/api/health`,
    `/api/guilds/${GUILD_ID}/config`,
    `/api/guilds/${GUILD_ID}/incidents`,
    `/api/guilds/${GUILD_ID}/moderation/risk-events`,
    `/api/guilds/${GUILD_ID}/tickets/sla`,
    `/api/guilds/${GUILD_ID}/snapshots`,
    `/api/guilds/${GUILD_ID}/backup-scheduler`,
    `/api/guilds/${GUILD_ID}/restore-audit`,
    `/api/guilds/${GUILD_ID}/analytics/executive`,
    `/api/guilds/${GUILD_ID}/entitlements`,
    `/api/guilds/${GUILD_ID}/branding`,
    `/api/guilds/${GUILD_ID}/onboarding-checklist`
  ];

  for (const item of checks) {
    const result = await check(item, true);
    console.log(`OK ${item} -> ${result.status}`);
  }

  console.log("Premium MVP verification checks completed.");
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
