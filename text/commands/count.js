module.exports = {
    name: 'count',
    secret: false,
    description: "Counts the number of songs in the database",
    execute(message, args, bot) {
        if (args.length == 0) {
            bot.count();
        }
    }
}