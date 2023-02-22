module.exports = {
    name: 'reloaddata',
    secret: false,
    description: "reloads all non-feature data",
    execute(message, args, bot) {
        bot.reloadAllData();
    }
}