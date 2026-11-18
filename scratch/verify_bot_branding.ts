import { buildRankCard } from '../cardRenderer.js';
import fs from 'fs';

async function testBranding() {
    console.log("Generating branded rank card...");
    const buffer = await buildRankCard({
        username: "AntigravityTest",
        avatarUrl: "https://cdn.discordapp.com/embed/avatars/1.png",
        level: 42,
        rank: 1,
        currentXp: 500,
        requiredXp: 1000,
        accentColor: "#00ff00", // Bright Green
        brandName: "Antigravity OS"
    });

    fs.writeFileSync('branded_rank_card.png', buffer);
    console.log("Branded card saved to branded_rank_card.png");
}

testBranding().catch(console.error);
