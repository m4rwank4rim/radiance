import { bot } from './bot.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function testPanel() {
    await bot.login(process.env.DISCORD_BOT_TOKEN);
    bot.once('ready', async () => {
        // elite-voice channel ID from Step 1765
        const channelId = '1491159050401087599';
        const channel = await bot.channels.fetch(channelId);

        if (channel && channel.isVoiceBased()) {
            console.log('Sending Test Panel to ' + channel.name);

            const controlEmbed = new EmbedBuilder()
                .setTitle("Voice Channel Control Panel")
                .setDescription("Verification Test: Use the buttons below to manage your private lounge.")
                .addFields(
                    { name: "Owner", value: `Radiance (Test)`, inline: true },
                    { name: "Status", value: "🔓 Public", inline: true }
                )
                .setColor('#d0bcff');

            const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('voice_rename').setEmoji('1491019634823008296').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('voice_lock').setEmoji('1491019472016900128').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('voice_unlock').setEmoji('1491019728599126076').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('voice_hide').setEmoji('1491019317305802882').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('voice_show').setEmoji('1491019697871913122').setStyle(ButtonStyle.Secondary)
            );

            const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('voice_camera').setEmoji('1491019253334409286').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('voice_music').setEmoji('1491019524940496977').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('voice_activities').setEmoji('1491019213953957888').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('voice_claim').setEmoji('1491019282170249348').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('voice_limit').setEmoji('1491019439859302420').setStyle(ButtonStyle.Secondary)
            );

            const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('voice_perms').setEmoji('1491019592884293722').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('voice_settings').setEmoji('1491019663906181280').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('voice_invite').setEmoji('1491019376571318373').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('voice_kick').setEmoji('1491019404459376701').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('voice_info').setEmoji('1491019345713692805').setStyle(ButtonStyle.Secondary)
            );

            await (channel as any).send({ embeds: [controlEmbed], components: [row1, row2, row3] });
            console.log('✅ Panel sent successfully!');
        } else {
            console.error('Channel not found or not voice based');
        }
        process.exit(0);
    });
}

testPanel();
