---
title: Radiance Suite
emoji: ✨
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

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

## Hugging Face Spaces (bot + dashboard, free, no card)

HF's free **CPU Basic** hardware gives 2 vCPU / 16 GB RAM, which is enough for discord.js and
the canvas rank-card renderer. `Dockerfile` runs `npm start`, so the bot and the Express
dashboard share one container; `app_port` is 7860 (HF's default).

### 1. Create the Space

1. https://huggingface.co/new-space → owner: you, name: `radiance`, SDK: **Docker**,
   hardware: **CPU basic (free)**, visibility: public (free tier).
2. Copy the Space id, e.g. `youruser/radiance`.

### 2. Sync from GitHub (official `hub-sync` action)

`.github/workflows/sync-to-hub.yml` mirrors `main` to the Space on every push.

1. Create a **write** token: https://huggingface.co/settings/tokens → *New token* → role
   `write`.
2. GitHub repo → **Settings → Secrets and variables → Actions**:
   - Secret `HF_TOKEN` = the token
   - Variable `HF_SPACE_ID` = `youruser/radiance`
3. **Actions → Sync to Hugging Face Hub → Run workflow**.

The first Space build takes a few minutes (node-canvas compiles/copies native libs).

### 3. Add the runtime secrets in the Space

Space → **Settings → Variables and secrets → New secret** (same names as `.env.example`):

`DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`,
`VIRUSTOTAL_API_KEY`, `APP_URL`.

Set `APP_URL` to the Space URL:

```
https://youruser-radiance.hf.space
```

Then set Supabase **Site URL** to that origin and add
`https://youruser-radiance.hf.space/auth/callback` to the redirect allow list, and restart
the Space (Settings → *Restart this Space*) so the new secrets are picked up.

### Notes

- Free Spaces sleep after 48 h **without traffic**. An UptimeRobot monitor on
  `https://youruser-radiance.hf.space/health` every 5 minutes keeps it awake.
- The dashboard is publicly reachable; there is no auth gate beyond Supabase.
- If the Space logs `JavaScript heap out of memory`, raise
  `NODE_OPTIONS=--max-old-space-size=4096` in the Space variables.


