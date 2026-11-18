import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

bot.once('ready', () => {
    console.log("=== Bot Info ===");
    console.log("Tag:", bot.user?.tag);
    console.log("ID:", bot.user?.id);
    process.exit(0);
});

bot.login(process.env.DISCORD_BOT_TOKEN);
