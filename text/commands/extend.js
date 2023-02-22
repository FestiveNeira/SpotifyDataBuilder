module.exports = {
    name: 'extend',
    secret: false,
    description: "Gets more data given the present data",
    execute(message, args, bot) {
        bot.loadAllArtSongs();
    }
}