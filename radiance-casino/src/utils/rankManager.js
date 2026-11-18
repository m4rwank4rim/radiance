const GuildSettings = require('../models/GuildSettings');

class RankManager {
    static async checkAndAssignRank(member, user) {
        const settings = await GuildSettings.get(member.guild.id);
        const { ranks } = settings;

        // Sort ranks by threshold descending to find the highest applicable rank
        const applicableRank = [...ranks]
            .sort((a, b) => b.threshold - a.threshold)
            .find(rank => user.totalWagered >= rank.threshold);

        if (applicableRank && user.rank !== applicableRank.name) {
            user.rank = applicableRank.name;
            await user.save();

            // Handle Discord roles
            const allRankRoleIds = ranks.map(r => r.roleId).filter(id => id !== null);

            try {
                // Remove all current rank roles
                await member.roles.remove(allRankRoleIds);

                // Add the new rank role
                if (applicableRank.roleId) {
                    await member.roles.add(applicableRank.roleId);
                }
            } catch (error) {
                console.error(`Failed to update roles for user ${member.id}:`, error.message);
            }

            return applicableRank;
        }

        return null;
    }

    static async hasGameAccess(member) {
        const settings = await GuildSettings.get(member.guild.id);
        if (!settings.gameRoleId) return true; // No role restriction
        return member.roles.cache.has(settings.gameRoleId);
    }

    static async getMaxBet(member, user) {
        const settings = await GuildSettings.get(member.guild.id);
        const { ranks } = settings;

        // Find the rank that matches the user's current rank name
        const currentRank = ranks.find(r => r.name === user.rank);
        
        // If rank found, return its maxBet, otherwise return a default (1000)
        return currentRank ? (currentRank.maxBet || 1000) : 1000;
    }

    static async canPlayGame(gameName, channel) {
        if (!channel.guild) return true;
        const settings = await GuildSettings.get(channel.guild.id);

        // Check for game-specific room first (overrides category)
        if (settings.gameRooms && settings.gameRooms[gameName]) {
            const channelToCheck = channel.isThread() ? channel.parent : channel;
            return channelToCheck.id === settings.gameRooms[gameName];
        }

        // Fallback to category check
        if (!settings.gameCategoryId) return true;
        const channelToCheck = channel.isThread() ? channel.parent : channel;
        return channelToCheck && channelToCheck.parentId === settings.gameCategoryId;
    }

    static async getGameRoomName(guild, gameName) {
        const settings = await GuildSettings.get(guild.id);
        if (settings.gameRooms && settings.gameRooms[gameName]) {
            const channelId = settings.gameRooms[gameName];
            let channel = guild.channels.cache.get(channelId);
            if (!channel) {
                try {
                    channel = await guild.channels.fetch(channelId);
                } catch {
                    return null;
                }
            }
            return channel ? channel.name : null;
        }

        if (settings.gameCategoryId) {
            return this.getCategoryName(guild, settings.gameCategoryId);
        }

        return null;
    }

    static async getCategoryName(guild, categoryId) {
        if (!categoryId) return null;
        let category = guild.channels.cache.get(categoryId);
        if (!category) {
            try {
                category = await guild.channels.fetch(categoryId);
            } catch {
                return 'Unknown';
            }
        }
        return category ? category.name : 'Unknown';
    }
}

module.exports = RankManager;
