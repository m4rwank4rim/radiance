const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const User = require('../../models/User');
const CanvasRenderer = require('../../utils/canvasRenderer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the top players by balance'),
    async execute(interaction) {
        // Fetch top 5 users sorted by balance
        const topUsersData = await User.find().sort({ balance: -1 }).limit(5);

        if (topUsersData.length === 0) {
            return interaction.reply({ content: 'No players found on the leaderboard!', ephemeral: true });
        }

        // Prepare data for the renderer, including fetching display names and avatars from Discord
        const topUsers = await Promise.all(topUsersData.map(async (userRecord) => {
            try {
                const discordUser = await interaction.client.users.fetch(userRecord.discordId);
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
            .setDescription('The elite of the elite. Do you have what it takes to reach #1?')
            .setColor('#f2c94c')
            .setImage('attachment://leaderboard.png');

        await interaction.reply({ 
            embeds: [embed],
            files: [attachment]
        });
    },
};
