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

class SLObj {
    constructor(keyarr, dataarr) {
        this.keys = keyarr;
        this.data = dataarr;
    }
}

class Artist {
    constructor(name, uri, id) {
        this.name = name;
        this.uri = uri;
        this.id = id;
        this.songs = [];
    }
}

class Song {
    constructor(track, features) {
        this.artists = [];

        for (var i = 0; i < track.artists.length; i++) {
            if (bot.ArtistObjects.get(track.artists[i].uri) == null) {
                bot.ArtistObjects.set(track.artists[i].uri, new Artist(track.artists[i].name, track.artists[i].uri, track.artists[i].id));
            }
            this.artists.push(track.artists[i].uri);
            var temp = bot.ArtistObjects.get(track.artists[i].uri);
            if (!temp.songs.includes(track.uri)) {
                temp.songs.push(track.uri);
            }
        }
        
        this.uri = track.uri;
        this.id = track.id;
        this.name = track.name;
        
        this.features = new Features(features);
    }
}

class Features {
    constructor(features) {
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

    testtrack: 0,

    // Channel ID for commands
    spotChannel: '1074117814853582948',
    // Channel ID for changelog
    spotLogChat: '1074117847883726848',

    songfiles: fs.readdirSync('./data/songs/').filter(file => file.endsWith('.json')),
    artfiles: fs.readdirSync('./data/artists/').filter(file => file.endsWith('.json')),
    loadedsongfileind: 0,
    loadedartfileind: 0,


    // Spotify api
    spotifyApi: new SpotifyWebApi({
        clientId: clientId,
        clientSecret: clientSecret,
        redirectUri: 'http://localhost:8880/callback'
    }),

    // Map of uris to song objects
    SongObjects: new Discord.Collection,
    ArtistObjects: new Discord.Collection,

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

    // Reloads all non feature data of objects
    reloadAllData: function () {
        for (var i = 0; i < bot.songfiles.length; i++) {
            bot.loadSongFile(i);
            bot.loadArtistFile(0);
            bot.reloadLoadedData();
        }
    },
    reloadLoadedData: function () {
        var songs = [];
        bot.SongObjects.forEach((song, key) => {
            if (key.includes("spotify:track:")) {
                songs.push(song.id);
            }
            else {
                bot.SongObjects.delete(key);
            }
        });
        var arr = [];
        for (var i = 0; i < songs.length; i += 50) {
            var temp = songs.slice(i, i + 50);
            
            arr.push(temp);
        }
        bot.fixSongs(arr, 0)
        .then(() => {
            bot.saveData();
        });
    },
    fixSongs: function (arr, ind) {
        console.log("Getting section " + (ind + 1) + " of " + arr.length);
        return new Promise ((resolve, reject) => {
            bot.spotifyApi.getTracks(arr[ind])
            .then((tracks) => {
                for (var i = 0; i < tracks.body.tracks.length; i++) {
                    if (tracks.body.tracks[i] == null) {
                        bot.SongObjects.delete(tracks.body.tracks[i]);
                    }
                    else {
                        temp = bot.SongObjects.get(tracks.body.tracks[i].uri);
                        try {
                            bot.SongObjects.set(tracks.body.tracks[i].uri, new Song(tracks.body.tracks[i], temp));
                        }
                        catch {
                            console.log("skipping");
                        }
                    }
                    console.log("Section " + ind + " updated");
                }
                if (arr.length > ind + 1) {
                    bot.fixSongs(arr, ind + 1)
                    .then(() => resolve());
                }
                else {
                    resolve();
                }
            })
            .catch((error) => {
                if (error.statusCode === 500 || error.statusCode === 502) {
                    console.log('server error')
                    // If there's a server error try again
                    bot.getArtURI(arr, ind);
                }
                else {
                    console.log("Something Went Wrong In fixSongs");
                    console.log(error);
                }
            })
        })
    },

    // -------------------- SAVING AND LOADING -------------------- //
    loadData: function () {
        // Get saved data
        for (var i = 0; i < bot.songfiles.length; i++) {
            bot.SongObjects.clear();
            var songdata = JSON.parse(fs.readFileSync('./data/songs/' + bot.songfiles[i]));
            for (var o = 0; o < songdata.keys.length; o++) {
                bot.SongObjects.set(songdata.keys[o], songdata.data[o]);
            }
            bot.loadedsongfileind = i;
        }
        for (var i = 0; i < bot.artfiles.length; i++) {
            bot.ArtistObjects.clear();
            var artdata = JSON.parse(fs.readFileSync('./data/artists/' + bot.artfiles[i]));
            for (var o = 0; o < artdata.keys.length; o++) {
                bot.ArtistObjects.set(artdata.keys[o], artdata.data[o]);
            }
            bot.loadedartfileind = i;
        }

        // Log activity
        console.log("Data Loaded");
        bot.client.channels.cache.get(bot.spotLogChat).send("Data Loaded");

        bot.saveData();
    },
    loadSongFile: function (ind) {
        // Get saved data
        if (ind < bot.songfiles.length) {
            bot.SongObjects.clear();
            var songdata = JSON.parse(fs.readFileSync('./data/songs/' + bot.songfiles[ind]));
            for (var i = 0; i < songdata.keys.length; i++) {
                bot.SongObjects.set(songdata.keys[i], songdata.data[i]);
            }
            bot.loadedsongfileind = ind;

            bot.saveData();

            // Log activity
            console.log("Song File " + ind + " Loaded");
            bot.client.channels.cache.get(bot.spotLogChat).send("Song File " + ind + " Loaded");
        }
    },
    loadArtistFile: function (ind = 0) {
        // Get saved data
        bot.ArtistObjects.clear();
        var artdata = JSON.parse(fs.readFileSync('./data/artists/' + bot.artfiles[ind]));
        for (var i = 0; i < artdata.keys.length; i++) {
            bot.ArtistObjects.set(artdata.keys[i], artdata.data[i]);
        }
        bot.loadedartfileind = ind;
        
        bot.saveData();
        
        // Log activity
        console.log("Artist File " + ind + " Loaded");
        bot.client.channels.cache.get(bot.spotLogChat).send("Artist File " + ind + " Loaded");
    },
    saveData: function () {
        var songarrs = bot.constructDataFiles(bot.SongObjects, 200000);
        var artarrs = bot.constructDataFiles(bot.ArtistObjects, 1000000);

        var songfile = './data/songs/songdata';
        var artfile = './data/artists/artdata';
        var suffix = '.json'

        // Saves data to a .json files
        for (var i = 0; i < songarrs.length; i++) {
            fs.writeFileSync((songfile + (bot.loadedsongfileind + i) + suffix), JSON.stringify(songarrs[0]), e => {
                if (e) throw e;
            });
        }
        for (var i = 0; i < artarrs.length; i++) {
            fs.writeFileSync((artfile + (bot.loadedartfileind + i) + suffix), JSON.stringify(artarrs[0]), e => {
                if (e) throw e;
            });
        }

        // If current song list is full save it and start a new one
        if (songarrs.length > 0 && songarrs[0].keys.length == 200000) {
            if (songarrs.length > 1) {
                bot.SongObjects.clear();
                songarrs[1].forEach(slo => {
                    bot.SongObjects.set(slo.key, slo.data);
                });
            }
            bot.loadedsongfileind = bot.loadedsongfileind + 1;
        }
        
        // If current artist list is full save it and start a new one
        if (artarrs.length > 0 && artarrs[0].keys.length == 1000000) {
            if (artarrs.length > 1) {
                bot.ArtistObjects.clear();
                artarrs[1].forEach(slo => {
                    bot.ArtistObjects.set(slo.key, slo.data);
                });
            }
            bot.artfiles.push(artfile + bot.loadedartfileind + suffix);
            bot.loadedartfileind = bot.loadedartfileind + 1;
        }

        // Log activity
        console.log("Data Saved");
        bot.client.channels.cache.get(bot.spotLogChat).send("Data Saved");
    },
    checkSaveNewFile: function () {
        if (bot.SongObjects.size >= 200000) {
            // Log activity
            console.log("Storage Full, Saving File");
            bot.client.channels.cache.get(bot.spotLogChat).send("Storage Full, Saving File");

            bot.saveData();
        }
    },
    constructDataFiles: function (dataarr, limit) {
        var dkeys = Array.from(dataarr.keys());
        var ddata = Array.from(dataarr.values());
        var objarr = [];
        for (var i = 0; i < dkeys.length; i += limit) {
            objarr.push(new SLObj(dkeys.slice(i, i + limit), ddata.slice(i, i + limit)));
        }
        return objarr;
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
                    if (error.statusCode === 500 || error.statusCode === 502) {
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
    getIDs: function (items, isAlbum = false) {
        var ids = [];
        if (isAlbum) {
            items.forEach(track => {
                if ((track != null && track.uri.indexOf("spotify:local") == -1) && track.uri.includes("spotify:track")) {
                    ids.push(track.id);
                }
            });
        }
        else {
            items.forEach(item => {
                if ((item.track != null && item.track.uri.indexOf("spotify:local") == -1) && item.track.uri.includes("spotify:track")) {
                    ids.push(item.track.id);
                }
            });
        }
        return ids;
    },
    // Takes a playlist id and returns a list of the uris of the songs in that playlist
    getPlaylistData: function (playid) {
        // Log activity
        console.log("Retrieving Data");
        bot.client.channels.cache.get(bot.spotLogChat).send("Retrieving Data");

        bot.saveData(bot.loadedsongfileind);
        bot.loadSongFile(bot.songfiles.length - 1);
        bot.loadArtistFile(0);

        // Get a list of uris from given playlist
        return new Promise((resolve, reject) => {
            // Create an empty list to return
            bot.getTracks(playid)
            .then((data) => {
                data.forEach(item => {
                    // Only support non-local songs
                    if (item.features != null && item.track.track != null) {
                        if (item.track.track.uri.indexOf("spotify:local") == -1 && item.track.track.uri.includes("spotify:track") && !bot.songExists(item.track.track.artists[0].uri, item.track.track.uri)) {
                            var song = new Song(item.track.track, item.features);
                            bot.SongObjects.set(song.uri, song);
                            bot.checkSaveNewFile();
                        }
                    }
                });
                bot.saveData();
                bot.scount();
                bot.acount();
            })
        })
        .catch(() => reject());
    },

    // Retrieves additional data for artists already present
    loadAllArtSongs: function (startset = 0) {
        bot.saveData(bot.loadedsongfileind);
        bot.loadSongFile(bot.songfiles.length - 1);
        bot.loadArtistFile(0);

        var uris = [];
        bot.ArtistObjects.forEach((artist, key) => {
            uris.push(artist.id);
        });
        
        var arr = [];
        for (var i = 0; i < uris.length; i += 50) {
            var temp = uris.slice(i, i + 50);
            arr.push(temp);
        }

        if (startset < arr.length) {
            bot.getData(arr, startset);
        }
    },
    // Constructs a list of lists each containing 50 artist ids
    getData: function (arr, ind) {
        console.log("Loading artist section " + (ind + 1) + " of " + arr.length);
        bot.getAlbumSets(arr[ind], 0, 0, [], [])
        .then((albums) => bot.getSongs(bot.sliceBuilder(albums, 20), 0, [], []))
        .then((dataObjects) => {
            dataObjects.forEach(item => {
                if (item.features != null && item.track != null) {
                    // Only support non-local songs
                    if (item.track.uri.indexOf("spotify:local") == -1 && item.track.uri.includes("spotify:track") && !bot.songExists(item.track.artists[0].uri, item.track.uri)) {
                        var song = new Song(item.track, item.features);
                        bot.SongObjects.set(song.uri, song);
                        bot.checkSaveNewFile();
                    }
                }
            });
            bot.saveData();
            bot.scount();
            bot.acount();
            if (ind + 1 < arr.length) {
                bot.getData(arr, ind + 1);
            }
        })
        .catch((error) => {
            if (error.statusCode === 500 || error.statusCode === 502) {
                console.log('server error')
                // If there's a server error try again
                bot.getData(arr, ind);
            }
            else if (error.statusCode === 429) {
                console.log('rate limit, retrying after ' + error.headers["retry-after"]);
                bot.delay(parseInt(error.headers["retry-after"])*1000)
                .then(() => bot.getData(arr, ind));
            }
            else {
                console.log("Something Went Wrong In getData");
                console.log(error);
            }
        });
    },
    // Iterates over a list of artists 50 at a time and gets their albums
    getAlbumSets: function (arr, ind, offind, totalbums, newalbums) {
        Array.prototype.push.apply(totalbums, newalbums);

        return new Promise ((resolve, reject) => {
            if (ind >= arr.length) {
                resolve(totalbums);
            }
            else {
                console.log("Getting artist " + (ind + 1) + " of " + arr.length);
                bot.spotifyApi.getArtistAlbums(arr[ind], {limit : 50, offset : (offind * 50)}).then((albums) => {
                    var next = false;
                    var newal = [];
                    for (var i = 0; i < albums.body.items.length; i++) {
                        newal.push(albums.body.items[i].id);
                        if (albums.body.items[i].album_group == "appears_on" || albums.body.items[i].album_group == "compilation") {
                            next = true;
                        }
                    }
                    if (albums.body.total > (offind + 1) * 50 && !next) {
                        bot.getAlbumSets(arr, ind, offind + 1, totalbums, newal)
                        .then((albums) => resolve(albums));
                    }
                    else {
                        bot.delay(500)
                        .then(() => bot.getAlbumSets(arr, ind + 1, 0, totalbums, newal))
                        .then((albums) => resolve(albums));
                    }
                })
                .catch((error) => {
                    if (error.statusCode === 500 || error.statusCode === 502) {
                        console.log('server error')
                        // If there's a server error try again
                        bot.getAlbumSets(arr, ind, offind, totalbums, []);
                    }
                    else if (error.statusCode === 429) {
                        console.log('rate limit, retrying after ' + error.headers["retry-after"]);
                        bot.delay(parseInt(error.headers["retry-after"])*1000)
                        .then(() => bot.getAlbumSets(arr, ind, offind, totalbums, []));
                    }
                    else {
                        console.log("Something Went Wrong In getAlbumSets");
                        console.log(error);
                    }
                });
            }
        });
    },
    // Retrieves song data from a list of albums
    getSongs: function (albums, ind, readObjListTotal, readObjListNew, loadedtracks = []) {
        // get tracks from album get features from tracks make song objects
        if (readObjListNew != []) {
            Array.prototype.push.apply(readObjListTotal, readObjListNew);
        }

        return new Promise ((resolve, reject) => {
            if (ind >= albums.length) {
                resolve(readObjListTotal);
            }
            else {
                console.log("Getting album set " + (ind + 1) + " of " + albums.length);
                bot.spotifyApi.getAlbums(albums[ind])
                .then((albums) => {
                    albums.body.albums.forEach(album => {
                        album.tracks.items.forEach(track => {
                            loadedtracks.push(track);
                        });
                    });
                })
                .then(() => {
                    if (loadedtracks.length >= 100 || ind == albums.length - 1) {
                        var temp = loadedtracks.splice(0, 100);
                        bot.spotifyApi.getAudioFeaturesForTracks(bot.getIDs(temp, true))
                        .then((featuresList) => {
                            var readObjList = [];
                            for (var i = 0; i < temp.length; i++) {
                                readObjList.push(new ReadObj(temp[i], featuresList.body.audio_features[i]));
                            }
                            return readObjList;
                        })
                        .then((dataList) => {
                            bot.delay(500)
                            .then(() => bot.getSongs(albums, ind + 1, readObjListTotal, dataList, loadedtracks))
                            .then((result) => resolve(result));
                        })
                    }
                    else {
                        bot.getSongs(albums, ind + 1, readObjListTotal, [], loadedtracks)
                        .then((result) => resolve(result));
                    }
                })
                .catch((error) => {
                    if (error.statusCode === 500 || error.statusCode === 502) {
                        console.log('server error')
                        // If there's a server error try again
                        bot.getSongs(albums, ind, readObjListTotal, [], loadedtracks);
                    }
                    else if (error.statusCode === 429) {
                        console.log('rate limit, retrying after ' + error.headers["retry-after"]);
                        bot.delay(parseInt((error.headers["retry-after"])*1000) + 1000)
                        .then(() => bot.getSongs(albums, ind, readObjListTotal, [], loadedtracks));
                    }
                    else {
                        console.log("Something Went Wrong In getSongs");
                        console.log(error);
                    }
                });
            }
        });
    },
    // Portions arrayys of artists, albums, and songs to prevent memory issues
    sliceBuilder: function (arr, slicesize) {
        var slices = [];
        for (var i = 0; i < arr.length; i += slicesize) {
            slices.push(arr.slice(i, i + slicesize));
        }
        return slices;
    },
    // Checks if a song exists by looking at it's artist's loaded songs
    songExists: function (auri, suri) {
        if (bot.ArtistObjects.get(auri) == null || bot.ArtistObjects.get(auri).songs.includes(suri)) {
            return true;
        }
        return false;
    },

    // Counts songs in the database
    scount: function () {
        var count = 0;
        for (var i = 0; i < bot.songfiles.length; i++) {
            bot.loadSongFile(i);
            bot.SongObjects.forEach((song, key) => {
                count++;
            });
        }

        // Log activity
        console.log("There are now " + count + " songs in the database");
        bot.client.channels.cache.get(bot.spotLogChat).send("There are now " + count + " songs in the database");
    },
    // Counts artists in the database
    acount: function () {
        var count = 0;
        for (var i = 0; i < bot.artfiles.length; i++) {
            bot.loadArtistFile(i);
            bot.ArtistObjects.forEach((artist, key) => {
                count++;
            });
        }

        // Log activity
        console.log("There are now " + count + " artists in the database");
        bot.client.channels.cache.get(bot.spotLogChat).send("There are now " + count + " artists in the database");

        if (bot.loadedartfileind != 0) {
            bot.loadArtistFile(0);
        }
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
    },

    delay: function (time) {
        return new Promise(resolve => setTimeout(resolve, time));
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
