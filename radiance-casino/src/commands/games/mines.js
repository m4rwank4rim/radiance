const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const User = require('../../models/User');
const MinesLogic = require('../../games/minesLogic');
const CanvasRenderer = require('../../utils/canvasRenderer');
const ProvablyFair = require('../../utils/provablyFair');
const RankManager = require('../../utils/rankManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mines')
        .setDescription('Play a game of Mines')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Amount to bet (10 - 10,000)')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(10000))
        .addIntegerOption(option =>
            option.setName('mines')
                .setDescription('Number of mines (1 - 24)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(24)),

    async execute(interaction) {
        try {
            // Check for game room restriction
            const canPlay = await RankManager.canPlayGame('mines', interaction.channel);
            if (!canPlay) {
                const roomName = await RankManager.getGameRoomName(interaction.guild, 'mines');
                return interaction.reply({ content: `🚫 This game can only be played in the **${roomName}**!`, ephemeral: true });
            }

            // Check for game access role
            const hasAccess = await RankManager.hasGameAccess(interaction.member);
            if (!hasAccess) {
                const settings = await require('../../models/GuildSettings').get(interaction.guild.id);
                return interaction.reply({ content: `🚫 You need the <@&${settings.gameRoleId}> role to play games!`, ephemeral: true });
            }

            // Handle both slash command and button interaction
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
            const minesCount = isButton ? parseInt(interaction.customId.split('_')[3]) : (interaction.options.getInteger('mines') || 3);
            const userId = interaction.user.id;

            const betAgainRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`mines_again_${bet}_${minesCount}`)
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

            const game = new MinesLogic(bet, minesCount, user.serverSeed, user.clientSeed, user.nonce);

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

            // Generate initial image
            const gridState = game.getGridState();
            const imageBuffer = await CanvasRenderer.drawMinesGrid(gridState, getUserData());
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'mines.png' });

            // Static content during gameplay
            const content = `💎 **Penthouse Casino | Mines**`;

            // Create buttons for the 5x5 grid (24 tiles + 1 Cash Out)
            const createButtons = (revealedIndices = []) => {
                const rows = [];

                for (let r = 0; r < 5; r++) {
                    const row = new ActionRowBuilder();
                    for (let c = 0; c < 5; c++) {
                        const index = r * 5 + c;
                        
                        // The 25th slot (index 24) is always the Cash Out button
                        if (index === 24) {
                            row.addComponents(
                                new ButtonBuilder()
                                    .setCustomId('cashout')
                                    .setLabel('💰')
                                    .setStyle(ButtonStyle.Success)
                                    .setDisabled(game.isGameOver || game.currentMultiplier <= 1)
                            );
                            continue;
                        }

                        const isRevealed = revealedIndices.includes(index);
                        const isMine = game.mines.includes(index);
                        
                        let label = `${index + 1}`;
                        let style = ButtonStyle.Primary;
                        let disabled = game.isGameOver;

                        if (isRevealed) {
                            label = isMine ? '💣' : '💎';
                            style = ButtonStyle.Secondary;
                            disabled = true;
                        } else if (game.isGameOver) {
                            label = isMine ? '💣' : '💎';
                            style = isMine ? ButtonStyle.Danger : ButtonStyle.Secondary;
                            disabled = true;
                        }

                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`tile_${index}`)
                                .setLabel(label)
                                .setStyle(style)
                                .setDisabled(disabled)
                        );
                    }
                    rows.push(row);
                }
                return rows;
            };

            const response = (isButton || isBetAgain) ? await interaction.editReply({
                content: content,
                files: [attachment],
                attachments: [], // IMPORTANT: Clear old attachments to force refresh
                components: createButtons(),
            }) : await interaction.reply({
                content: content,
                files: [attachment],
                components: createButtons(),
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 900000, // 15 minutes
            });

            collector.on('collect', async i => {
                try {
                    if (i.customId.startsWith('tile_')) {
                        const index = parseInt(i.customId.split('_')[1]);
                        const result = game.reveal(index);

                        if (!result.success) return i.reply({ content: 'Invalid move!', ephemeral: true });

                        const updatedGrid = game.getGridState();
                        const updatedImage = await CanvasRenderer.drawMinesGrid(updatedGrid, getUserData());
                        const updatedAttachment = new AttachmentBuilder(updatedImage, { name: 'mines.png' });

                        let updatedContent = `💎 **Penthouse Casino | Mines**`;

                        if (game.isGameOver) {
                            collector.stop('game_over');
                            
                            if (game.isWon) {
                                const winAmount = Math.floor(bet * game.currentMultiplier);
                                user.balance += winAmount;
                                user.totalWinnings += winAmount;
                                await user.save();
                                updatedContent = `🏆 **WINNER!** You won **$${winAmount}**! (${game.currentMultiplier.toFixed(2)}x)`;
                            } else {
                                user.totalLosses += bet;
                                await user.save();
                                updatedContent = `💥 **BUST!** You hit a mine and lost **$${bet}**.`;
                            }
                        }

                        await i.update({
                            content: updatedContent,
                            files: [updatedAttachment],
                            attachments: [],
                            components: game.isGameOver ? [betAgainRow] : createButtons(game.revealedOrder),
                        });

                    } else if (i.customId === 'cashout') {
                        game.isGameOver = true;
                        game.isWon = true;
                        collector.stop('cashout');

                        const winAmount = Math.floor(bet * game.currentMultiplier);
                        user.balance += winAmount;
                        user.totalWinnings += winAmount;
                        await user.save();

                        const finalGrid = game.getGridState();
                        const finalImage = await CanvasRenderer.drawMinesGrid(finalGrid, getUserData());
                        const finalAttachment = new AttachmentBuilder(finalImage, { name: 'mines.png' });

                        const finalContent = `💰 **CASHED OUT!** You won **$${winAmount}**! (${game.currentMultiplier.toFixed(2)}x)`;

                        await i.update({
                            content: finalContent,
                            files: [finalAttachment],
                            attachments: [],
                            components: [betAgainRow], // Show Bet Again button
                        });
                    }
                } catch (error) {
                    console.error('Mines collector error:', error);
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await interaction.editReply({ content: 'Game timed out!', components: [] }).catch(() => {});
                }
            });
        } catch (error) {
            console.error('Mines command error:', error);
        }
    },
};
