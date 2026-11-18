# 🎰 Penthouse Casino Branding & Design System

This guide documents the exact design specifications, color palettes, and technical standards for the **Penthouse Casino** Discord bot. Use this to ensure any new games or features maintain perfect visual consistency.

---

## 🎨 Color Palette

| Name | Hex Code | Usage |
| :--- | :--- | :--- |
| **Deep Background** | `#0d1117` | Main canvas and UI background. |
| **Dark UI** | `#161b22` | Row backgrounds, tile backgrounds, cards. |
| **Penthouse Purple** | `#6c5ce7` | Active levels, primary buttons, accents. |
| **Gold Highlight** | `#f2c94c` | Multipliers, rank badges, secondary headers. |
| **Success Green** | `#3fb950` | "YOU WON" text, profit numbers, win slots. |
| **Danger Red** | `#f85149` | "GAME OVER" text, loss numbers, bomb backgrounds. |
| **Neon Cyan** | `#00d2ff` | Leaderboard borders, Hi-Lo card accents. |
| **Muted Grey** | `#8b949e` | Subtitles, "Member" text, labels. |

---

## 📐 Canvas Layouts

All canvases use **Arial** as the primary font (Bold for headers/values).

### 1. Game Canvas (Mines, Tower, Hi-Lo)
- **Dimensions**: `1200x630` (Standard) or `1200x900` (Tall/Tower).
- **Sidebar (`350px` width)**:
    - **Avatar**: `60px` radius, positioned at `(40, 40)`.
    - **Username**: `28px Bold Arial`, White.
    - **Bet Amount Label**: `20px Bold Arial`, Grey.
    - **Bet Amount Value**: `36px Bold Arial`, White.
    - **Profit Label**: `20px Bold Arial`, Grey.
    - **Profit Value**: `36px Bold Arial`, Success Green.
    - **Multiplier Badge**: `160x60` rounded rect, Gold background, Black text.

### 2. Economy Card (Balance, Daily)
- **Dimensions**: `1200x400`.
- **Layout**: Split 50/50 with a vertical divider.
- **Left Side**: User profile (Avatar + Username + "Account Member").
- **Right Side**: Highlighted Title (Gold) + Large Subtitle Value (White, `64px`).

### 3. Leaderboard
- **Dimensions**: `1200 x (180 + users * 120)`.
- **Row Specs**: `100px` height, `#161b22` background, `18px` corner radius.
- **Rank Badge**: Gold rect with `#0d1117` bold text.
- **Balance**: Far-right alignment, `52px Bold Arial`.

---

## 💎 Game Assets & Symbols

If custom image assets are missing, use these fallback drawing specs:

- **Diamond (Mines)**: Gradient from `#58a6ff` to `#00d2ff`. Faceted shape.
- **Bomb (Tower/Mines)**: Radial gradient from `#ff5f5f` to `#f85149`. Include a gold wick and spark.
- **Crystal (Tower)**: Hexagonal shape with gradient `#a29bfe` to `#6c5ce7`.
- **Cards (Hi-Lo)**: Gradient `#ffffff` to `#f0f0f0`. Drop shadow: `rgba(0,0,0,0.5)`, `blur: 20`.

---

## 🛡️ Technical Standards

### Provably Fair System
Every game **MUST** use the HMAC-SHA256 system in `ProvablyFair.js`. 
- **Server Seed**: 64-character hex string.
- **Client Seed**: User-provided or random.
- **Nonce**: Increments per bet.
- **Hash Result**: Use the first 4-8 bytes of the hash to derive game outcomes (mines positions, cards, rolls).

### Interaction Flow
1. **Deduct Balance**: Always deduct the bet from the database *before* generating the game result.
2. **Ephemeral Replies**: Use for balance errors or "You already claimed" messages.
3. **Button Collectors**: Use `response.createMessageComponentCollector` with a 15-minute timeout for games.
4. **Clean Exit**: Always remove or disable buttons (`components: []`) when a game ends or is cashed out.

---

## 📂 Project Structure
- `src/commands/`: Slash command definitions (economy vs games).
- `src/games/`: Pure logic classes (no Discord.js here).
- `src/utils/canvasRenderer.js`: The "Source of Truth" for all visuals.
- `src/utils/provablyFair.js`: The "Source of Truth" for randomness.
