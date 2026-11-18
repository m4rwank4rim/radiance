const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const User = require('../models/User');
const GuildSettings = require('../models/GuildSettings');
const CanvasRenderer = require('./canvasRenderer');

class LeaderboardManager {
    /**
     * Updates the auto-updating leaderboard message for a guild.
     * @param {Client} client - The Discord client.
     * @param {string} guildId - The ID of the guild.
     */
    static async updateLeaderboard(client, guildId) {
        try {
            const settings = await GuildSettings.get(guildId);
            if (!settings.leaderboardChannelId) return;

            let guild = client.guilds.cache.get(guildId);
            if (!guild) {
                try {
                    guild = await client.guilds.fetch(guildId);
                } catch (e) {
                    return console.error(`Failed to fetch guild ${guildId} for leaderboard.`);
                }
            }

            let channel = guild.channels.cache.get(settings.leaderboardChannelId);
            if (!channel) {
                try {
                    channel = await guild.channels.fetch(settings.leaderboardChannelId);
                } catch (e) {
                    return console.error(`Failed to fetch channel ${settings.leaderboardChannelId} for leaderboard.`);
                }
            }

            // Fetch top 5 users sorted by balance
            const topUsersData = await User.find().sort({ balance: -1 }).limit(5);

            if (topUsersData.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🏆 Top Penthouse Casino Players')
                    .setDescription('No players found on the leaderboard yet. Start playing to be the first!')
                    .setColor('#f2c94c');

                if (settings.leaderboardMessageId) {
                    try {
                        const message = await channel.messages.fetch(settings.leaderboardMessageId);
                        await message.edit({ embeds: [embed], files: [], attachments: [] });
                    } catch (e) {
                        const newMessage = await channel.send({ embeds: [embed] });
                        settings.leaderboardMessageId = newMessage.id;
                        await settings.save();
                    }
                } else {
                    const newMessage = await channel.send({ embeds: [embed] });
                    settings.leaderboardMessageId = newMessage.id;
                    await settings.save();
                }
                return;
            }

            const topUsers = await Promise.all(topUsersData.map(async (userRecord) => {
                try {
                    const discordUser = await client.users.fetch(userRecord.discordId);
                    return {
                        name: discordUser.username,
                        balance: userRecord.balance,
                        rank: userRecord.rank,
                        avatarUrl: discordUser.displayAvatarURL({ extension: 'png', size: 128 })
                    };
                } catch (error) {
                    return {
                        name: 'Unknown Player',
                        balance: userRecord.balance,
                        rank: userRecord.rank,
                        avatarUrl: null
                    };
                }
            }));

            const imageBuffer = await CanvasRenderer.drawLeaderboard(topUsers);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'leaderboard.png' });

            const embed = new EmbedBuilder()
                .setTitle('🏆 Top Penthouse Casino Players')
                .setDescription(`The elite of the elite. Last updated: <t:${Math.floor(Date.now() / 1000)}:R>`)
                .setColor('#f2c94c')
                .setImage('attachment://leaderboard.png');

            if (settings.leaderboardMessageId) {
                try {
                    const message = await channel.messages.fetch(settings.leaderboardMessageId);
                    await message.edit({ embeds: [embed], files: [attachment] });
                } catch (error) {
                    // Message might have been deleted, create a new one
                    const newMessage = await channel.send({ embeds: [embed], files: [attachment] });
                    settings.leaderboardMessageId = newMessage.id;
                    await settings.save();
                }
            } else {
                const newMessage = await channel.send({ embeds: [embed], files: [attachment] });
                settings.leaderboardMessageId = newMessage.id;
                await settings.save();
            }
        } catch (error) {
            console.error(`Error updating leaderboard for guild ${guildId}:`, error);
        }
    }
}

module.exports = LeaderboardManager;
