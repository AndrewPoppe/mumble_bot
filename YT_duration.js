let querystring = require('querystring');
let xhr = require('xhr');

if (!xhr.open) xhr = require('request');

let convertDurationString = function(durationString) {
	let H = durationString.match(/(\d+)(?=[H])/ig)||['0'],
		M = durationString.match(/(\d+)(?=[M])/ig)||['0'],
		S = durationString.match(/(\d+)(?=[S])/ig)||['0'],
		seconds = Number(H[0]*3600) + Number(M[0]*60) + Number(S[0]),
		formatted = (H[0] === "0" ? "" : H[0]+":") + (M[0].length < 2 ? "0" + M[0] : M[0]) + ":" + (S[0].length < 2 ? "0" + S[0] : S[0]);
		return {
			seconds: seconds,
			formatted: formatted
		};
}

let getDur = function (id, key) {

  let params = {
    id: id,
    key: key,
    part: 'contentDetails'
  };

  return new Promise(function(resolve, reject) {
  	xhr({
	    url: 'https://www.googleapis.com/youtube/v3/videos?' + querystring.stringify(params),
	    method: 'GET'
	  }, function (err, res, body) {
	    if (err) reject(err);

	    try {
	      let result = JSON.parse(body);

	      if (result.error) {
	        let error = new Error(result.error.errors.shift().message)
	        reject(error);
	      }

	      let durationString = result.items[0].contentDetails.duration,
		      dur = convertDurationString(durationString);

	      resolve(dur);
	    } catch(e) {
	      reject(e);
	    }
	  });
  });
}

module.exports = async function(id, key) {
	let dur = await getDur(id, key);
	return dur;
}
