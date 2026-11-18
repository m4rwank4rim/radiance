const Datastore = require('nedb-promises');
const path = require('path');

const usersDb = Datastore.create({
    filename: path.join(__dirname, '../../users.db'),
    autoload: true
});

const settingsDb = Datastore.create({
    filename: path.join(__dirname, '../../settings.db'),
    autoload: true
});

module.exports = {
    users: usersDb,
    settings: settingsDb
};
