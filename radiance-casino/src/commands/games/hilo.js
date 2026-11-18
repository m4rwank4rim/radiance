const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const User = require('../../models/User');
const HiloLogic = require('../../games/hiloLogic');
const CanvasRenderer = require('../../utils/canvasRenderer');
const ProvablyFair = require('../../utils/provablyFair');
const RankManager = require('../../utils/rankManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hilo')
        .setDescription('Play a game of Hi-Lo')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Amount to bet (10 - 10,000)')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(10000)),

    async execute(interaction) {
        try {
            // Check for game room restriction
            const canPlay = await RankManager.canPlayGame('hilo', interaction.channel);
            if (!canPlay) {
                const roomName = await RankManager.getGameRoomName(interaction.guild, 'hilo');
                return interaction.reply({ content: `🚫 This game can only be played in the **${roomName}**!`, ephemeral: true });
            }

            // Check for game access role
            const hasAccess = await RankManager.hasGameAccess(interaction.member);
            if (!hasAccess) {
                const settings = await require('../../models/GuildSettings').get(interaction.guild.id);
                return interaction.reply({ content: `🚫 You need the <@&${settings.gameRoleId}> role to play games!`, ephemeral: true });
            }

            const isButton = interaction.isButton();
            const isBetAgain = interaction.isBetAgain;
            
            // Immediate deferral to prevent "Interaction failed"
            // If it's a normal button (not bet again) and NOT already deferred by the collector
            if (isButton && !isBetAgain && !interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate().catch(() => {});
            }

            // Show loading state immediately to prevent timeout on slow canvas draws
            // Only if it's a normal button interaction (Bet Again is handled in index.js)
            if (isButton && !isBetAgain) {
                await interaction.editReply({ 
                    content: `⌛ **Preparing New Game...**`,
                    components: [],
                    files: [],
                    attachments: [] 
                }).catch(() => {});
            }

            const bet = isButton ? parseInt(interaction.customId.split('_')[2]) : interaction.options.getInteger('bet');
            const userId = interaction.user.id;

            const betAgainRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`hilo_again_${bet}`)
                    .setLabel('Bet Again')
                    .setStyle(ButtonStyle.Secondary)
            );

            let user = await User.findOne({ discordId: userId });
            if (!user) {
                user = new User({
                    discordId: userId,
                    serverSeed: ProvablyFair.generateServerSeed(),
                });
                await user.save();
            }

            if (user.balance < bet) {
                const balanceMsg = `You don't have enough balance! Current balance: $${user.balance}`;
                if (isButton) return await interaction.editReply({ content: balanceMsg, components: [], files: [], attachments: [] });
                return await interaction.reply({ content: balanceMsg, ephemeral: true });
            }

            // Deduct bet
            user.balance -= bet;
            user.totalWagered += bet;
            user.nonce += 1;
            await user.save();

            // Check for rank update
            await RankManager.checkAndAssignRank(interaction.member, user);

            // Check for max bet limit based on rank
            const maxBet = await RankManager.getMaxBet(interaction.member, user);
            if (bet > maxBet) {
                const limitMsg = `🚫 Your current rank (**${user.rank}**) has a maximum bet limit of **$${maxBet.toLocaleString()}**!`;
                if (isButton) return await interaction.editReply({ content: limitMsg, components: [], files: [], attachments: [] });
                return await interaction.reply({ content: limitMsg, ephemeral: true });
            }

            const game = new HiloLogic(bet, user.serverSeed, user.clientSeed, user.nonce);

            // Function to get current user data for renderer
            const getUserData = () => ({
                name: interaction.user.username,
                avatarUrl: interaction.user.displayAvatarURL({ extension: 'png' }),
                bet: bet,
                multiplier: game.currentMultiplier,
                profit: game.currentMultiplier > 1 ? (bet * game.currentMultiplier) - bet : 0,
                isGameOver: game.isGameOver,
                isWon: game.isWon,
                rank: user.rank
            });

            const createEmbed = async () => {
                const imageBuffer = await CanvasRenderer.drawHilo(game.currentCard, getUserData());
                const fileName = `hilo_${Date.now()}.png`;
                const attachment = new AttachmentBuilder(imageBuffer, { name: fileName });

                // Keep text content static during gameplay
                let content = `🃏 **Penthouse Casino | Hi-Lo**`;

                if (game.isGameOver) {
                    content = `💥 **BUST!** Lost **$${bet}**. Final card: **${game.currentCard.label}${game.currentCard.suitLabel}**`;
                }

                return { content, attachment, fileName };
            };

            const createButtons = () => {
                if (game.isGameOver) return [];

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('guess_higher').setLabel('Higher/Same').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('guess_lower').setLabel('Lower/Same').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('hilo_cashout').setLabel(`Cash Out ($${(bet * game.currentMultiplier).toFixed(2)})`).setStyle(ButtonStyle.Success).setDisabled(game.step === 0)
                );
                return [row];
            };

            const { content, attachment, fileName } = await createEmbed();
            const response = (isButton || isBetAgain) ? await interaction.editReply({
                content: content,
                files: [attachment],
                attachments: [], // IMPORTANT: Clear old attachments
                components: createButtons(),
            }) : await interaction.reply({
                content: content,
                files: [attachment],
                components: createButtons(),
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 300000, // 5 minutes
            });

            collector.on('collect', async i => {
                try {
                    if (i.customId.startsWith('guess_')) {
                        const type = i.customId.split('_')[1];
                        const result = game.guess(type);

                        if (game.isGameOver) {
                            collector.stop();
                            user.totalLosses += bet;
                            await user.save();
                        }

                        const { content: updatedContent, attachment: updatedAttachment } = await createEmbed();
                        await i.update({
                            content: updatedContent,
                            files: [updatedAttachment],
                            attachments: [],
                            components: game.isGameOver ? [betAgainRow] : createButtons(),
                        });

                    } else if (i.customId === 'hilo_cashout') {
                        game.isGameOver = true;
                        game.isWon = true;
                        collector.stop();

                        const winAmount = Math.floor(bet * game.currentMultiplier);
                        user.balance += winAmount;
                        user.totalWinnings += winAmount;
                        await user.save();

                        const { content: finalContent, attachment: finalAttachment } = await createEmbed();
                        const cashedOutContent = `💰 **CASHED OUT!** You won **$${winAmount}**! Final card: **${game.currentCard.label}${game.currentCard.suitLabel}**`;

                        await i.update({
                            content: cashedOutContent,
                            files: [finalAttachment],
                            attachments: [],
                            components: [betAgainRow],
                        });
                    }
                } catch (error) {
                    console.error('Hilo collector error:', error);
                }
            });
        } catch (error) {
            console.error('Hilo command error:', error);
        }
    },
};
