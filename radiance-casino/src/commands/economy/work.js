const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const User = require('../../models/User');
const ProvablyFair = require('../../utils/provablyFair');
const CanvasRenderer = require('../../utils/canvasRenderer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work to earn some coins'),
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
        const cooldown = 60 * 60 * 1000; // 1 hour

        if (user.lastWork && (now - user.lastWork) < cooldown) {
            const timeLeft = cooldown - (now - user.lastWork);
            const minutes = Math.floor(timeLeft / (60 * 1000));
            const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
            return interaction.reply({ content: `You're too tired to work! Try again in ${minutes}m ${seconds}s.`, ephemeral: true });
        }

        // Random work reward between 50 and 250
        const workReward = Math.floor(Math.random() * 201) + 50;
        user.balance += workReward;
        user.lastWork = now;
        await user.save();

        const userData = {
            name: interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL({ extension: 'png' }),
            balance: user.balance
        };

        const workJobs = [
            "Cleaning the casino floor",
            "Dealing cards at the poker table",
            "Fixing a broken slot machine",
            "Serving drinks to high rollers",
            "Counting the vault's cash",
            "Managing the VIP lounge"
        ];
        const randomJob = workJobs[Math.floor(Math.random() * workJobs.length)];

        const imageBuffer = await CanvasRenderer.drawEconomyCard('Work Reward Claimed', `+$${workReward}`, userData);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'work.png' });

        const embed = new EmbedBuilder()
            .setTitle('💼 Work')
            .setDescription(`You earned coins for **${randomJob}**! New balance: **$${user.balance.toLocaleString()}**`)
            .setColor('#6c5ce7')
            .setImage('attachment://work.png');

        await interaction.reply({ 
            embeds: [embed],
            files: [attachment]
        });
    },
};
