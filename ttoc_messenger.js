
const snoowrap = require('snoowrap'),
      fs = require('fs'),
      TurndownService = require('turndown'),
      redditCredentials = JSON.parse(fs.readFileSync('reddit_credentials.json', "utf8")),
      sendMessages = require('./groupme_bot.js').sendMessages,
      htmlToText = require('html-to-text');


const r = new snoowrap(redditCredentials);

let submissionInfo;
try {
    submissionInfo = JSON.parse(fs.readFileSync('submission.json', "utf8"));
} catch(err) {
    submissionInfo = {};
    fs.writeFileSync('submission.json', JSON.stringify(submissionInfo));
}

let tds = new TurndownService(),
    subreddit = "TagPro";


/*
    submits a new self post to the TagPro subreddit
    returns:    a promise that resolves to a "submissionInfo" object:
                {
                    id: string, the id of the sumission,
                    time: a Date() object representing when the post was submitted
                }
*/
let newSubmission = function() {
    console.log('making new submission');
    let title = "TagPro Tournament Announcement - " + new Date().toDateString();
    let message = "##This is an automated announcement about a TagPro Tournament happening soon on NA Mumble." +
                  "\n\nInformation about the tournament will be posted in comments to this post. Sort by *new* to see the most recent information." +
                  "\n\nThese tournaments are open to everyone!" +
                  "\n\n----" +
                  "\n\n***\"But LoveBot, I don't know what these tournaments are all about!!\"***" +
                  "\n\nFear not! The way these tournaments work is as follows: \n\n* each person fills out a signup sheet that will be linked to in the comments on this post." +
                  "\n* Filling that out signs you up to be in the tournament draft. \n* Captains will take turns choosing players for their teams during the draft. You can see " +
                  "this process happening live on the spreadsheet that is also linked in the comments. \n* You should get onto Mumble during the draft and then join the **Tournaments** " +
                  "room. Someone will help you find the room for your team after the draft is done." +
                  "\n\nTournaments follow different structures depending on the number of people who sign up." +
                  "\n\nIf you have any questions, send a reddit message to /u/Poeticalto or /u/Love_You_TP or ask people on Mumble." +
                  "\n\n----" +
                  "\n\nIf you don't know how to access NA Mumble, please see this page for instructions: [wiki](https://www.reddit.com/r/TagPro/w/mumble)" +
                  "\n\n-----\n\nIf you want to receive messages like this sent to you on GroupMe, click [this link](https://groupme.com/join_group/42231940/UvWrqD) and then type 'start' in the group it links to."

    return r.getSubreddit(subreddit).submitSelfpost({title: title, text: message}).id.then(id => {
        return {
            id:     id,
            time:   getNoonTime()
        }
    });
}

/*
    submits a new comment to the currently active sumission
    submissionId:   string, the id of the current submission
    message:        the contents of the comment reply
    returns:    a promise that resolves to the comment object (currently not used for anything)
*/
let replyToSubmission = function(submissionId, message) {
    console.log('replying to ' + submissionId);
    r.getSubmission(submissionId).reply(message);
}


/*
    returns a millisecond integer representing the most recent noon
    if it is currently afternoon, then it returns noon today.
    if it is before noon (i.e., after midnight) it returns noon yesterday.
*/
let getNoonTime = function() {
    let now = new Date(),
        hour = now.getHours();
    now.setHours(12);
    if(hour < 12) now = new Date(now.getTime() - 24*60*60*1000)
    return now.getTime();
}


/*
    formats anchor links for the groupme bot. 
*/
let formatAnchor = function(elem, fn, options) {
  var href = '';
  // Always get the anchor text
  var storedCharCount = options.lineCharCount;
  var text = fn(elem.children || [], options);
  if (!text) {
    text = '';
  }
  //var result = elem.trimLeadingSpace ? _s.lstrip(text) : text;
  var result = text;

  if (!options.ignoreHref) {
    // Get the href, if present
    if (elem.attribs && elem.attribs.href) {
      href = elem.attribs.href.replace(/^mailto\:/, '');
    }
    if (href) {
      if ((!options.noAnchorUrl) || (options.noAnchorUrl && href.indexOf('#') === -1)) {
        if (options.linkHrefBaseUrl && href.indexOf('/') === 0) {
          href = options.linkHrefBaseUrl + href;
        }
        if (!options.hideLinkHrefIfSameAsText || href !== _s.replaceAll(result, '\n', '')) {
          if (!options.noLinkBrackets) {
            result += ' [' + href + ']';
          } else {
            result += ' ' + href;
          }
        }
      }
    }
  }

  options.lineCharCount = storedCharCount;

  return (result || href) + '\n';
  //return formatText({ data: result || href, trimLeadingSpace: elem.trimLeadingSpace }, options);
}

/*
    formats paragraphs for the groupme bot
*/
let formatParagragh = function(elem, fn, options){
    let p = fn(elem.children,options);
    return "\n" + p;
}

/*
    formats line breaks for the groupme bot
*/
let formatLinebreak = function(elem, fn, options) {
    let b = fn(elem.children, options);
    return b + "\n";
}



/*
    parses a tree message (probably shouldn't be in this file but whatever)
    message:    message contents
    user:       user object
    
*/
let handleTree = function(message, user, scope) {
    console.log(scope, message);
    if(Array.isArray(scope)) scope = scope[0];
    if(scope !== 0) return;
    if(message.toLowerCase().search('sign up|signup') < 0) return;
    let groupmeMessage = htmlToText.fromString(message, {noAnchorUrl: false, preserveNewlines: true, noLinkBrackets: true, 
                                format: {
                                    paragraph: formatParagragh,
                                    lineBreak: formatLinebreak,
                                    anchor: formatAnchor
                                }});
    sendMessages(groupmeMessage);
    let newMessage = tds.turndown(message) + '\n\n____\n\nMessage from: ' + user.name;
    if(!submissionInfo || !submissionInfo.time || (Date.now() - submissionInfo.time) > (24 * 60 * 60 * 1000)) {
        newSubmission().then(subInfo => {
            submissionInfo = subInfo;
            fs.writeFileSync('submission.json', JSON.stringify(submissionInfo));
            replyToSubmission(submissionInfo.id, newMessage);
        });
    } else {
        replyToSubmission(submissionInfo.id, newMessage);
    }
}

module.exports = {
    handleTree: handleTree,
    submissionInfo: submissionInfo
}


