module.exports = {
    name: 'extend',
    secret: false,
    description: "Gets more data given the present data",
    execute(message, args, bot) {
        if (!isNaN(parseInt(args[0])) && parseInt(args[0]) > 0) {
            bot.loadAllArtSongs(parseInt(args[0]) - 1);
        }
        else {
            bot.loadAllArtSongs();
        }
    }
}