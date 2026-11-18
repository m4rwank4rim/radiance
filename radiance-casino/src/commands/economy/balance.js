const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const User = require('../../models/User');
const CanvasRenderer = require('../../utils/canvasRenderer');
const ProvablyFair = require('../../utils/provablyFair');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your current balance'),
    async execute(interaction) {
        let user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            user = new User({
                discordId: interaction.user.id,
                serverSeed: ProvablyFair.generateServerSeed(),
            });
            await user.save();
        }
        
        const balance = user.balance;

        const userData = {
            name: interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL({ extension: 'png' }),
            balance: balance,
            rank: user.rank
        };

        const imageBuffer = await CanvasRenderer.drawEconomyCard('Current Balance', `$${balance.toLocaleString()}`, userData);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'balance.png' });

        const embed = new EmbedBuilder()
            .setTitle('💰 Wallet Balance')
            .setDescription(`Your total available funds in **Penthouse Casino**.`)
            .addFields({ name: 'Rank', value: user.rank, inline: true })
            .addFields({ name: 'Total Wagered', value: `$${user.totalWagered.toLocaleString()}`, inline: true })
            .setColor('#4e34e1')
            .setImage('attachment://balance.png');

        await interaction.reply({ 
            embeds: [embed],
            files: [attachment]
        });
    },
};
