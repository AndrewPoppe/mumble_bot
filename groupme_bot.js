
let API = require('./groupme_modified').Stateless,
	IncomingStream = require('./groupme_modified').IncomingStream,
	fs = require('fs'),
	ACCESS_TOKEN = fs.readFileSync('groupme_auth.txt', "utf8"),
	OPT_IN_GROUP_ID = '42231940',
	MY_ID = '57199530',
	MY_UID = '354560821',
	OPT_IN_LINK = 'https://groupme.com/join_group/42231940/UvWrqD',
	SERVERS = ["centra", "origin", "radius", "sphere"];




let usersToMessage;
try {
    usersToMessage = JSON.parse(fs.readFileSync('usersToMessage.json', "utf8"));
} catch(err) {
    usersToMessage = {};
    fs.writeFileSync('usersToMessage.json', JSON.stringify(usersToMessage));
}

console.log(usersToMessage);

//let usersFile = fs.createWriteStream("usersToMessage.json");





/*
	sends an announcement to all users who haven't turned off service
	message: message to send
	returns: nothing	
*/
let announcement = function(message) {
	for(let userid in usersToMessage) {
		if(usersToMessage[userid].on) sendMessage(userid, message);
	}
}



/*
	checks the opt in group for new members and updates the
	usersToMessage object accordingly. then saves the 
	updated object to usersFile
	returns: 	promise resolving to object of users to message
*/
let checkGroup = async function() {
	setTimeout(checkGroup, 30*1000);
	let usersToAdd = await getUsers(OPT_IN_GROUP_ID);
	usersToAdd.forEach(user => {
		if(user.user_id === MY_UID || user.user_id === MY_ID) return;
		if(checkIfAlreadyExists(user)) return;
		usersToMessage[user.user_id] = createUser();
		saveUserList(usersToMessage);
		sendMessage(user.user_id, startMessage);
	});
	removeUsers(OPT_IN_GROUP_ID, usersToAdd);
	return usersToMessage;
}


/*
	checks if a particular user (from getUsers()) is in 
	the usersToMessage object
	user: 	individual user object from getUsers()  
	returns: 	boolean, true if already in array
*/
let checkIfAlreadyExists = function(user) {
	for(let u in usersToMessage) {
		if(u === user.user_id) return true;
	}
	return false;
}

/*
	checks whether a message should be sent based on current time and 
	the user's snooze setting.
	userid: 	user_id string
	returns: 	boolean, true for okay to send, false for not okay to send
*/
let checkIfNotSnoozed = function(userid) {
	let snoozeEnd = usersToMessage[userid].snoozeEnd,
		current   = Date.now();
	return current > snoozeEnd;
}


/*
	checks whether it's too late/early to send a message based on 
	current time and the user's bedtime setting.
	userid: 	user_id string
	returns: 	boolean, true if okay to send, false if not okay
*/
let checkIfOkayToSend = function(userid) {
	let bedtime = usersToMessage[userid].bedTime,
		hour = new Date(new Date().toLocaleString()).getHours(),
		waketime = 8;
	if (bedtime < 0) return true; 
	if(bedtime <= waketime) {
		return hour >= waketime || hour < bedtime;
	}
	if(bedtime > waketime) {
		return hour >= waketime && hour < bedtime;
	}
	return true;
}


/*
	checks whether any of the user's servers are found in the 
	given message.
	userid: 	user_id string
	message: 	message string
	returns: 	boolean, true if server is in message, false if not
*/
let checkServer = function(userid, message) {
	if(!usersToMessage[userid].servers) usersToMessage[userid].servers = SERVERS;
	let included = usersToMessage[userid].servers.map(server => {
		let index = message.toLowerCase().search(server.toLowerCase());
		return index > -1;
	});
	return included.includes(true);
}


/*
	creates a user object for the usersToMessage object
	returns; 	user obejct
*/
let createUser = function() {
	return {
				on: true, 
				snoozeEnd: 0, 
				bedTime: -1, 
				servers: SERVERS
			};
}


/*
	gets all current members of the group
	groupid: 	id for group to get members from
	returns: 	promise that resolves to an array of users
*/
let getUsers = function(groupid) {
	return API.Groups.show.Q(ACCESS_TOKEN, groupid).then(group => {
		return group.members;
	});
}


/*
	handles incoming messages
	sets value of user to true or false if user
	requests to stop or start messaging
	message: 	message object from groupme
	returns: 	nothing
*/
let handleMessage = function(message) {
	console.log(message);
	if(!message || !message.data || !message.data.subject || !message.data.subject.user_id) return;
	let uid = message.data.subject.user_id,
		text = message.data.subject.text,
		group = message.data.subject.group_id;
	console.log(uid, text);
	if(!text) return;

	if(uid === MY_ID || uid === MY_UID) return;
	
	// This is in the opt-in group
	if(group && text.toLowerCase() === "start") {
		startService(uid);
		//removeUserByID(OPT_IN_GROUP_ID, uid);
	}

	if(text.toLowerCase() === "start") {
		startService(uid);
	} else if(text.toLowerCase() === "stop") {
		stopService(uid);
	} else {
		if (!usersToMessage[uid]) usersToMessage[uid] = createUser();
		let texts = text.toLowerCase().split(' ');
		switch(texts[0].toLowerCase()) {
			case "snooze":
				let hours = Number(texts[1]);
				if(isNaN(hours)) return sendMessage(uid, "Please provide the number of hours you'd like to snooze the bot, like this: snooze 12");
				usersToMessage[uid].snoozeEnd = Date.now() + hours*60*60*1000;
				saveUserList(usersToMessage);
				sendMessage(uid, `You will not receive messages for ${hours} hours.`);
				break;
			case "bedtime":
				let hour = Number(texts[1]);
				if(isNaN(hour) || hour > 23) return sendMessage(uid, "Please provide the hour in military time when you'd like to stop receiving messages, like this: bedtime 0 (this would stop sending messages at midnight Eastern time). Use a negative number to turn off the bedtime.");
				usersToMessage[uid].bedTime = hour;
				saveUserList(usersToMessage);
				if(hour < 0) return sendMessage(uid, "You have turned off the bedtime.");
				if(hour === 0) hour = 24;
				sendMessage(uid, `You will stop receiving messages at ${hour < 13 ? hour:hour-12}:00 ${hour < 12 || hour === 24 ? 'AM':'PM'} Eastern Time every day`);
				break;
			case "server":
			case "servers":
				let servers = texts.slice(1).filter(server => SERVERS.includes(server.toLowerCase()));
				if(servers.length === 0) return sendMessage(uid, `Please provide the servers you want to be notified about, like this: servers radius sphere\n\nValid servers are: \n${SERVERS.join('\n')}`);
				usersToMessage[uid].servers = servers;
				saveUserList(usersToMessage);
				sendMessage(uid, `You will only receive messages that contain one of the following: \n${servers.join('\n')}`);
				break;
		}
	}
}


/*
	remove users from a group
	groupid: 	id for group to remove users from
	users: 		array of users from getUsers()
	returns: 	nothing
*/
let removeUsers = function(groupid, users) {
	users.forEach(user => {
		if(user.user_id === MY_ID || user.user_id === MY_UID) return;
		console.log("Removing user:");
		console.log(user);
		API.Members.remove(ACCESS_TOKEN, groupid, user.id, (err, ret) => {
			if(err) console.log(err);
		});
	});
}

let removeUserByID = function(groupid, uid) {
	API.Members.remove(ACCESS_TOKEN, groupid, uid, (err, ret) => {
		if(err) console.log(err);
	});
}


/*
	saves the current usersToMessage to file
	usersToMessage: 	object representing users to send direct messages to
	returns: 			nothing
*/
let saveUserList = function(usersToMessage) {
	//usersFile.write(JSON.stringify(usersToMessage));
	fs.writeFileSync('usersToMessage.json', JSON.stringify(usersToMessage));
}


/*
	sends a direct message to a user
	userid: 	user_id for user to message
	message: 	string of message contents
	returns: 	nothing
*/
let sendMessage = function(userid, message) {
	if(userid === 'system') return;
	let opts = {
		direct_message: {
			recipient_id: userid,
			text: message
		}
	};
	API.DirectMessages.create(ACCESS_TOKEN, opts, (err, ret) => {
		if(err) console.log(err);
	});
}


/*
	send a direct message to every user in usersToMessage object
	message: 			the message to send
	returns: 			nothing
*/
let sendMessages = function(message) {
	for(let userid in usersToMessage) {
		if(usersToMessage[userid].on && checkIfNotSnoozed(userid) && checkIfOkayToSend(userid) && checkServer(userid, message)) sendMessage(userid, message);
	}
}


/*
	start a listener for incoming messages
	returns: 	incomingStream instance
*/
let startListener = function() {
	let iStream = new IncomingStream(ACCESS_TOKEN, MY_ID);
	iStream.on("message", handleMessage);
	iStream.on("connected", () => {
		setTimeout(function() {global.GMstream.disconnect();}, 1000*60*5);
		console.log("Now listening for incoming messages...")});
	iStream.on("disconnected", () => {
		console.log("Message listener was disconnected!");
		setTimeout(startListener, 3000);
	});
	iStream.on("error", (a,b) => {console.log("There was an incoming stream error", a, b)});
	iStream.connect();
	global.GMstream = iStream;
	return iStream;
}


/*
	message to send when a user starts service
*/
let startMessage = "Great! You will now receive direct messages from me when tournament tree messages are" +
				   " sent on Mumble.\nTo stop service, send me a message that just says \"stop\". You will be able to restart whenever you want." +
				   "\n\n You can also set a snooze using \"snooze 2\" to stop receiving messages for 2 hours. Change the 2 to whatever you want." +
				   "\nTo set a bedtime, use \"bedtime 23\" to stop receiving messages at a certain time every day. This uses military time and Eastern " +
				   "time, so 23 is 11 PM eastern, and 0 is midnight eastern" +
				   "\n\nYou can specify which servers you want to receive messages about by sending a message like this: servers radius sphere" +
				   "\nValid servers are: " + SERVERS.join(' ');


/*
	initiates sending messages to this user
	userid: 	user_id for user to start
	returns: 	nothing
*/
let startService = function(userid) {
	if (!usersToMessage[userid]) usersToMessage[userid] = createUser();
	usersToMessage[userid].on = true;
	saveUserList(usersToMessage);
	sendMessage(userid, startMessage)
}


/*
	message to send when a user stops service
*/
let stopMessage = "Okay, you won't get any more messages from me." +
				  "\nIf you want to start getting messages again, send me a message that just says \"start\".";


/*
	stops sending messages to this user
	userid: 	user_id for user to stop
	returns: 	nothing
*/
let stopService = function(userid) {
	if (!usersToMessage[userid]) usersToMessage[userid] = createUser();
	usersToMessage[userid].on = false;
	saveUserList(usersToMessage);
	sendMessage(userid, stopMessage);
}

module.exports = {
	announcement: 	announcement,
	checkGroup: 	checkGroup,
	sendMessages: 	sendMessages,
	startListener: 	startListener
}

