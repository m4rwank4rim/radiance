require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./utils/database'); // Initialize local SQLite
const CanvasRenderer = require('./utils/canvasRenderer');
const LeaderboardManager = require('./utils/leaderboardManager');
const startWebServer = require('./web/server');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();
const commands = [];

// Load Commands
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            console.log(`[INFO] Loading command: ${command.data.name}`);
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        } else {
            console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Register Slash Commands
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);
        
        // Use GUILD_ID in .env for instant updates during development
        // Otherwise, it registers global commands (which take ~1hr to update)
        const route = process.env.GUILD_ID 
            ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
            : Routes.applicationCommands(process.env.CLIENT_ID);

        const data = await rest.put(route, { body: commands });
        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();

// Events
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    await CanvasRenderer.loadIcons();
    
    // Initial update for all guilds
    for (const [guildId] of client.guilds.cache) {
        LeaderboardManager.updateLeaderboard(client, guildId);
    }

    // Periodically update the leaderboard for all guilds (every 2 minutes)
    setInterval(async () => {
        for (const [guildId] of client.guilds.cache) {
            await LeaderboardManager.updateLeaderboard(client, guildId);
        }
    }, 2 * 60 * 1000); // 2 minutes

    // Start Web Dashboard
    startWebServer(client);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    } else if (interaction.isButton()) {
        // Handle "Bet Again" buttons globally to prevent collector timeout issues
        if (interaction.customId.includes('_again_')) {
            const gameName = interaction.customId.split('_')[0]; // e.g., 'mines', 'crash'
            const command = client.commands.get(gameName);
            if (command) {
                try {
                    // Update the existing message immediately to show loading state
                    await interaction.update({
                        content: `⌛ **Preparing New Game...**`,
                        components: [],
                        files: [],
                        attachments: []
                    }).catch(() => {});
                    
                    // Mark the interaction as a button that has already been replied to
                    // so the command file uses editReply instead of deferUpdate
                    interaction.isBetAgain = true; 
                    
                    await command.execute(interaction);
                } catch (error) {
                    console.error(`Error handling bet again for ${gameName}:`, error);
                }
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
