const db = require('../utils/database');

class User {
    static async findOne(query) {
        const user = await db.users.findOne(query);
        return user ? new User(user) : null;
    }

    static find() {
        return {
            sort: (sortQuery) => {
                return {
                    limit: async (count) => {
                        const results = await db.users.find({}).sort(sortQuery).limit(count);
                        return results.map(u => new User(u));
                    }
                };
            }
        };
    }

    constructor(data) {
        Object.assign(this, data);
        // Default values for new users
        if (this.balance === undefined) this.balance = 1000;
        if (this.gamesPlayed === undefined) this.gamesPlayed = 0;
        if (this.totalWagered === undefined) this.totalWagered = 0;
        if (this.totalWinnings === undefined) this.totalWinnings = 0;
        if (this.totalLosses === undefined) this.totalLosses = 0;
        if (this.nonce === undefined) this.nonce = 0;
        if (this.clientSeed === undefined) this.clientSeed = 'default';
        if (this.rank === undefined) this.rank = 'Newbie';
    }

    async save() {
        const data = { ...this };
        delete data._id; // NeDB handles _id

        if (this._id) {
            await db.users.update({ _id: this._id }, { $set: data });
        } else {
            const saved = await db.users.insert(data);
            this._id = saved._id;
        }
        return this;
    }
}

module.exports = User;
