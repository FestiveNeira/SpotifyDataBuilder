module.exports = {
    name: 'scount',
    secret: false,
    description: "Counts the number of songs in the database",
    execute(message, args, bot) {
        if (args.length == 0) {
            bot.scount();
        }
    }
}