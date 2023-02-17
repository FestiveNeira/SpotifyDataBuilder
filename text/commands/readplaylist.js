module.exports = {
    name: 'readplaylist',
    secret: false,
    description: "Gets data associated with the given playlist ID",
    execute(message, args, bot) {
        if (args.length <= 3) {
            for (var i = 0; i < args.length; i++) {
                bot.getPlaylistData(args[i]);
            }
        }
    }
}