<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/2d929836-0b6b-4de4-bb54-486b0e8fb1c2

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Premium MVP Operations

### Validation Suite

- Run premium API smoke checks:
  - `npm run verify:premium`
- Optional env overrides:
  - `VERIFY_BASE_URL=http://localhost:3000`
  - `VERIFY_GUILD_ID=<guild_id>`

### New MVP API Surfaces

- `GET /api/guilds/:id/moderation/risk-events`
- `GET/POST /api/guilds/:id/incidents`
- `POST /api/guilds/:id/incidents/:incidentId/actions`
- `GET/POST /api/guilds/:id/tickets/sla`
- `POST /api/guilds/:id/tickets/:ticketId/summary`
- `GET/POST /api/guilds/:id/snapshots`
- `GET /api/guilds/:id/snapshots/diff?from=<id>&to=<id>`
- `POST /api/guilds/:id/snapshots/:snapshotId/restore`
- `GET /api/guilds/:id/analytics/executive`
- `POST /api/guilds/:id/analytics/weekly-report`
- `POST /api/billing/webhook`
- `GET /api/guilds/:id/entitlements`
- `GET/POST /api/guilds/:id/branding`
- `GET /api/guilds/:id/onboarding-checklist`

### Onboarding Checklist

Use `GET /api/guilds/:id/onboarding-checklist` and ensure all checks are true before pilot launch:

- Core modules configured
- Security and incident automation enabled
- First backup snapshot created
- Entitlements configured for target plan
- Dynamic voice and operational channels configured

## Deploy to Render (free Web Service)

The Express server in `server.ts` boots both the Discord bot and the dashboard, and exposes
`GET /health` (plain text `Bot is online`) for Render's port check and UptimeRobot.

1. Push this repo to GitHub, then in Render choose **New > Blueprint** and select the repo
   (`render.yaml` is detected automatically).
2. Fill in the environment variables marked `sync: false` (see `.env.example`).
   Render injects `PORT` itself; do not set it manually.
3. Build: `npm ci --include=dev && npm run build`
4. Start: `npm start`
5. Add an UptimeRobot HTTP(s) monitor for `https://<your-service>.onrender.com/health`,
   interval 5 minutes. Free Render services sleep after ~15 minutes of inactivity, so the
   monitor doubles as the bot's keep-alive.

## GitHub Actions (bot only, no payment method)

`.github/workflows/discord-bot.yml` starts only the Discord client (no dashboard) and
restarts it every 6 hours. Add these under **Settings > Secrets and variables > Actions**:

`DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `VIRUSTOTAL_API_KEY`.

Limitations: a public repository is required for unmetered Actions minutes (private repos
get ~33 hours/month); the bot is offline for a few minutes between 6-hour runs; scheduled
workflows pause after 60 days without repository activity; and no inbound HTTP port is
available, so the web dashboard and `/health` are not reachable.

