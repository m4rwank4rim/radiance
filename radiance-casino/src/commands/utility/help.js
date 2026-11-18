const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('List all available commands'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🎰 Penthouse Casino | Help')
            .setDescription('Welcome to the Penthouse Casino! Here are the available commands:')
            .setColor('#6c5ce7')
            .addFields(
                { name: '🎮 Games', value: '`/mines` - Play Mines\n`/tower` - Play Tower\n`/crash` - Play Crash\n`/hilo` - Play Hi-Lo' },
                { name: '💰 Economy', value: '`/balance` - Check your balance\n`/daily` - Claim daily reward\n`/work` - Work for coins\n`/give` - Transfer coins to someone\n`/leaderboard` - View top players' },
                { name: '🌐 Dashboard', value: `[Web Configuration Portal](http://161.97.180.224:${process.env.DASHBOARD_PORT || 3001}/dashboard)` },
                { name: '⚙️ Utilities', value: '`/help` - Show this menu' }
            )
            .setFooter({ text: 'Good luck and gamble responsibly!' });

        await interaction.reply({ embeds: [embed] });
    },
};
