
console.log('Running version 1.0');

const {promisify} = require('util');
    mumble = require('./mumble_modified'),
    fs = require('fs'),
    //youtubeStream = require('youtube-audio-stream'),
    youtubeStream = require('./yas_modified2.js'),
    Decoder = require('lame').Decoder,
    search = promisify(require('youtube-search')),
    duration = require('./YT_duration.js'),
    shuffle = require('shuffle-array'),
    Messenger = require('./ttoc_messenger.js'),
    submission = Messenger.submission,
    handleTree = Messenger.handleTree,
    GM = require('./groupme_bot.js'),
    startListener = GM.startListener,
    checkGroup = GM.checkGroup;

const parameters = {
    server: "mumble.koalabeast.com",
    username: "LoveBot",
    password: "",
    home: 10338, // this does nothing unless you uncomment the moveToChannel command in onInit
    commandChars: ["!"],
    YTKey: fs.readFileSync('YTKey.txt', "utf8"),
    banned: JSON.parse(fs.readFileSync('banned.json', "utf8")),
    staff: JSON.parse(fs.readFileSync('staff.json', "utf8")),
    log: fs.createWriteStream("logfile.txt", {flags:'a'}),
    feelGood: JSON.parse(fs.readFileSync('feelGood.json', "utf8")),
    oneHitWonders: JSON.parse(fs.readFileSync('oneHitWonders.json', "utf8")),
    restricted: false,
    maxLengthAll: 600, // max length of song for everyone is 10 minutes (600 seconds)
    maxLengthStaff: 3600, // max length of song for staff level 3 is 1 hour (3600 seconds)
    playlistLimit: 100, // max number of search queries stored in a single user's playlist
};

let options = {
    key: fs.readFileSync( 'key.pem' ),
    cert: fs.readFileSync( 'crt.pem' )
};

let playlists;
try {
    playlists = JSON.parse(fs.readFileSync('playlists.json', "utf8"));
} catch(err) {
    playlists = {};
    fs.writeFileSync('playlists.json', JSON.stringify(playlists));
}



let onInit = function() {
    process.env.TZ = "America/New_York"
    console.log( 'Connection initialized' );
    //conn.user.moveToChannel(conn.channelById(parameters.home));
    conn.on( 'message', onMessage)
    stream = conn.inputStream();
    conn.connection.setBitrate(48000);
    setComment(comment);

    checkQueue();

    // start groupme bot things
    startListener();
    //checkGroup();
};

let onVoice = function( voice ) {
    console.log( 'Mixed voice' );

    let pcmData = voice;
};

let onMessage = function(message, user, scope ) {
    parseCommand(message, user, scope);
};

let parseCommand = function(message, user, scope) {
    if(scope !== "channel" && scope !== "private") return handleTree(message, user, scope);
    if (!parameters.commandChars.includes(message[0])) return;
    if(checkBanned(user.name)) {
        userMessage(user, "<br>You are banned from using this bot.");
        return;
    }
    let cmd = message.substr(0, message.indexOf(' ')),
        params = message.substr(message.indexOf(' ') + 1);
    if(cmd === "") {
        cmd = params;
        params = "";
    }
    cmd = cmd.substr(1);
    if(cmd !== "move" && user.channel !== conn.user.channel) return;
    if(!commands[cmd]) return channelMessage(cmd + " is not a command.");
    try {
        log(user.name, user.id, scope, cmd, params);
        commands[cmd].exec(params, user, scope);
    } catch (exception) {
        console.log(exception);
    }
};

////////////////////////////////
///////   BOT COMMANDS   ///////
////////////////////////////////


let addStaff = function(params, user, scope) {
    if(!checkStaff(user.name, 2)) return userMessage(user, "<br>Only staff members level 2 or lower can add staff.");
        
    let userNameToAdd = params.split(' ')[0],
        levelToAdd = Number(params.split(' ')[1]),
        userLevel = parameters.staff[user.name].level;
    
    if(!findUser(userNameToAdd)) return channelMessage(userNameToAdd + " was not found.");

    if(levelToAdd == undefined || userNameToAdd == undefined) {
        channelMessage("Command was malformed. Use: !addstaff Username level");
        return;
    }
    if(userLevel > levelToAdd || levelToAdd < 2) {
        userMessage(user, "You cannot add staff at level " + levelToAdd);
        return;
    }

    let currentStaff = parameters.staff[userNameToAdd];
    if(currentStaff && isSuperior(user.name, userNameToAdd)) {
        return userMessage(user, "You cannot alter senior staff members.");
    }
    
    let rankToAdd = findMaxRank(parameters.staff) + 1
    parameters.staff[userNameToAdd] = {
        level: levelToAdd,
        rank: rankToAdd
    }
    saveStaff(parameters.staff, "staff.json");
    channelMessage(userNameToAdd + " was added to staff at level " + levelToAdd);
}

let addToPlaylist = function(params, user, scope) {
    if(!checkStaff(user.name, 3) && parameters.restricted) return userMessage(user, "Only staff may add songs to playlist while bot is in restricted mode.");
    let requests = params.split(","),
        requestsLength = requests.length,
        userPlaylist = playlists[user.name] || [],
        playlistLength = userPlaylist.length; 
    if(requestsLength === 0) return userMessage(user, "No search terms found in your request.");
    if(requestsLength > parameters.playlistLimit || (playlistLength + requestsLength) > parameters.playlistLimit) return userMessage(user, "The maximum number of items in a playlist is " + parameters.playlistLimit);
    userPlaylist = userPlaylist.concat(requests);
    playlists[user.name] = userPlaylist;
    userMessage(user, "Added " + requestsLength + " item" + (requestsLength===1 ? "" : "s") + " to your playlist.");
    savePlaylists();
}

let addToQueue = function(user, request) {
    let numSongs = queue.length;
    console.log(user.name);
    userMessage(user, "<br>Added " + request.title + " to queue." + "<br>Duration: " + request.dur.formatted + "<br>There " + (numSongs === 1 ? "is " : "are ") + numSongs + (numSongs === 1 ? " song" : " songs") + " ahead of yours.");
    queue.push(request);
    return true;
}

let banUser = function(params, user, scope) {
    if(!checkStaff(user.name, 2)) return userMessage(user, "<br>Only staff members level 2 or lower can ban users.");
    
    let userNameToBan = params.split(' ')[0];

    if(!findUser(userNameToBan)) return channelMessage(userNameToBan + " was not found.");

    let staffUser = parameters.staff[userNameToBan];
    if(staffUser && !isSuperior(user.name, userNameToBan)) return userMessage(user, "<br>You can not ban senior staff members.");
    
    parameters.banned.push(userNameToBan);
    saveBanned(parameters.banned, "banned.json");
    channelMessage(userNameToBan + " was added to the ban list.");
}

let channelMessage = function(message) {
    conn.sendMessage(message, {channel_id: conn.user.channel.id})
}

let checkBanned = function(username) {
    return (parameters.banned.includes(username))
}

let checkPlaylists = async function() {
    let plist,
        inQueue,
        searchterm,
        finished,
        user;
    for(let username in playlists) {
        plist = playlists[username];
        inQueue = false;
        queue.forEach(request => {
            if(request.username === username) {
                inQueue = true;
            }
        });
        if(inQueue) continue;
        searchterm = plist.shift();
        if(searchterm) {
            user = conn.userByName(username);
            finished = await searchYT(user || {name: username, id: "playlist"}, searchterm);
        } else {
            delete(playlists[username]);
        }
        savePlaylists();
    }
    return finished;
}

let checkQueue = function() {
    checkPlaylists().then(() => {
        if(parameters.isPlaying || stream._writableState.writing) {
            if(conn.user.channel.users.length < 2) stop("", conn.user, null);
        } else if(queue.length != 0) {
            playNext(queue[0]);
            queue.shift();
        }
        setTimeout(checkQueue, 1000);
    });
}

let checkStaff = function(username, level) {
    let staffUser = parameters.staff[username];
    return (staffUser && staffUser.level <= level);
}

let clearPlaylist = function(params, user, scope) {
    if(!checkStaff(user.name, 3) && params !== "") return userMessage(user, "Only staff members can clear other users' playlists.");
    let userNameToRemove = params === "" ? user.name : params;
    delete(playlists[userNameToRemove]);
    savePlaylists();
    channelMessage("<b>" + userNameToRemove + "</b>'s playlist was cleared.");
}

let displayCurrent = function(params, user, scope) {
    if(!parameters.isPlaying) return channelMessage("Nothing is playing right now.");
    if(!checkStaff(user.name, 3) && parameters.restricted) return userMessage(user, "Only staff may request current song while bot is in restricted mode.");
    let prefix = parameters.paused ? '<br><font color="red"><b>PAUSED: </b></font>' : '<br>Currently playing ';
    channelMessage(prefix + currentSong.title + '<br>Duration: ' + currentSong.dur.formatted + 
                                                '<br>Requested by ' + currentSong.username + 
                                                '<br><img src = "' + currentSong.images.small + '"></img>' +
                                                '<br><a href="https://www.youtube.com/watch?v=' + currentSong.id + '">Link</a>');
}

let feelGood = function(params, user, scope) {
    if(!checkStaff(user.name, 3) && parameters.restricted) return userMessage(user, "Only staff members may feel good while the bot is in restricted mode.");
    let thisRequest = shuffle(parameters.feelGood).slice(0, 100).join(', ');
    addToPlaylist(thisRequest, conn.user, null);
    userMessage(user, "I've added 100 random feelgood songs to my queue. :)");
    return
}

let findMaxRank = function(staff) {
    let maxRank = 0;
    for(key in staff) {
        let thisRank = staff[key].rank;
        if(thisRank && thisRank > maxRank) maxRank = thisRank;
    }
    return maxRank;
}

let findUser = function(username) {
    let users = conn.users(),
        userFound = false;
    
    users.forEach(user => {
        if(user.name === username) {
            userFound = true;
        }
    });
    return(userFound);
}

let getAudio = function (id) {
  let requestUrl = 'http://youtube.com/watch?v=' + id;
  try {
    decoder = new Decoder();
    decoder.on("format", format => {
        console.log(format);
        stream = conn.inputStream({
            channels: format.channels,
            sampleRate: format.sampleRate,
            gain: gain
        })
        decoder.pipe(stream);
    });
    decoder.on("finish", res => {
        setComment(comment);
        parameters.isPlaying = false;
    });
    ytStream = youtubeStream(requestUrl);
    ytStream.pipe(decoder);
  } catch (exception) {
    console.log(exception);
    console.log(id + " is not a valid id");
  }
}

let gmAnnouncement = function(params, user, scope) {
    if(checkStaff(user.name, 1)) {
        GM.announcement(params);
    }
}

let isSuperior = function(actor, recipient) {
    actor = parameters.staff[actor];
    recipient = parameters.staff[recipient];
    if(actor.level > recipient.level) return false;
    if(actor.level === recipient.level && actor.rank > recipient.rank) return false;
    return true;
}

let isTooLong = function(user, request) {
    if(!checkStaff(user.name, 3) && request.dur.seconds > parameters.maxLengthAll)  {
        channelMessage("Only staff may request songs longer than " + parameters.maxLengthAll / 60.0 + " minutes.");
        return true;
    } else if(!checkStaff(user.name, 2) && request.dur.seconds > parameters.maxLengthStaff) {
        channelMessage("Only staff level 2 or lower can request songs longer than " + parameters.maxLengthStaff / 60.0 + " minutes.");
        return true;
    } else {
        return false;
    }
}

let listBanned = function(params, user, scope) {
    if(parameters.restricted && !checkStaff(user.name, 3)) {
        userMessage(user, "<br>Must be a member of the staff to use that command when the bot is in restricted mode.");
        return;
    }
    if(parameters.banned.length === 0) return channelMessage("Banned list is empty.");
    let message = "";
    parameters.banned.forEach(user => { message += '<br>' + user });
    channelMessage(message);
}

let listStaff = function(params, user, scope) {
    if(parameters.restricted && !checkStaff(user.name, 3)) {
        userMessage(user, "<br>Must be a member of the staff to request staff list when the bot is in restricted mode.");
        return;
    }
    let staffArray = sortStaff(JSON.parse(JSON.stringify(parameters.staff)));
    let staffMessage = '<table style="width:100%"><tr><th>Name</th><th>Level</th><th>Rank</th></tr>';
    for(let member of staffArray) {
        staffMessage = staffMessage + '<tr><td>' + member.name + '</td><td>' + member.level + '</td><td>' + member.rank + '</td></tr>'
    }
    staffMessage = staffMessage + '</table>';
    channelMessage(staffMessage);
}

let log = function(username, userID, scope, cmd, params) {
    parameters.log.write(new Date().toLocaleString() + '\t' + username + '\t' + userID + '\t' + scope + '\t' + cmd + '\t' + params + '\n');
}

let moveToUser = function(params, user, scope) {
    let level = 3;
    if(checkStaff(user.name, level)) {
        conn.user.moveToChannel(user.channel);
    } else {
        userMessage(user, "<br>Sorry, you must be a level " + level + " or lower staff member to move this bot.");
    }
}

let oneHitWonders = function(params, user, scope) {
    if(!checkStaff(user.name, 3) && parameters.restricted) return userMessage(user, "Only staff members may use this while the bot is in restricted mode.");
    let thisRequest = shuffle(parameters.oneHitWonders).slice(0, 100).join(', ');
    console.log(thisRequest);
    addToPlaylist(thisRequest, conn.user, null);
    userMessage(user, "I've added 100 random one hit wonders to my queue. :)");
    return
}

let pause = function(params, user, scope) {
    if(!checkStaff(user.name, 3) && parameters.restricted) return userMessage(user, "<br>You must be a staff member to pause/resume when the bot is in restricted mode.");
    if(!parameters.paused) {
        decoderPipe = decoder._readableState.pipes;
        parameters.paused = true;
        setComment('<span style="color:green;font-size:xx-large">PAUSED</span><br><br>' + comment);
        decoder.unpipe();
    }
}

let playNext = function(request) {
    let message = "<br>Now playing " + request.title + "<br>"; 
    channelMessage(message + "Duration: " + request.dur.formatted + "<br>requested by " + request.username);
    setComment('<span style="color:green;font-size:xx-large">' + message + '</span><br>' + comment);
    parameters.isPlaying = true;
    currentSong = request;
    getAudio(request.id);
} 

let removeBan = function(params, user, scope) {
    if(!checkStaff(user.name, 2)) return userMessage(user, "<br>Only staff members level 2 or lower can unban users.");
    
    let userNameToUnban = params.split(' ')[0];
    if(userNameToUnban === "") return channelMessage("Must provide a user to unban.");

    let staffUser = parameters.staff[userNameToUnban];
    if(staffUser && !isSuperior(user.name, userNameToUnban)) return userMessage(user, "<br>You can not ban senior staff members.");
    
    let bannedIndex = parameters.banned.indexOf(userNameToUnban);
    if(bannedIndex < 0) return channelMessage(userNameToUnban + " was not in the ban list.");

    parameters.banned.splice(bannedIndex, 1);
    saveBanned(parameters.banned, "banned.json");
    channelMessage(userNameToUnban + " was removed from the ban list.");
}

let removeSong = function(params, user, scope) {
    if(!checkStaff(user.name, 3) && parameters.restricted) return userMessage(user, "Only staff can remove songs from the queue when the bot is in restricted mode.");
    if(!checkStaff(user.name, 2) && params !== "") return userMessage(user, "Only staff level 2 or lower can remove other users' songs from the queue.");
    if(queue.length === 0) return channelMessage("Queue is empty.");
    let userNameToRemove = params === "" ? user.name : params,
        index;
    for(let i in queue) {
        if(queue[i].username === userNameToRemove) {
            index = i;
            break;
        }
    }
    if(!index) return channelMessage("No song in queue from user: " + userNameToRemove);
    queue.splice(index, 1);
    channelMessage("Song from <b>" + userNameToRemove + "</b> was removed from queue.");
}

let removeStaff = function(params, user, scope) {
    if(!checkStaff(user.name, 2)) {
        userMessage(user, "<br>Only staff members level 2 or lower can remove staff.");
        return;
    }
    let userNameToRemove = params.split(' ')[0],
        requestingUser = parameters.staff[user.name],
        userLevel = requestingUser.level,
        userRank = requestingUser.rank;
    if(userNameToRemove == undefined) {
        channelMessage("Command was malformed. Use: !removestaff Username");
        return;
    }
    let userToRemove = parameters.staff[userNameToRemove];
    if(userToRemove == undefined) {
        channelMessage(userNameToRemove + " is not a staff member.");
        return;
    }
    if(userLevel > userToRemove.level || userToRemove.level < 2) {
        userMessage(user, "You cannot remove staff at level " + userToRemove.level);
        return;
    } else if(userLevel === userToRemove.level && userRank > userToRemove.rank) {
        userMessage(user, "You cannot remove staff at the same level who are more senior than yourself.");
        return;
    }

    delete(parameters.staff[userNameToRemove]);
    saveStaff(parameters.staff, "staff.json");
    channelMessage(userNameToRemove + " was removed from staff.");
}

let requestSong = function(params, user, scope) {
    return channelMessage("<br><font style=\"color: red\">The !request command is deprecated. Please use !add instead, which creates a personal playlist for you. \
Songs on your playlist will be added to the queue one at a time in the order you added them. Look at my comment for \
other playlist commands.</font>");
    if(parameters.restricted && !checkStaff(user.name, 3)) {
        userMessage(user, "<br>Must be a member of the staff to add songs when the bot is in restricted mode.");
        return;
    }
    let inQueue = false;
    queue.forEach(request => {
        if(request.username === user.name) {
            inQueue = true;
        }
    });
    if(inQueue) return channelMessage("<br>" + user.name + " already has a song in the queue.");
    if(params === "") return channelMessage("Must supply a search term.");
    searchYT(user, params);
}

let restrict = function(params, user, scope) {
    if(checkStaff(user.name, 2)) {
        parameters.restricted = !parameters.restricted;
        channelMessage("restricted mode: " + (parameters.restricted ? "ON" : "OFF"));
    } else {
        userMessage(user, "<br>You must be a level 2 or lower staff member to set the bot's restricted status.")
    }
}

let resume = function(params, user, scope) {
    if(!checkStaff(user.name, 3) && parameters.restricted) return userMessage(user, "<br>You must be a staff member to pause/resume when the bot is in restricted mode.");
    if(parameters.paused) {
        parameters.paused = false;
        setComment('<span style="color:green;font-size:xx-large"><br>Now playing ' + currentSong.title + '</span><br><br>' + comment);
        decoder.pipe(decoderPipe);
    }
}

let saveBanned = function(banned, bannedFile) {
    fs.writeFileSync(bannedFile, JSON.stringify(banned));
}

let savePlaylists = function() {
    fs.writeFileSync('playlists.json', JSON.stringify(playlists));
}

let saveStaff = function(staff, staffFile) {
    fs.writeFileSync(staffFile, JSON.stringify(staff));
}

let searchYT = function(user, term) {
    return new Promise((resolve, reject) => {
        if(parameters.YTKey === "") return console.log("No YouTube API Key defined.");
        let opts = {
                maxResults: 1,
                key: parameters.YTKey,
                type: "video"
            };
        search(term, opts)
        .then(results => {
            if(!results || results.length === 0) {
                console.log('No video found');
                userMessage(user, "Search did not return a video. Try again.");
                resolve(false);
            } else if(results[0] && results[0].kind !== 'youtube#video') {
                console.log('Result was not a video.');
                channelMessage("Search did not return a video. Try again.");
                resolve(false);
            } else {
                console.log(results);
                let request = {
                    username: user.name,
                    userID: user.id,
                    id: results[0].id,
                    title: results[0].title,
                    images: {
                        small: results[0].thumbnails.default.url,
                        medium: results[0].thumbnails.medium.url,
                        large: results[0].thumbnails.high.url
                    }
                };
                duration(request.id, parameters.YTKey).then(dur => {
                    request.dur = dur;
                    if(!isTooLong(user, request)) {
                        addToQueue(user, request)                
                    }
                    resolve(true);
                });
            }
        });
    });
}

let setBitrate = function(bitrate, user, scope) {
    if(!checkStaff(user.name, 1)) return;
    let value = Number(bitrate);
    if(isNaN(value)) return userMessage(user, "Must provide valid number as bitrate.");
    conn.connection.setBitrate(value);
    return userMessage(user, "Bitrate changed to " + value);
}

let setComment = function(commentText) {
    conn.user.setComment(commentText);
}

let showPlaylist = function(params, user, scope) {
    let userName = params === "" ? user.name : params,
        plist = playlists[userName];
    if(!plist || plist.length === 0) return userMessage(user, userName + "'s playlist is empty.");
    userMessage(user, plist.join('<br>'));
}

let showQueue = function(params, user, scope) {
    if(parameters.restricted && !checkStaff(user.name, 3)) {
        userMessage(user, "<br>Must be a member of the staff to show queue when the bot is in restricted mode.");
        return;
    }
    if(queue.length === 0) return channelMessage("Queue is empty!");
    let message = '<table style="width:100%"><tr><th align="left">Position</th><th align="left">User</th><th align="left">Title</th></tr>';
    for(let i = 0; i < queue.length; i++) {
        message += '<tr><td>' + (i+1) + '</td><td>' + queue[i].username + '</td><td><i>' + queue[i].title + '</i></td></tr>';
    }
    channelMessage(message);
}

let shufflePlaylist = function(params, user, scope) {
    let plist = playlists[user.name];
    if(!plist || plist.length === 0) return userMessage(user, "Your playlist is empty.");
    playlists[user.name] = shuffle(plist);
    return userMessage(user, "I just shuffled your playlist like crazy.");
} 

let skip = function(params, user, scope) {
    if(parameters.restricted && !checkStaff(user.name, 3)) {
        userMessage(user, "<br>Must be a member of the staff to skip when the bot is in restricted mode.");
        return;
    }
    decoder.end();
    stream.end();
    ytStream.ffmpeg.kill();
    setComment(comment);
    parameters.paused = false;
    parameters.isPlaying = false;
}

let sortStaff = function(staff) {
    let result = [];
    for(let i = 1; i < 4; i++) {
        for(staffMember in staff) {
            if(staff[staffMember].level == i) result.push({name: staffMember,
                                                           level: staff[staffMember].level,
                                                           rank: staff[staffMember].rank})
        }
    }
    return result;
}

let stop = function(params, user, scope) {
    if(!checkStaff(user.name, 3)) {
        userMessage(user, "<br>Must be a member of the staff to stop the bot.");
        return;
    }
    queue = [];
    playlists = {};
    savePlaylists();
    decoder.end();
    stream.end();
    ytStream.ffmpeg.kill();
    setComment(comment);
    parameters.paused = false;
    parameters.isPlaying = false;
}

let userMessage = function(user, message) {
    conn.sendMessage(message, {session: user.session});
}

let volume = function(params, user, scope) {
    if(parameters.restricted && !checkStaff(user.name, 3)) {
        userMessage(user, "<br>Must be a member of the staff to set volume when the bot is in restricted mode.");
        return;
    }
    let newGain = gain,
        newVolume = Number(params) / 100;
    if(params === "") return channelMessage("Volume is " + newGain*100);
    if(isNaN(newVolume)) return channelMessage("Use !volume <i>new volume</i> to set volume between 0 and 100");

    newGain = Math.max(0.01, Math.min(1, newVolume));
    console.log(newGain);
    channelMessage("Volume is now " + newGain*100);
    stream.setGain(newGain);
    gain = newGain;    
}



let playerCommands = {
    add: {
        exec: addToPlaylist,
        arguments: "SEARCHTERM(s)",
        description: 'adds <font face="courier"><b>SEARCHTERM</b></font> to your personal playlist. Terms in your playlist will be added to the play queue in order. Multiple terms may be added by separating them with commas.'
    },
    clear: {
        exec: clearPlaylist,
        arguments: "USER",
        description: 'Removes all entries from <font face="courier"><b>USER</b></font>\'s playlist. Call without an argument to clear own playlist.'
    },
    feelgood: {
        exec: feelGood,
        arguments: "",
        description: "when you need a lift"
    },
    onehitwonders: {
        exec: oneHitWonders,
        arguments: "",
        description: "add 100 random one hit wonder songs to the queue"
    },
    pause: {
        exec: pause,
        arguments: "",
        description: "pause the currently playing track"
    },
    playing: {
        exec: displayCurrent,
        arguments: "",
        description: "displays information about the currently playing song"
    },
    queue: {
        exec: showQueue,
        arguments: "",
        description: "displays the current queue"
    },
    request: {
        exec: requestSong,
        arguments: "SEARCHTERM",
        description: 'DEPRECATED: Please use !add instead.'
    },
    resume: {
        exec: resume,
        arguments: "",
        description: "unpause a currently paused track"
    },
    showplaylist: {
        exec: showPlaylist,
        arguments: "USER",
        description: 'lists the contents of <font face="courier"><b>USER</b></font>\'s playlist. Call without an argument to list own playlist.'
    },
    shuffle: {
        exec: shufflePlaylist,
        arguments: "",
        description: 'Randomly reorders the search terms in your playlist.'
    },
    skip: {
        exec: skip,
        arguments: "",
        description: "Skips the current song."
    },
    stop: {
        exec: stop,
        arguments: "",
        description: "Stops playing and clears the queue and all playlists."
    },
    unqueue: {
        exec: removeSong,
        arguments: "USER",
        description: 'Removes <font face="courier"><b>USER</b></font>\'s song from the queue. Call without an argument to remove own song.'
    },
    volume: {
        exec: volume,
        arguments: "NEWVOLUME",
        description: "Sets the volume of the bot. Call without an argument to show the current volume"
    }
}

let staffCommands = {
    addstaff: {
        exec: addStaff,
        arguments: "USER LEVEL",
        description: 'adds <font face="courier"><b>USER</b></font> as staff member at the given <font face="courier"><b>LEVEL</b></font>. Level 1 is highest and level 3 is lowest.'
    },
    ban: {
        exec: banUser,
        arguments: "USER",
        description: 'prevents <font face="courier"><b>USER</b></font> from using the bot at all'
    },
    banned: {
        exec: listBanned,
        arguments: "",
        description: 'Lists the users on the banned list.'
    },
    move: {
        exec: moveToUser,
        arguments: "",
        description: "moves the bot to the room you're in"
    },
    removestaff: {
        exec: removeStaff,
        arguments: "USER",
        description: 'removes the <font face="courier"><b>USER</b></font> from the staff list'
    },
    restrict: {
        exec: restrict,
        arguments: "",
        description: "Toggles the bot's restricted mode. Non-staff cannot interact with the bot in restricted mode."
    },
    staff: {
        exec: listStaff,
        arguments: "",
        description: "Lists the current staff members, their levels, and their ranks"
    },
    unban: {
        exec: removeBan,
        arguments: "USER",
        description: 'Removes <font face="courier"><b>USER</b></font> from the list of banned users'
    },
}

let commands = Object.assign({}, playerCommands, staffCommands);

let comment = '<span style="color:#fc3bfc;font-size:xx-large">Player Commands</span><br>';
    comment += '<table style="width:100%"><tr><th>Command</th><th>Arguments</th><th>Description</th></tr>';
for(command in playerCommands) {
    comment += '<tr><td>' + '!' + command + '</td>';
    comment += '<td><font face="courier"><b>' + commands[command].arguments + '</b></font></td>';
    comment += '<td>' + commands[command].description + '</td></tr>';
}
    comment += '</table><br><span style="color:#fc3bfc;font-size:xx-large">Other Commands</span><br>';
    comment += '<table style="width:100%"><tr><th>Command</th><th>Arguments</th><th>Description</th></tr>';
for(command in staffCommands) {
    comment += '<tr><td>' + '!' + command + '</td>';
    comment += '<td><font face="courier"><b>' + commands[command].arguments + '</b></font></td>';
    comment += '<td>' + commands[command].description + '</td></tr>';    
}


// Hidden commands
commands.setbitrate = {exec: setBitrate};
commands.announce = {exec: gmAnnouncement};


let conn,
    stream,
    ytStream,
    gain=0.2,
    currentSong,
    decoder,
    decoderPipe;

let queue = [];

console.log( 'Connecting' );
mumble.connect( parameters.server, options, function ( error, connection ) {
    if( error ) { throw new Error( error ); }

    console.log( 'Connected' );
    conn = connection;
    connection.authenticate( parameters.username );
    connection.on( 'initialized', onInit );
});


