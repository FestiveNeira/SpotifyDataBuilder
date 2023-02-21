const Discord = require("discord.js");
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const SpotifyWebApi = require('spotify-web-api-node');
const client = new Discord.Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],

    partials: [
        Partials.Channel,
        Partials.Message
    ]
})

const fs = require('fs');
const express = require('express');

const { tokenDiscord, clientId, clientSecret } = require('./data/config.json');
const { resolve } = require('path');
const e = require("express");
const { debug } = require("console");

const app = express();

// Variable used to tell if both discord and spotify have loaded is set to true when the first loads, when the second loads the bot starts
// this exists because sometimes they load in different orders so I don't know when to start doing things
var canLoad = false;

class ReadObj {
    constructor(track, features) {
        this.track = track;
        this.features = features;
    }
}

class Artist {
    constructor(name, uri, id) {
        this.name = name;
        this.uri = uri;
        this.id = id;
    }
}

class Song {
    constructor(track, features) {
        this.artists = [];

        for (var i = 0; i < track.artists.length; i++) {
            this.artists.push(new Artist(track.artists[i].name, track.artists[i].uri, track.artists[i].id));
        }
        
        this.uri = track.uri;
        this.id = track.id;
        this.name = track.name;
        
        this.duration_ms = features.duration_ms; // track duration in ms
        this.key = features.key; // 0 = C, 1 = C#/Db, 2 = D, 3 = D#/Eb, 4 = E, 5 = F, 6 = F#/Gb, 7 = G, 8 = G#/Ab, 9 = A, 10 = A#/Bb, 11 = B
        this.mode = features.mode; // 1 major key, 0 minor key
        this.tempo = features.tempo; // track tempo in bpm
        this.time_signature = features.time_signature; // unclear after testing
        
        this.acousticness = features.acousticness; // 1 more acoustic, 0 less acoustic
        this.danceability = features.danceability; // 1 more dancey, 0 less dancey
        this.energy = features.energy; // 1 energy, 0 less energy
        this.instrumentalness = features.instrumentalness; // 1 more instrumental, 0 less instrumental
        this.liveness = features.liveness; // performed live 1 is high likelihood, 0 is low likelihood
        this.loudness = features.loudness; // how loud the track is in dB
        this.speechiness = features.speechiness; // 1 more wordy, 0 less wordy
        this.valence = features.valence; // 1 positive vibes, 0 negative vibes
    }
}

var bot = {
    tokenDiscord: tokenDiscord,
    prefix: '-',
    client: client,
    channelTypes: ['dm', 'text'],
    messageTypes: ['commands', 'generics', 'specials'],
    botID: '1073300774781726740',

    // Channel ID for commands
    spotChannel: '1074117814853582948',
    // Channel ID for changelog
    spotLogChat: '1074117847883726848',

    // Spotify api
    spotifyApi: new SpotifyWebApi({
        clientId: clientId,
        clientSecret: clientSecret,
        redirectUri: 'http://localhost:8880/callback'
    }),

    // Data file
    dataFile: "./data/data.csv",

    // Map of uris to song objects
    SongObjects: new Discord.Collection,

    // ----------------------- INITIAL LOAD ----------------------- //
    // Runs with on ready
    startup: function () {
        // Log activity
        console.log("Bot Logged Into Discord");

        bot.loadData();

        // Start loading stuff if spotify and discord are both loaded
        if (canLoad) {
            bot.startupSpotify();
        }
        else {
            canLoad = true;
        }
    },
    // Load Spotify
    startupSpotify: function () {
        // Log activity
        console.log("Bot Loaded");
        bot.client.channels.cache.get(bot.spotLogChat).send("Bot Loaded");
    },
    // ------------------------------------------------------------ //

    /*
    fixArtURI: function () {
        var songs = []
        bot.SongObjects.forEach((song, key) => {
            if (key.includes("spotify:track:")) {
                songs.push(song.id);
            }
            else {
                bot.SongObjects.set(key, null);
            }
        });
        var arr = [];
        for (var i = 0; i < songs.length; i += 50) {
            var temp = songs.slice(i, i + 50);
            
            arr.push(temp);
        }
        bot.getArtURI(arr, 0);
    },

    getArtURI: function (arr, ind) {
        console.log("Getting section " + ind + " of " + arr.length);
        return new Promise ((resolve, reject) => {
            bot.spotifyApi.getTracks(arr[ind])
            .then((tracks) => {
                for (var i = 0; i < tracks.body.tracks.length; i++) {
                    if (tracks.body.tracks[i] == null) {
                        bot.SongObjects.set(tracks.body.tracks[i], null);
                    }
                    else {
                        for (var o = 0; o < tracks.body.tracks[i].artists.length; o++) {
                            temp = bot.SongObjects.get(tracks.body.tracks[i].uri);
                            temp.artists = [];
                            try {
                                temp.artists.push(new Artist(tracks.body.tracks[i].artists[o].name, tracks.body.tracks[i].artists[o].uri, tracks.body.tracks[i].artists[o].id))
                            } catch (error) {
                                console.log("fuck");
                            }
                        }
                    }
                    console.log("Section " + ind + " updated");
                }
                if (arr.length > ind + 1) {
                    bot.getArtURI(arr, ind + 1)
                    .then(() => resolve());
                }
                else {
                    resolve();
                }
            })
            .catch((error) => {
                if (error.statusCode === 500 || error.statusCode === 502 || error.statusCode === 429) {
                    console.log('server error')
                    // If there's a server error try again
                    bot.getArtURI(arr, ind);
                }
                else {
                    console.log("Something Went Wrong In getArtURI");
                    console.log(error);
                }
            })
        })
    },
    //*/

    loadAllArtSongs: function () {
        var uartists = new Discord.Collection;
        bot.SongObjects.forEach((song, key) => {
            song.artists.forEach(artist => {
                uartists.set(artist.uri, artist);
            });
        });

        var arr = [];
        for (var i = 0; i < uartists.length; i += 50) {
            var temp = uartists.slice(i, i + 50);
            arr.push(temp);
        }
        bot.getAlbums(arr, 0, [], [])
        .then((albums) => bot.getSongs(albums, 0))
        .then((dataObjects) => {
            data.forEach(item => {
                // Only support non-local songs
                if (item.features != null && item.track.track != null) {
                    if (item.track.track.uri.indexOf("spotify:local") == -1) {
                        var song = new Song(item.track.track, item.features);
                        bot.SongObjects.set(song.uri, song);
                    }
                }
            });
            bot.saveData();
            bot.count();
        })
        .catch(() => reject())
    },

    getAlbums: function (arr, ind, totalbums, newalbums) {
        console.log("Getting artist " + ind + " of " + arr.length);
        Array.prototype.push.apply(totalbums, newalbums);

        return new Promise ((resolve, reject) => {
            if (ind >= arr.length) {
                resolve(totalbums);
            }
            else {
                bot.spotifyApi.getArtistAlbums(arr[ind]).then((albums) => {
                    for (var i = 0; i < albums.body.items.length; i++) {
                        newalbums.push(albums.body.items[i].id);
                    }
                    bot.getAlbums(arr, ind + 1, totalbums, newalbums)
                    .then((albums) => resolve(albums));
                })
                .catch((error) => {
                    if (error.statusCode === 500 || error.statusCode === 502 || error.statusCode === 429) {
                        console.log('server error')
                        // If there's a server error try again
                        bot.getAlbums(arr, ind);
                    }
                    else {
                        console.log("Something Went Wrong In getAlbums");
                        console.log(error);
                    }
                });
            }
        });
    },

    getSongs: function (albums, ind) {
        // get tracks from album get features from tracks make song objects
        var loadedtracks = [];
        if (ind < albums.length) {
            bot.spotifyApi.getAlbumTracks(albums[ind])
            .then((tracks) => {
                tracks.body.items.forEach(track => {
                    loadedtracks.push(track);
                });
            })
            .then(() => {
                if (loadedtracks.length >= 100) {
                    var temp = loadedtracks.splice(0, 100);
                    bot.spotifyApi.getAudioFeaturesForTracks(bot.getIDs(temp))
                    .then((featuresList) => {
                        var readObjList = [];
                        for (var i = 0; i < temp.length; i++) {
                            readObjList.push(new ReadObj(temp[i], featuresList.body.audio_features[i]));
                        }
                        return readObjList;
                    })
                    .then((result) => resolve(result))
                }
            });
        }
    },

    // -------------------- SAVING AND LOADING -------------------- //
    loadData: function () {
        // Get saved data
        var file = './data/data.json';
        var data = JSON.parse(fs.readFileSync(file));

        for (var i = 0; i < data.keys.length; i++) {
            bot.SongObjects.set(data.keys[i], data.songs[i]);
        }

        // Log activity
        console.log("Data Loaded");
        bot.client.channels.cache.get(bot.spotLogChat).send("Data Loaded");

        bot.saveData();
    },
    saveData: function () {
        // Create a wrapper for saving data
        var data = {
            keys: Array.from(bot.SongObjects.keys()),
            songs: Array.from(bot.SongObjects.values())
        }

        var file = './data/data.json';

        // Saves data to a .json file
        fs.writeFileSync(file, JSON.stringify(data), e => {
            if (e) throw e;
        });

        // Log activity
        console.log("Data Saved");
        bot.client.channels.cache.get(bot.spotLogChat).send("Data Saved");
    },
    // ------------------------------------------------------------ //

    // ------------ GETTING AND CONVERTING INFORMATION ------------ //
    // Takes a playlist id and returns a promise that resolves to a list of spotify songs
    getTracks: function (playlistID) {
        // Return a promise
        return new Promise((resolve, reject) => {
            // Get playlist data from API
            bot.spotifyApi.getPlaylist(playlistID)
                // Send the length of the playlist into readTracks so that it knows how much to scan
                .then((playlistInfo) => bot.readTracks(playlistInfo.body.tracks.total, playlistID))
                // Resolve the tracks back out to the promise
                .then((tracks) => resolve(tracks))
                // Error handling 
                .catch(function (error) {
                    if (error.statusCode === 500 || error.statusCode === 502) {
                        // If there's a server error try again
                        bot.getTracks(playlistID)
                            // Resolve with results of successful attempt
                            .then((tracks) => resolve(tracks))
                    }
                    else {
                        console.log("Something Went Wrong In getTracks");
                        console.log(error);
                    }
                });
        });
    },
    // Songs can only be loaded 100 at a time so this helper function is used to assist the above function
    readTracks: function (goal, playlistID, totTracks = [], newTracks = []) {
        // Add the next batch of tracks onto the total list of tracks
        Array.prototype.push.apply(totTracks, newTracks);

        if (totTracks.length < goal) {
            // Log activity
            console.log("Reading Chunk " + (1 + Math.floor(totTracks.length / 100)) + "/" + (Math.ceil(goal / 100)));
        }

        // Return a promise 
        return new Promise((resolve, reject) => {
            // If we have read all tracks, resolve with the tracks
            if (totTracks.length == goal) {
                resolve(totTracks);
            }
            else {
                // Get the next batch of tracks
                bot.spotifyApi.getPlaylistTracks(playlistID, { offset: totTracks.length })
                    .then((tracksInfo) => {
                        bot.spotifyApi.getAudioFeaturesForTracks(bot.getIDs(tracksInfo.body.items))
                        .then((featuresList) => {
                            var readObjList = [];
                            for (var i = 0; i < tracksInfo.body.items.length; i++) {
                                readObjList.push(new ReadObj(tracksInfo.body.items[i], featuresList.body.audio_features[i]));
                            }
                            return readObjList;
                        })
                        // Pass that next batch into the next step of readTracks (recurs until complete list is read)
                        .then((dataList) => bot.readTracks(goal, playlistID, totTracks, dataList))
                        // Resolve the tracks and pass them up the recursion chain
                        .then((result) => resolve(result))
                    })
                    // Error handling
                    .catch(function (error) {
                        if (error.statusCode === 500 || error.statusCode === 502 || error.statusCode === 429) {
                            console.log('server error')
                            // If there's a server error try again
                            bot.getTracks(playlistID)
                                // Resolve with results of successful attempt
                                .then((tracks) => resolve(tracks))
                        }
                        else {
                            console.log("Something Went Wrong In readTracks");
                            console.log(error);
                        }
                    });
            }
        })
    },
    getIDs: function (items) {
        var ids = [];
        items.forEach(item => {
            if (item.track != null && item.track.uri.indexOf("spotify:local") == -1) {
                ids.push(item.track.id);
            }
        });
        return ids;
    },
    // Takes a playlist id and returns a list of the uris of the songs in that playlist
    getPlaylistData: function (playid) {
        // Log activity
        console.log("Retrieving Data");
        bot.client.channels.cache.get(bot.spotLogChat).send("Retrieving Data");

        // Get a list of uris from given playlist
        return new Promise((resolve, reject) => {
            // Create an empty list to return
            bot.getTracks(playid)
                .then((data) => {
                    data.forEach(item => {
                        // Only support non-local songs
                        if (item.features != null && item.track.track != null) {
                            if (item.track.track.uri.indexOf("spotify:local") == -1) {
                                var song = new Song(item.track.track, item.features);
                                bot.SongObjects.set(song.uri, song);
                            }
                        }
                    });
                    bot.saveData();
                    bot.count();
                })
        })
            .catch(() => reject());
    },
    // Counts songs in the database
    count: function () {
        var count = 0;
        bot.SongObjects.forEach((song, key) => {
            count++;
        });

        // Log activity
        console.log("There are now " + count + " songs in the database");
        bot.client.channels.cache.get(bot.spotLogChat).send("There are now " + count + " songs in the database");
    },
    // Counts artists in the database
    acount: function () {
        var artcount = new Discord.Collection;

        bot.SongObjects.forEach((song, key) => {
            song.artists.forEach(artist => {
                if (artcount.get(artist.uri) == null) {
                    artcount.set(artist.uri, 1);
                }
                else {
                    artcount.set(artist.uri, artcount.get(artist.uri) + 1);
                }
            });
        });

        var count = 0;
        artcount.forEach((song, key) => {
            count++;
        });

        // Log activity
        console.log("There are now " + count + " artists in the database");
        bot.client.channels.cache.get(bot.spotLogChat).send("There are now " + count + " artists in the database");
    },
    // ------------------------------------------------------------ //

    // --------------------- HELPER FUNCTIONS --------------------- //
    // Calls helper functions
    helpers: function (name, params) {
        // Check if the helper exists
        if (client.things.get('helpers').get(name) != undefined) {
            // Run the helper
            var out = client.things.get('helpers').get(name).execute(params, this);

            if (out != undefined) {
                return out;
            }
        }
    }

    // ------------------------------------------------------------ //
}

client.things = new Discord.Collection();
// Sets up the text and dm folders
bot.channelTypes.forEach(channelType => {
    bot.messageTypes.forEach(messageType => {
        client.things.set(channelType + messageType, new Discord.Collection());

        var directory = './' + channelType + '/' + messageType + '/';

        const files = fs.readdirSync(directory).filter(file => file.endsWith('.js'));
        for (const file of files) {
            const command = require(directory + `${file}`);

            if (channelType + messageType === 'dmspecials' || channelType + messageType === 'textspecials') {
                client.things.get(channelType + messageType).set(command.id, command);
            }
            else {
                client.things.get(channelType + messageType).set(command.name, command);

                if (command.alt != undefined) {
                    client.things.get(channelType + messageType).set(command.alt, command);
                }
            }
        }
    })
});

// Sets up the helper folder
client.things.set('helpers', new Discord.Collection());
var directory = './helpers/';
const files = fs.readdirSync(directory).filter(file => file.endsWith('.js'));
for (const file of files) {
    const command = require(directory + `${file}`);

    client.things.get('helpers').set(command.name, command);

    if (command.alt != undefined) {
        client.things.get('helpers').set(command.alt, command);
    }
};

// When bot loads
client.once('ready', () => {
    bot.startup();
});

// For bot commands
client.on('messageCreate', message => {
    // Ignore messages from itself
    if (message.author.bot) return;
    if (!message.guild) {
        // On dm receive
    }
    // The message is in a text channel
    else if (message.channel.type === 0) {
        // If the message starts with prefix
        if (message.content.startsWith(bot.prefix)) {
            // Splits the message into words after the prefix
            const args = message.content.slice(bot.prefix.length).split(/ +/);

            // The first word in the message following the prefix
            const command = args.shift().toLowerCase();

            // Check if the command is in the list
            if (client.things.get('textcommands').get(command) != undefined) {
                // Run the command
                client.things.get('textcommands').get(command).execute(message, args, bot);
            }
        }
    }
});

// Spotify login things
const scopes = [
    'ugc-image-upload',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'app-remote-control',
    'user-read-email',
    'user-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-read-private',
    'playlist-modify-private',
    'user-library-modify',
    'user-library-read',
    'user-top-read',
    'user-read-playback-position',
    'user-read-recently-played',
    'user-follow-read',
    'user-follow-modify'
];

app.get('/login', (req, res) => {
    res.redirect(bot.spotifyApi.createAuthorizeURL(scopes));
});

app.get('/callback', (req, res) => {
    const error = req.query.error;
    const code = req.query.code;
    const state = req.query.state;

    if (error) {
        console.error('Callback Error:', error);
        res.send(`Callback Error: ${error}`);
        return;
    }

    bot.spotifyApi
        .authorizationCodeGrant(code)
        .then(data => {
            const access_token = data.body['access_token'];
            const refresh_token = data.body['refresh_token'];
            const expires_in = data.body['expires_in'];

            bot.spotifyApi.setAccessToken(access_token);
            bot.spotifyApi.setRefreshToken(refresh_token);

            console.log(
                `Successfully retrieved access token. Expires in ${expires_in} s.`
            );
            res.send("Success! You can now close the window.");

            // Log activity
            console.log("Bot Logged Into Spotify");

            // Start loading stuff if spotify and discord are both loaded
            if (canLoad) {
                bot.startupSpotify();
            }
            else {
                canLoad = true;
            }

            setInterval(async () => {
                const data = await bot.spotifyApi.refreshAccessToken();
                const access_token = data.body['access_token'];

                console.log("The access token has been refreshed!");
                bot.spotifyApi.setAccessToken(access_token);
            }, expires_in / 2 * 1000);
        })
        .catch(error => {
            console.error("Error getting Tokens:", error);
            res.send(`Error getting Tokens: ${error}`);
        });
});

app.listen(8880, () =>
    console.log(
        "HTTP Server up. Now go to http://localhost:8880/login in your browser."
    )
);

client.login(bot.tokenDiscord);

console.log("SpotDataBuilder v1.0.0");
