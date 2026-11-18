const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const User = require('../../models/User');
const GuildSettings = require('../../models/GuildSettings');
const CanvasRenderer = require('../../utils/canvasRenderer');
const ProvablyFair = require('../../utils/provablyFair');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addmoney')
        .setDescription('Admin: Add coins to a user balance')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to add coins to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of coins to add')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const settings = await GuildSettings.get(interaction.guild.id);
        
        // Check if the user has the required admin role OR is an actual Administrator
        const hasAdminRole = settings.adminRoleId ? interaction.member.roles.cache.has(settings.adminRoleId) : false;
        const isServerAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!hasAdminRole && !isServerAdmin) {
            return interaction.reply({ 
                content: `🚫 You don't have permission to use this command! Requires the <@&${settings.adminRoleId || 'Administrator'}> role.`, 
                ephemeral: true 
            });
        }

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (targetUser.bot) {
            return interaction.reply({ content: "You can't add coins to bots!", ephemeral: true });
        }

        let userRecord = await User.findOne({ discordId: targetUser.id });
        if (!userRecord) {
            userRecord = new User({
                discordId: targetUser.id,
                serverSeed: ProvablyFair.generateServerSeed(),
            });
        }

        userRecord.balance += amount;
        await userRecord.save();

        const userData = {
            name: targetUser.username,
            avatarUrl: targetUser.displayAvatarURL({ extension: 'png' }),
            balance: userRecord.balance
        };

        const imageBuffer = await CanvasRenderer.drawEconomyCard('Coins Added', `+$${amount}`, userData);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'addmoney.png' });

        const embed = new EmbedBuilder()
            .setTitle('💰 Coins Added (Admin)')
            .setDescription(`Successfully added **$${amount.toLocaleString()}** to **${targetUser.username}**! New balance: **$${userRecord.balance.toLocaleString()}**`)
            .setColor('#3fb950')
            .setImage('attachment://addmoney.png');

        await interaction.reply({ 
            embeds: [embed],
            files: [attachment]
        });
    },
};
