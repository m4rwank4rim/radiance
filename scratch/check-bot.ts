import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

bot.once('ready', () => {
    console.log("=== Bot Guilds ===");
    for (const [id, guild] of bot.guilds.cache) {
        console.log(`- ${guild.name} (${id})`);
    }
    process.exit(0);
});

bot.login(process.env.DISCORD_BOT_TOKEN);
