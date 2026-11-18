const db = require('../utils/database');

class GuildSettings {
    static async get(guildId) {
        let settings = await db.settings.findOne({ guildId });
        if (!settings) {
            settings = {
                guildId,
                gameRoleId: null, // Role required to play games
                gameCategoryId: null, // Category where games are played
                gameRooms: {
                    crash: null,
                    hilo: null,
                    mines: null,
                    tower: null
                },
                leaderboardChannelId: null,
                leaderboardMessageId: null,
                adminRoleId: null,
                ranks: [
                    { name: 'Newbie', threshold: 0, roleId: null, maxBet: 1000 },
                    { name: 'Gambler', threshold: 1000, roleId: null, maxBet: 5000 },
                    { name: 'High Roller', threshold: 10000, roleId: null, maxBet: 10000 },
                    { name: 'VIP', threshold: 50000, roleId: null, maxBet: 25000 },
                    { name: 'Whale', threshold: 100000, roleId: null, maxBet: 100000 }
                ]
            };
            await db.settings.insert(settings);
        }
        return new GuildSettings(settings);
    }

    constructor(data) {
        Object.assign(this, data);
    }

    async save() {
        const data = { ...this };
        delete data._id;
        await db.settings.update({ guildId: this.guildId }, { $set: data });
    }
}

module.exports = GuildSettings;
