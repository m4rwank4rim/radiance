const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const User = require('../../models/User');
const ProvablyFair = require('../../utils/provablyFair');
const CanvasRenderer = require('../../utils/canvasRenderer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('Transfer coins to another user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to give coins to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of coins to give')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: "You can't give coins to yourself!", ephemeral: true });
        }

        if (targetUser.bot) {
            return interaction.reply({ content: "You can't give coins to bots!", ephemeral: true });
        }

        let giver = await User.findOne({ discordId: interaction.user.id });
        if (!giver) {
            giver = new User({
                discordId: interaction.user.id,
                serverSeed: ProvablyFair.generateServerSeed(),
            });
            await giver.save();
        }

        if (giver.balance < amount) {
            return interaction.reply({ content: `You don't have enough balance! Current balance: $${giver.balance}`, ephemeral: true });
        }

        let receiver = await User.findOne({ discordId: targetUser.id });
        if (!receiver) {
            receiver = new User({
                discordId: targetUser.id,
                serverSeed: ProvablyFair.generateServerSeed(),
            });
        }

        giver.balance -= amount;
        receiver.balance += amount;

        await giver.save();
        await receiver.save();

        const giverData = {
            name: interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL({ extension: 'png' }),
            balance: giver.balance
        };

        const imageBuffer = await CanvasRenderer.drawEconomyCard('Coins Transferred', `-$${amount}`, giverData);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'give.png' });

        const embed = new EmbedBuilder()
            .setTitle('💸 Coins Transferred')
            .setDescription(`You gave **$${amount.toLocaleString()}** to **${targetUser.username}**! New balance: **$${giver.balance.toLocaleString()}**`)
            .setColor('#f2c94c')
            .setImage('attachment://give.png');

        await interaction.reply({ 
            embeds: [embed],
            files: [attachment]
        });
    },
};
