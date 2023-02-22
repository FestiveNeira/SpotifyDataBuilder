module.exports = {
    name: 'fix',
    secret: false,
    description: "Gets data associated with the given playlist ID",
    execute(message, args, bot) {
        bot.reloadAllData();
    }
}