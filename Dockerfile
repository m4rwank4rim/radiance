# Radiance Suite — Docker image for Hugging Face Spaces (or any Docker host)
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=7860 \
    DISABLE_HMR=true \
    HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# System libraries required by node-canvas (canvafy) and @napi-rs/canvas
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      build-essential \
      pkg-config \
      python3 \
      libcairo2-dev \
      libpango1.0-dev \
      libjpeg62-turbo-dev \
      libgif-dev \
      librsvg2-dev \
      libpixman-1-dev \
      fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Spaces run the container as UID 1000
RUN useradd -m -u 1000 user

WORKDIR /home/user/app

COPY --chown=user package.json package-lock.json ./
USER user
RUN npm ci --include=dev

COPY --chown=user . .

# Build the dashboard, then drop dev-only packages
RUN npm run build && npm prune --omit=dev

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||7860)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Starts both the Discord bot and the Express dashboard (bot.ts + server.ts)
CMD ["npm", "start"]
