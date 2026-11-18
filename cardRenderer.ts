/**
 * cardRenderer.ts
 * Custom canvas card engine — matches the Radiance Pro dashboard design.
 * Uses @napi-rs/canvas (available via canvafy dependency).
 */

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register Manrope font from canvafy assets
try {
    GlobalFonts.registerFromPath(path.join(__dirname, 'node_modules/canvafy/assets/fonts/Manrope/Manrope-Regular.ttf'), 'Manrope');
    GlobalFonts.registerFromPath(path.join(__dirname, 'node_modules/canvafy/assets/fonts/Manrope/Manrope-Bold.ttf'), 'Manrope');
} catch (e) {
    console.error("Failed to load Manrope font:", e);
}

// ─── Shared Styling ──────────────────────────────────────────────────────────

const CARD_BG = 'rgba(19, 19, 22, 0.95)';
const BORDER_COLOR = 'rgba(255, 255, 255, 0.08)';
const BORDER_WIDTH = 1;
const CORNER_RADIUS = 20;

async function drawCardBase(ctx: any, W: number, H: number, backgroundUrl: string | undefined) {
    await drawBackground(ctx, W, H, backgroundUrl);
    
    // Unified Background
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, 'rgba(19, 19, 22, 0.90)');
    bgGrad.addColorStop(1, 'rgba(19, 19, 22, 0.98)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Unified Border
    roundRect(ctx, 10, 10, W - 20, H - 20, CORNER_RADIUS);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fill();
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = BORDER_WIDTH;
    ctx.stroke();
}

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

async function fetchAvatar(url: string) {
    try {
        return await loadImage(url);
    } catch {
        return null;
    }
}

async function drawBackground(
    ctx: any,
    width: number,
    height: number,
    backgroundUrl: string | undefined
) {
    if (backgroundUrl) {
        try {
            const bg = await loadImage(backgroundUrl);
            ctx.drawImage(bg, 0, 0, width, height);
        } catch {
            drawFallbackBg(ctx, width, height);
        }
    } else {
        drawFallbackBg(ctx, width, height);
    }
}

function drawFallbackBg(ctx: any, width: number, height: number) {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#131316');
    grad.addColorStop(0.5, '#1b1b1e');
    grad.addColorStop(1, '#131316');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ─── Rank Card ───────────────────────────────────────────────────────────────

export interface RankCardOptions {
    username: string;
    avatarUrl: string;
    level: number;
    rank: number;
    currentXp: number;
    requiredXp: number;
    accentColor?: string;
    textColor?: string;
    backgroundUrl?: string;
    brandName?: string;
}

export async function buildRankCard(opts: RankCardOptions): Promise<Buffer> {
    const W = 850, H = 260;
    const accent = opts.accentColor || '#d0bcff';
    const text = opts.textColor || '#ffffff';

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    await drawCardBase(ctx, W, H, opts.backgroundUrl);
    
    // Avatar
    const AVATAR_SIZE = 140;
    const AVATAR_X = 50;
    const AVATAR_Y = H / 2 - AVATAR_SIZE / 2;

    ctx.beginPath();
    ctx.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2 + 6, 0, Math.PI * 2);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const avatar = await fetchAvatar(opts.avatarUrl);
    if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE);
        ctx.restore();
    }

    const TEXT_X = AVATAR_X + AVATAR_SIZE + 40;
    const TEXT_W = W - TEXT_X - 50;

    // Rank Badge (Top Right)
    const LEVEL_X = W - 50;
    ctx.font = 'bold 14px "Manrope", sans-serif';
    ctx.fillStyle = hexToRgba(text, 0.5);
    ctx.textAlign = 'right';
    ctx.fillText('LEVEL', LEVEL_X, 70);

    ctx.font = 'bold 72px "Manrope", sans-serif';
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 20;
    ctx.fillText(String(opts.level), LEVEL_X, 130);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';

    // Username
    ctx.font = 'bold 36px "Manrope", sans-serif';
    ctx.fillStyle = text;
    ctx.fillText(opts.username, TEXT_X, 100, TEXT_W - 120);

    // Rank text
    ctx.font = 'bold 16px "Manrope", sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText(`RANK #${opts.rank}`, TEXT_X, 130);

    // XP Bar Background
    const BAR_Y = 165;
    const BAR_H = 16;
    const BAR_W = TEXT_W;
    roundRect(ctx, TEXT_X, BAR_Y, BAR_W, BAR_H, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // XP Bar Fill
    const progress = Math.min(opts.currentXp / opts.requiredXp, 1);
    const fillW = Math.max(BAR_W * progress, 16);
    roundRect(ctx, TEXT_X, BAR_Y, fillW, BAR_H, 8);
    
    const barGrad = ctx.createLinearGradient(TEXT_X, 0, TEXT_X + fillW, 0);
    barGrad.addColorStop(0, accent);
    barGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = barGrad;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // XP Text
    ctx.font = 'bold 14px "Manrope", sans-serif';
    ctx.fillStyle = hexToRgba(text, 0.7);
    ctx.textAlign = 'right';
    ctx.fillText(`${opts.currentXp.toLocaleString()} / ${opts.requiredXp.toLocaleString()} XP`, TEXT_X + BAR_W, BAR_Y + BAR_H + 24);
    ctx.textAlign = 'left';

    // Branding Watermark
    ctx.font = 'bold 11px "Manrope", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText(`✦ ${opts.brandName?.toUpperCase() || 'RADIANCE PRO'}`, TEXT_X, BAR_Y + BAR_H + 24);

    return canvas.toBuffer('image/png');
}

// ─── Economy Card ───────────────────────────────────────────────────────────

export interface EconomyCardOptions {
    username: string;
    avatarUrl: string;
    wallet: number;
    bank: number;
    title?: string;
    description?: string;
    accentColor?: string;
    textColor?: string;
    backgroundUrl?: string;
    brandName?: string;
}

export async function buildEconomyCard(opts: EconomyCardOptions): Promise<Buffer> {
    const W = 850, H = 260;
    const accent = opts.accentColor || '#8b5cf6'; // Violet-600
    const text = opts.textColor || '#ffffff';

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    await drawCardBase(ctx, W, H, opts.backgroundUrl);
    
    // Avatar
    const AVATAR_SIZE = 140;
    const AVATAR_X = 60;
    const AVATAR_Y = H / 2 - AVATAR_SIZE / 2;

    ctx.beginPath();
    ctx.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2 + 6, 0, Math.PI * 2);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const avatar = await fetchAvatar(opts.avatarUrl);
    if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE);
        ctx.restore();
    }

    const TEXT_X = AVATAR_X + AVATAR_SIZE + 50;

    // Header Title
    ctx.font = 'bold 12px "Manrope", sans-serif';
    ctx.fillStyle = hexToRgba(text, 0.5);
    ctx.fillText(opts.title?.toUpperCase() || 'ECONOMY PROFILE', TEXT_X, 75);

    // Username
    ctx.font = 'bold 36px "Manrope", sans-serif';
    ctx.fillStyle = text;
    ctx.fillText(opts.username, TEXT_X, 115);

    // Stats Grid
    const STAT_Y = 160;
    
    // Wallet
    ctx.font = 'bold 11px "Manrope", sans-serif';
    ctx.fillStyle = hexToRgba(text, 0.4);
    ctx.fillText('WALLET BALANCE', TEXT_X, STAT_Y);
    
    ctx.font = 'bold 24px "Manrope", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`🪙 ${opts.wallet.toLocaleString()}`, TEXT_X, STAT_Y + 30);

    // Bank
    const BANK_X = TEXT_X + 220;
    ctx.font = 'bold 11px "Manrope", sans-serif';
    ctx.fillStyle = hexToRgba(text, 0.4);
    ctx.fillText('BANK SAVINGS', BANK_X, STAT_Y);
    
    ctx.font = 'bold 24px "Manrope", sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText(`🏦 ${opts.bank.toLocaleString()}`, BANK_X, STAT_Y + 30);

    // Total
    const TOTAL_X = BANK_X + 220;
    ctx.font = 'bold 11px "Manrope", sans-serif';
    ctx.fillStyle = hexToRgba(text, 0.4);
    ctx.fillText('NET WORTH', TOTAL_X, STAT_Y);
    
    ctx.font = 'bold 24px "Manrope", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`💎 ${(opts.wallet + opts.bank).toLocaleString()}`, TOTAL_X, STAT_Y + 30);

    // Branding Watermark
    ctx.font = 'bold 11px "Manrope", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText(`✦ ${opts.brandName?.toUpperCase() || 'RADIANCE ECONOMY'}`, TEXT_X, H - 35);

    return canvas.toBuffer('image/png');
}

// ─── Work/Daily Reward Card ────────────────────────────────────────────────

export interface RewardCardOptions {
    username: string;
    avatarUrl: string;
    amount: number;
    message: string;
    type: 'WORK' | 'DAILY';
    accentColor?: string;
    textColor?: string;
    backgroundUrl?: string;
    brandName?: string;
}

export async function buildRewardCard(opts: RewardCardOptions): Promise<Buffer> {
    const W = 850, H = 260;
    const accent = opts.type === 'DAILY' ? '#fbbf24' : '#10b981'; // Gold for Daily, Emerald for Work
    const text = opts.textColor || '#ffffff';

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    await drawCardBase(ctx, W, H, opts.backgroundUrl);
    
    // Avatar (Circular with Glow - matches Economy/Rank)
    const AVATAR_SIZE = 140;
    const AVATAR_X = 60;
    const AVATAR_Y = H / 2 - AVATAR_SIZE / 2;

    ctx.beginPath();
    ctx.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2 + 6, 0, Math.PI * 2);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const avatar = await fetchAvatar(opts.avatarUrl);
    if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE);
        ctx.restore();
    }

    const TEXT_X = AVATAR_X + AVATAR_SIZE + 50;

    // Header (Reward Title)
    ctx.font = 'bold 12px "Manrope", sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText(opts.type === 'DAILY' ? 'DAILY REWARD CLAIMED' : 'WORK SHIFT COMPLETED', TEXT_X, 75);

    // Username
    ctx.font = 'bold 36px "Manrope", sans-serif';
    ctx.fillStyle = text;
    ctx.fillText(opts.username, TEXT_X, 115);

    // Amount Focus
    ctx.font = 'bold 48px "Manrope", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 20;
    ctx.fillText(`+🪙 ${opts.amount.toLocaleString()}`, TEXT_X, 175);
    ctx.shadowBlur = 0;

    // Subtext Message
    ctx.font = '500 16px "Manrope", sans-serif';
    ctx.fillStyle = hexToRgba(text, 0.6);
    ctx.fillText(opts.message, TEXT_X, 210);

    // Branding Watermark
    ctx.font = 'bold 11px "Manrope", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText(`✦ ${opts.brandName?.toUpperCase() || 'RADIANCE SUITE'}`, TEXT_X, H - 35);

    return canvas.toBuffer('image/png');
}

// ─── Gambling / Mini-Game Card ─────────────────────────────────────────────

export interface GamblingCardOptions {
    username: string;
    avatarUrl: string;
    gameName: string;
    result: 'WIN' | 'LOSS' | 'DRAW';
    amount: number;
    description: string;
    accentColor?: string;
    textColor?: string;
    backgroundUrl?: string;
    brandName?: string;
}

export async function buildGamblingCard(opts: GamblingCardOptions): Promise<Buffer> {
    const W = 850, H = 260;
    const accent = opts.result === 'WIN' ? '#10b981' : (opts.result === 'LOSS' ? '#ef4444' : '#8b5cf6');
    const text = opts.textColor || '#ffffff';

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    await drawCardBase(ctx, W, H, opts.backgroundUrl);
    
    // Avatar (Circular with Glow)
    const AVATAR_SIZE = 140;
    const AVATAR_X = 60;
    const AVATAR_Y = H / 2 - AVATAR_SIZE / 2;

    ctx.beginPath();
    ctx.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2 + 6, 0, Math.PI * 2);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const avatar = await fetchAvatar(opts.avatarUrl);
    if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE);
        ctx.restore();
    }

    const TEXT_X = AVATAR_X + AVATAR_SIZE + 50;

    // Header
    ctx.font = 'bold 12px "Manrope", sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText(`${opts.gameName.toUpperCase()} - ${opts.result}`, TEXT_X, 75);

    // Username
    ctx.font = 'bold 36px "Manrope", sans-serif';
    ctx.fillStyle = text;
    ctx.fillText(opts.username, TEXT_X, 115);

    // Amount
    ctx.font = 'bold 48px "Manrope", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 20;
    const prefix = opts.result === 'WIN' ? '+' : (opts.result === 'LOSS' ? '-' : '');
    ctx.fillText(`${prefix}🪙 ${opts.amount.toLocaleString()}`, TEXT_X, 175);
    ctx.shadowBlur = 0;

    // Description
    ctx.font = '500 16px "Manrope", sans-serif';
    ctx.fillStyle = hexToRgba(text, 0.6);
    ctx.fillText(opts.description, TEXT_X, 210);

    // Branding Watermark
    ctx.font = 'bold 11px "Manrope", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText(`✦ ${opts.brandName?.toUpperCase() || 'RADIANCE GAMING'}`, TEXT_X, H - 35);

    return canvas.toBuffer('image/png');
}

// ─── Blackjack Game Card ──────────────────────────────────────────────────

export interface BlackjackCardOptions {
    username: string;
    avatarUrl: string;
    playerHand: string[];
    playerValue: number;
    dealerHand: string[];
    dealerValue: number;
    status: 'DEALING' | 'PLAYER_TURN' | 'DEALER_TURN' | 'WIN' | 'LOSS' | 'BUST' | 'PUSH';
    bet: number;
    accentColor?: string;
    backgroundUrl?: string;
    brandName?: string;
}

export async function buildBlackjackCard(opts: BlackjackCardOptions): Promise<Buffer> {
    const W = 1000, H = 550;
    const accent = opts.status === 'WIN' ? '#10b981' : (opts.status === 'LOSS' || opts.status === 'BUST' ? '#ef4444' : '#8b5cf6');
    
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // --- Elegant Table Background ---
    const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    
    // Draw felt pattern (subtle lines)
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for(let i=0; i<W; i+=40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
    for(let i=0; i<H; i+=40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }

    await drawCardBase(ctx, W, H, opts.backgroundUrl);

    // --- Decorative Table Edge ---
    ctx.beginPath();
    ctx.arc(W / 2, -150, 750, 0, Math.PI);
    ctx.strokeStyle = hexToRgba(accent, 0.1);
    ctx.lineWidth = 40;
    ctx.stroke();

    // --- Dealer Side (Top) ---
    ctx.font = 'black 12px "Manrope", sans-serif';
    ctx.fillStyle = hexToRgba('#ffffff', 0.3);
    ctx.fillText('HOUSE DEALER', 100, 60);
    
    ctx.font = 'bold 24px "Manrope", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(opts.dealerValue.toString(), 100, 95);

    opts.dealerHand.forEach((card, i) => {
        const x = 160 + (i * 90);
        const y = 50;
        // Shadow for depth
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 10;
        
        ctx.fillStyle = card === '?' ? '#334155' : '#ffffff';
        roundRect(ctx, x, y, 80, 120, 12);
        ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        
        if (card !== '?') {
            const isRed = card.includes('♥') || card.includes('♦');
            ctx.font = 'bold 28px "Manrope", sans-serif';
            ctx.fillStyle = isRed ? '#ef4444' : '#0f172a';
            ctx.fillText(card.slice(0, -1), x + 12, y + 35);
            ctx.font = '20px "Manrope", sans-serif';
            ctx.fillText(card.slice(-1), x + 12, y + 60);
            
            // Large center suit
            ctx.font = '48px "Manrope", sans-serif';
            ctx.globalAlpha = 0.1;
            ctx.fillText(card.slice(-1), x + 25, y + 100);
            ctx.globalAlpha = 1.0;
        } else {
            ctx.font = 'bold 48px "Manrope", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillText('?', x + 28, y + 75);
        }
    });

    // --- Player Side (Bottom) ---
    ctx.font = 'black 12px "Manrope", sans-serif';
    ctx.fillStyle = hexToRgba('#ffffff', 0.3);
    ctx.fillText(opts.username.toUpperCase(), 100, 310);
    
    ctx.font = 'bold 24px "Manrope", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(opts.playerValue.toString(), 100, 345);

    opts.playerHand.forEach((card, i) => {
        const x = 160 + (i * 90);
        const y = 300;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, x, y, 80, 120, 12);
        ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        
        const isRed = card.includes('♥') || card.includes('♦');
        ctx.font = 'bold 28px "Manrope", sans-serif';
        ctx.fillStyle = isRed ? '#ef4444' : '#0f172a';
        ctx.fillText(card.slice(0, -1), x + 12, y + 35);
        ctx.font = '20px "Manrope", sans-serif';
        ctx.fillText(card.slice(-1), x + 12, y + 60);

        ctx.font = '48px "Manrope", sans-serif';
        ctx.globalAlpha = 0.1;
        ctx.fillText(card.slice(-1), x + 25, y + 100);
        ctx.globalAlpha = 1.0;
    });

    // --- Center Status Overlay ---
    if (opts.status !== 'PLAYER_TURN' && opts.status !== 'DEALING') {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(0, 0, W, H);
        
        ctx.shadowColor = accent;
        ctx.shadowBlur = 30;
        ctx.fillStyle = accent;
        const boxW = 400, boxH = 120;
        roundRect(ctx, W/2 - boxW/2, H/2 - boxH/2, boxW, boxH, 24);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.font = 'black 48px "Manrope", sans-serif';
        ctx.fillStyle = '#ffffff';
        const txt = opts.status.replace('_', ' ');
        const tw = ctx.measureText(txt).width;
        ctx.fillText(txt, W/2 - tw/2, H/2 + 15);
        ctx.restore();
    }

    // --- Info Bar (Bottom Right) ---
    const INFO_X = W - 250;
    ctx.font = 'bold 12px "Manrope", sans-serif';
    ctx.fillStyle = hexToRgba('#ffffff', 0.4);
    ctx.fillText('CURRENT STAKE', INFO_X, H - 85);
    
    ctx.font = 'bold 32px "Manrope", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`🪙 ${opts.bet.toLocaleString()}`, INFO_X, H - 50);

    return canvas.toBuffer('image/png');
}

// ─── Welcome / Profile / Stats Card ──────────────────────────────────────────

export interface WelcomeCardOptions {
    username: string;
    avatarUrl: string;
    title?: string;
    description?: string;
    accentColor?: string;
    textColor?: string;
    backgroundUrl?: string;
    brandName?: string;
}

export async function buildWelcomeCard(opts: WelcomeCardOptions): Promise<Buffer> {
    const W = 850, H = 260;
    const accent = opts.accentColor || '#d0bcff';
    const text = opts.textColor || '#ffffff';

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    await drawCardBase(ctx, W, H, opts.backgroundUrl);
    
    const AVATAR_SIZE = 140;
    const AVATAR_X = 60;
    const AVATAR_Y = H / 2 - AVATAR_SIZE / 2;

    ctx.beginPath();
    ctx.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2 + 6, 0, Math.PI * 2);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const avatar = await fetchAvatar(opts.avatarUrl);
    if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE);
        ctx.restore();
    }

    const TEXT_X = AVATAR_X + AVATAR_SIZE + 50;

    // We manually simulate letter spacing by splitting chars
    const titleText = (opts.title || 'WELCOME').toUpperCase();
    ctx.font = 'bold 14px "Manrope", sans-serif';
    ctx.fillStyle = accent;
    
    let currentX = TEXT_X;
    for (const char of titleText) {
        ctx.fillText(char, currentX, 90);
        currentX += ctx.measureText(char).width + 4;
    }

    ctx.font = 'bold 42px "Manrope", sans-serif';
    ctx.fillStyle = text;
    ctx.fillText(opts.username, TEXT_X, 140, W - TEXT_X - 40);

    if (opts.description) {
        ctx.font = 'bold 16px "Manrope", sans-serif';
        ctx.fillStyle = hexToRgba(text, 0.6);
        ctx.fillText(opts.description, TEXT_X, 175, W - TEXT_X - 40);
    }

    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 8;
    ctx.fillRect(TEXT_X, 195, 60, 4);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 11px "Manrope", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.textAlign = 'right';
    ctx.fillText(`✦ ${opts.brandName?.toUpperCase() || 'RADIANCE PRO'}`, W - 40, H - 40);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
}

// ─── Leaderboard Card ────────────────────────────────────────────────────────

export interface LeaderboardEntry {
    rank: number;
    username: string;
    xp?: number;
    balance?: number;
    avatarUrl?: string;
}

export interface LeaderboardCardOptions {
    entries: LeaderboardEntry[];
    guildName?: string;
    accentColor?: string;
    textColor?: string;
    backgroundUrl?: string;
    type?: 'XP' | 'COINS';
    brandName?: string;
}

export async function buildLeaderboardCard(opts: LeaderboardCardOptions): Promise<Buffer> {
    const ROW_H = 70;
    const HEADER_H = 100;
    const entries = opts.entries.slice(0, 5); // Always top 5
    const W = 800;
    const H = HEADER_H + entries.length * ROW_H + 30;
    const accent = opts.accentColor || (opts.type === 'COINS' ? '#fbbf24' : '#d0bcff');
    const text = opts.textColor || '#ffffff';

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    await drawCardBase(ctx, W, H, opts.backgroundUrl);

    // Header
    const titleText = opts.type === 'COINS' ? '✦ ECONOMY LEADERBOARD' : '✦ XP LEADERBOARD';
    ctx.font = 'bold 14px "Manrope", sans-serif';
    ctx.fillStyle = accent;

    let currentX = 40;
    for (const char of titleText) {
        ctx.fillText(char, currentX, 45);
        currentX += ctx.measureText(char).width + 3;
    }

    ctx.font = 'bold 36px "Manrope", sans-serif';
    ctx.fillStyle = text;
    ctx.fillText(opts.guildName || 'Server Rankings', 40, 85);

    // Entries
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const Y = HEADER_H + 10 + i * ROW_H;
        const centerY = Y + ROW_H / 2;

        // Row background
        roundRect(ctx, 30, Y, W - 60, ROW_H, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Rank
        ctx.font = `bold 24px "Manrope", sans-serif`;
        ctx.fillStyle = hexToRgba(text, 0.4);
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1).padStart(2, '0'), 70, centerY + 8);
        ctx.textAlign = 'left';

        // Avatar
        const AV_X = 110, AV_R = 22;
        ctx.save();
        ctx.beginPath();
        ctx.arc(AV_X + AV_R, centerY, AV_R, 0, Math.PI * 2);
        ctx.clip();
        const avatar = entry.avatarUrl ? await fetchAvatar(entry.avatarUrl) : null;
        if (avatar) {
            ctx.drawImage(avatar, AV_X, centerY - AV_R, AV_R * 2, AV_R * 2);
        }
        ctx.restore();

        // Username
        ctx.font = 'bold 20px "Manrope", sans-serif';
        ctx.fillStyle = text;
        ctx.fillText(entry.username, 170, centerY + 7, 300);

        // Value (XP or Balance)
        ctx.font = 'bold 18px "Manrope", sans-serif';
        ctx.fillStyle = accent;
        ctx.textAlign = 'right';
        const valueText = opts.type === 'COINS' 
            ? `🪙 ${(entry.balance || 0).toLocaleString()}` 
            : `${(entry.xp || 0).toLocaleString()} XP`;
        ctx.fillText(valueText, W - 50, centerY + 7);
        ctx.textAlign = 'left';
    }

    // Watermark
    ctx.font = 'bold 11px "Manrope", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.textAlign = 'center';
    ctx.fillText('✦ RADIANCE PRO', W / 2, H - 15);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
}
