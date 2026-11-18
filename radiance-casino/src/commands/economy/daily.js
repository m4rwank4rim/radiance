const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const User = require('../../models/User');
const ProvablyFair = require('../../utils/provablyFair');
const CanvasRenderer = require('../../utils/canvasRenderer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily coins'),
    async execute(interaction) {
        let user = await User.findOne({ discordId: interaction.user.id });
        
        if (!user) {
            user = new User({
                discordId: interaction.user.id,
                serverSeed: ProvablyFair.generateServerSeed(),
            });
            await user.save();
        }

        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        if (user.lastDaily && (now - user.lastDaily) < oneDay) {
            const timeLeft = oneDay - (now - user.lastDaily);
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            return interaction.reply({ content: `You already claimed your daily coins! Try again in ${hours}h ${minutes}m.`, ephemeral: true });
        }

        const dailyReward = 500;
        user.balance += dailyReward;
        user.lastDaily = now;
        await user.save();

        const userData = {
            name: interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL({ extension: 'png' }),
            balance: user.balance
        };

        const imageBuffer = await CanvasRenderer.drawEconomyCard('Daily Reward Claimed', `+$${dailyReward}`, userData);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'daily.png' });

        const embed = new EmbedBuilder()
            .setTitle('🎁 Daily Reward')
            .setDescription(`You claimed your reward! New balance: **$${user.balance.toLocaleString()}**`)
            .setColor('#ff005c')
            .setImage('attachment://daily.png');

        await interaction.reply({ 
            embeds: [embed],
            files: [attachment]
        });
    },
};
