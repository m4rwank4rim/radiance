const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const path = require('path');
const GuildSettings = require('../models/GuildSettings');
const db = require('../utils/database');
const LeaderboardManager = require('../utils/leaderboardManager');

function startWebServer(client) {
    const app = express();
    const PORT = process.env.DASHBOARD_PORT || 3000;

    // Passport Configuration
    passport.serializeUser((user, done) => done(null, user.username));
    passport.deserializeUser((username, done) => {
        if (username === process.env.ADMIN_USERNAME) {
            done(null, { username: process.env.ADMIN_USERNAME });
        } else {
            done(new Error('Invalid user'));
        }
    });

    passport.use(new LocalStrategy((username, password, done) => {
        if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
            return done(null, { username: process.env.ADMIN_USERNAME });
        }
        return done(null, false, { message: 'Incorrect username or password.' });
    }));

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(session({
        secret: process.env.SESSION_SECRET || 'casino-secret',
        resave: false,
        saveUninitialized: false
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    // Authentication Middleware
    const checkAuth = (req, res, next) => {
        if (req.isAuthenticated()) return next();
        res.redirect('/');
    };

    // Routes
    app.get('/', (req, res) => {
        if (req.isAuthenticated()) return res.redirect('/dashboard');
        res.render('login', { error: null });
    });

    app.post('/login', passport.authenticate('local', {
        successRedirect: '/dashboard',
        failureRedirect: '/'
    }));

    app.get('/logout', (req, res) => {
        req.logout(() => res.redirect('/'));
    });

    app.get('/dashboard', checkAuth, async (req, res) => {
        // Since it's a password-based admin dashboard, we show all guilds the bot is in
        const botGuilds = client.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon
        }));

        try {
            // Fetch real metrics from the database
            const users = await db.users.find({});
            const activePlayers = users.length;
            const totalVolume = users.reduce((sum, user) => sum + (user.totalWagered || 0), 0);

            // Format volume for display (e.g., $1.2M, $500K, or just $1,234)
            let formattedVolume = `$${totalVolume.toLocaleString()}`;
            if (totalVolume >= 1000000) {
                formattedVolume = `$${(totalVolume / 1000000).toFixed(1)}M`;
            } else if (totalVolume >= 1000) {
                formattedVolume = `$${(totalVolume / 1000).toFixed(1)}K`;
            }

            res.render('dashboard', {
                user: req.user,
                guilds: botGuilds,
                metrics: {
                    activePlayers,
                    totalVolume: formattedVolume
                }
            });
        } catch (error) {
            console.error("Failed to fetch dashboard metrics:", error);
            res.render('dashboard', {
                user: req.user,
                guilds: botGuilds,
                metrics: { activePlayers: 0, totalVolume: '$0' }
            });
        }
    });

    app.get('/guild/:id', checkAuth, async (req, res) => {
        const guildId = req.params.id;
        const guild = client.guilds.cache.get(guildId);

        if (!guild) {
            return res.status(404).send('Guild not found');
        }

        const settings = await GuildSettings.get(guildId);
        const roles = guild.roles.cache
            .filter(r => r.name !== '@everyone')
            .map(r => ({ id: r.id, name: r.name }));

        const categories = guild.channels.cache
            .filter(c => c.type === 4) // ChannelType.GuildCategory
            .map(c => ({ id: c.id, name: c.name }));

        const channels = guild.channels.cache
            .filter(c => c.type === 0) // ChannelType.GuildText
            .map(c => ({ id: c.id, name: c.name }));

        res.render('guild-settings', {
            user: req.user,
            guild,
            settings,
            roles,
            categories,
            channels
        });
    });

    app.post('/api/guild/:id/settings', checkAuth, async (req, res) => {
        const guildId = req.params.id;
        const guild = client.guilds.cache.get(guildId);

        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }

        const { gameRoleId, gameCategoryId, ranks, gameRooms, leaderboardChannelId, adminRoleId } = req.body;
        const settings = await GuildSettings.get(guildId);

        if (gameRoleId !== undefined) settings.gameRoleId = gameRoleId;
        if (gameCategoryId !== undefined) settings.gameCategoryId = gameCategoryId;
        if (ranks !== undefined) settings.ranks = ranks;
        if (gameRooms !== undefined) settings.gameRooms = gameRooms;
        if (leaderboardChannelId !== undefined) settings.leaderboardChannelId = leaderboardChannelId;
        if (adminRoleId !== undefined) settings.adminRoleId = adminRoleId;

        await settings.save();

        // If leaderboard channel was set, trigger an immediate update
        if (settings.leaderboardChannelId) {
            LeaderboardManager.updateLeaderboard(client, guildId);
        }

        res.json({ success: true });
    });

    app.listen(PORT, () => {
        console.log(`Web Dashboard running at http://localhost:${PORT}`);
    });
}

module.exports = startWebServer;
