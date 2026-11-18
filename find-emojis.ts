import { bot } from './bot.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function findEmojis() {
    await bot.login(process.env.DISCORD_BOT_TOKEN);
    bot.once('ready', () => {
        const guildId = '1490619387869139108';
        const guild = bot.guilds.cache.get(guildId);
        if (!guild) {
            console.error('Guild not found');
            process.exit(1);
        }

        const emojiNames = [
            'activities', 'camera', 'claim', 'hide', 'info',
            'invite', 'kick', 'limit', 'lock', 'unlock',
            'rename', 'music', 'perms', 'settings', 'show'
        ];

        const results: Record<string, string> = {};
        for (const name of emojiNames) {
            const emoji = guild.emojis.cache.find(e => e.name?.toLowerCase() === name.toLowerCase());
            results[name] = emoji ? `<:${emoji.name}:${emoji.id}>` : '❌ NOT_FOUND';
        }

        console.log(JSON.stringify(results, null, 2));
        process.exit(0);
    });
}

findEmojis();
