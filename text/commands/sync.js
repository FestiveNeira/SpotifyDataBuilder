module.exports = {
    name: 'sync',
    secret: false,
    description: "syncs artists and songs",
    execute(message, args, bot) {
        bot.syncCheck();
    }
}