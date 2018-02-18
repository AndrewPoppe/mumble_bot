
let API = require('./groupme_modified').Stateless,
	IncomingStream = require('./groupme_modified').IncomingStream,
	fs = require('fs'),
	ACCESS_TOKEN = fs.readFileSync('groupme_auth.txt', "utf8"),
	OPT_IN_GROUP_ID = '38551004',
	MY_ID = '57199530',
	OPT_IN_LINK = 'https://groupme.com/join_group/38551004/wzLCwZ';




let usersToMessage;
try {
    usersToMessage = JSON.parse(fs.readFileSync('usersToMessage.json', "utf8"));
} catch(err) {
    usersToMessage = {};
    fs.writeFileSync('usersToMessage.json', JSON.stringify(usersToMessage));
}
//let usersFile = fs.createWriteStream("usersToMessage.json");






/*
	checks the opt in group for new members and updates the
	usersToMessage object accordingly. then saves the 
	updated object to usersFile
	returns: 	promise resolving to object of users to message
*/
let checkGroup = async function() {
	let usersToAdd = await getUsers(OPT_IN_GROUP_ID);
	usersToAdd.forEach(user => {
		if(user.user_id === MY_ID) return;
		usersToMessage[user.user_id] = true;
		saveUserList(usersToMessage);
		sendMessage(user.user_id, startMessage);
	});
	removeUsers(OPT_IN_GROUP_ID, usersToAdd);
	setTimeout(checkGroup, 5000);
	return usersToMessage;
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
	if(!message) return;
	if(message.data && message.data.subject && message.data.subject.user_id) {
		let uid = message.data.subject.user_id,
			text = message.data.subject.text;
		console.log(text);
		if(text === "start") {
			startService(uid);
		} else if(text === "stop") {
			stopService(uid);
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
		if(user.user_id === MY_ID) return;
		API.Members.remove(ACCESS_TOKEN, groupid, user.id, (err, ret) => {
			if(err) console.log(err);
		});
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
		if(usersToMessage[userid]) sendMessage(userid, message);
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
		setTimeout(startListener, 5000);
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
				   " sent on Mumble.\nTo stop service, send me a message that just says \"stop\".";


/*
	initiates sending messages to this user
	userid: 	user_id for user to start
	returns: 	nothing
*/
let startService = function(userid) {
	usersToMessage[userid] = true;
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
	usersToMessage[userid] = false;
	saveUserList(usersToMessage);
	sendMessage(userid, stopMessage);
}

module.exports = {
	checkGroup: 	checkGroup,
	sendMessages: 	sendMessages,
	startListener: 	startListener
}

