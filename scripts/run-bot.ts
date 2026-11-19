/**
 * Bot-only entry point used by .github/workflows/discord-bot.yml.
 *
 * GitHub Actions does not expose an inbound HTTP port and kills a job after
 * 6 hours, so this deliberately skips the Express dashboard in server.ts and
 * only starts the Discord client. The next scheduled run replaces this one.
 */
import { startBot, bot } from "../bot.js";

const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;

if (!token || token === "your-discord-bot-token") {
  console.error("[Actions] DISCORD_BOT_TOKEN is missing or still a placeholder.");
  process.exit(1);
}

startBot();

// If Discord never completes the handshake, fail the job instead of idling
// for the full 6-hour window.
const READY_TIMEOUT_MS = 120_000;
const readyTimer = setTimeout(() => {
  if (!bot.isReady()) {
    console.error("[Actions] Discord client did not become ready within 120 seconds.");
    process.exit(1);
  }
}, READY_TIMEOUT_MS);
readyTimer.unref();

bot.once("ready", () => {
  clearTimeout(readyTimer);
  console.log("[Actions] Bot is ready. Staying online until the job timeout.");
});
