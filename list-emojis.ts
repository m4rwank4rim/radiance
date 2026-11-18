import { bot } from './bot.js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

async function listGuildEmojis() {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        console.error('No token found');
        process.exit(1);
    }

    await bot.login(token);
    bot.once('ready', async () => {
        const guildId = '1492091465197944852'; // Radiance Storage
        const guild = bot.guilds.cache.get(guildId);

        if (!guild) {
            console.error('Guild not found. Available guilds:', bot.guilds.cache.map(g => `${g.name} (${g.id})`).join(', '));
            process.exit(1);
        }

        console.log(`--- Emojis for ${guild.name} ---`);
        const emojis = guild.emojis.cache.map(e => ({
            name: e.name,
            id: e.id,
            string: e.toString()
        }));

        console.log(JSON.stringify(emojis, null, 2));
        process.exit(0);
    });
}

listGuildEmojis().catch(console.error);
