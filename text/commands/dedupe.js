module.exports = {
    name: 'dedupe',
    secret: false,
    description: "Removes duplicate songs across files",
    execute(message, args, bot) {
        bot.deDuplicate();
    }
}