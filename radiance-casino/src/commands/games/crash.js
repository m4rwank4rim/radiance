const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const User = require('../../models/User');
const CrashLogic = require('../../games/crashLogic');
const CanvasRenderer = require('../../utils/canvasRenderer');
const ProvablyFair = require('../../utils/provablyFair');
const RankManager = require('../../utils/rankManager');
const LeaderboardManager = require('../../utils/leaderboardManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crash')
        .setDescription('Play a game of Crash')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Amount to bet (10 - 10,000)')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(10000)),

    async execute(interaction) {
        try {
            // Check for game room restriction
            const canPlay = await RankManager.canPlayGame('crash', interaction.channel);
            if (!canPlay) {
                const roomName = await RankManager.getGameRoomName(interaction.guild, 'crash');
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
                    .setCustomId(`crash_again_${bet}`)
                    .setLabel('Bet Again')
                    .setStyle(ButtonStyle.Secondary)
            );

            // Fetch user or create if not exists
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

            const game = new CrashLogic(bet, user.serverSeed, user.clientSeed, user.nonce);

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
                const imageBuffer = await CanvasRenderer.drawCrash(game.currentMultiplier, getUserData());
                // Use a unique name to bypass Discord image caching
                const fileName = `crash_${Date.now()}.png`;
                const attachment = new AttachmentBuilder(imageBuffer, { name: fileName });

                // Keep text content static during gameplay to prevent "message stacking" bugs
                let content = `🚀 **Penthouse Casino | Crash**`;

                if (game.isGameOver) {
                    if (game.isWon) {
                        const winAmount = Math.floor(bet * game.currentMultiplier);
                        content = `💰 **CASHED OUT!** You won **$${winAmount}** at **${game.currentMultiplier.toFixed(2)}x**!`;
                    } else {
                        content = `💥 **CRASHED!** The game crashed at **${game.crashPoint.toFixed(2)}x**! Lost **$${bet}**.`;
                    }
                }

                return { content, attachment, fileName };
            };

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('crash_cashout')
                    .setLabel('Cash Out')
                    .setStyle(ButtonStyle.Success)
            );

            const { content, attachment, fileName } = await createEmbed();
            const response = (isButton || isBetAgain) ? await interaction.editReply({
                content: `⏳ **Preparing Game...**`,
                files: [attachment],
                attachments: [], // IMPORTANT: Clear old attachments
                components: [row],
            }) : await interaction.reply({
                content: `⏳ **Preparing Game...**`,
                files: [attachment],
                components: [row],
            });

            // 3-second countdown
            for (let i = 3; i > 0; i--) {
                await new Promise(r => setTimeout(r, 1000));
                await interaction.editReply({ 
                    content: `⏳ **Starting in ${i}...**` 
                }).catch(() => {});
            }

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 60000,
            });

            let multiplierInterval;
            let lastUpdateTime = Date.now();
            let lastDisplayUpdate = Date.now();
            let elapsed = 0;
            let isUpdatingDisplay = false;

            multiplierInterval = setInterval(async () => {
                try {
                    if (game.isGameOver) {
                        clearInterval(multiplierInterval);
                        return;
                    }

                    const now = Date.now();
                    const deltaTime = (now - lastUpdateTime) / 1000;
                    elapsed += deltaTime;
                    lastUpdateTime = now;

                    // Grow slightly faster for better feel: 1.10 base
                    const newMultiplier = 1.0 + (Math.pow(1.10, elapsed) - 1.0);
                    const result = game.updateMultiplier(newMultiplier);

                    if (result.state === 'crashed') {
                        clearInterval(multiplierInterval);
                        collector.stop('crashed');
                        
                        const { content: finalContent, attachment: finalAttachment } = await createEmbed();
                        await interaction.editReply({
                            content: finalContent,
                            files: [finalAttachment],
                            attachments: [],
                            components: [betAgainRow],
                        });
                        return;
                    }

                    // Update display every ~1.0 seconds to be safe with Discord limits
                    if (!isUpdatingDisplay && now - lastDisplayUpdate >= 1000) {
                        isUpdatingDisplay = true;
                        lastDisplayUpdate = now;
                        
                        try {
                            const { content: updateContent, attachment: updateAttachment } = await createEmbed();
                            await interaction.editReply({
                                content: updateContent,
                                files: [updateAttachment],
                                attachments: [] // Clear old attachments to force refresh
                            });
                        } catch (e) {
                            // Silently ignore rate limit errors
                        } finally {
                            isUpdatingDisplay = false;
                        }
                    }
                } catch (error) {
                    console.error('Crash multiplier interval error:', error);
                    clearInterval(multiplierInterval);
                }
            }, 200); // Faster internal logic (5 updates per second)

            collector.on('collect', async i => {
                try {
                    if (i.customId === 'crash_cashout') {
                        clearInterval(multiplierInterval);
                        game.cashOut();
                        
                        // Add winnings to balance
                        const winAmount = Math.floor(bet * game.currentMultiplier);
                        user.balance += winAmount;
                        await user.save();

                        const { content: finalContent, attachment: finalAttachment } = await createEmbed();
                        await i.update({
                            content: finalContent,
                            files: [finalAttachment],
                            attachments: [],
                            components: [betAgainRow],
                        });
                        
                        collector.stop('cashed_out');
                    }
                } catch (error) {
                    console.error('Crash collector collect error:', error);
                }
            });

            collector.on('end', async (collected, reason) => {
                clearInterval(multiplierInterval);
            });
        } catch (error) {
            console.error('Crash command error:', error);
        }
    },
};
