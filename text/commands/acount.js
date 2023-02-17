module.exports = {
    name: 'acount',
    secret: false,
    description: "Counts the number of artists in the database",
    execute(message, args, bot) {
        if (args.length == 0) {
            bot.acount();
        }
    }
}