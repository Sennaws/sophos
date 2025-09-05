

function camelCaseToTitleCase(camelCase) {
	if (!camelCase) {
		return "";
	}

	camelCase = camelCase.trim();
	var newText = "";
	for (var i = 0; i < camelCase.length; i++) {
		if (/[A-Z]/.test(camelCase[i])
			&& i !== 0
			&& /[a-z]/.test(camelCase[i - 1])) {
			newText += " ";
		}

		if (/[A-Z]/.test(camelCase[i])
			&& i !== 0
			&& i + 1 < camelCase.length
            && /[a-z]/.test(camelCase[i + 1])
            && !/\s/.test(newText[newText.length - 1])) {
			newText += " ";
		}

		if (i === 0 && /[a-z]/.test(camelCase[i])) {
			newText += camelCase[i].toUpperCase();
		} else if (!/[A-Z]/.test(camelCase[i])
            && !/[a-z]/.test(camelCase[i])
            && !/[0-9]/.test(camelCase[i])
            && camelCase[i] !== '-'
            && !/\s/.test(newText[newText.length - 1])) {
			newText += " ";
		} else {
			newText += camelCase[i];
		}
	}

	return newText;
}

function checkData(data, type, protocol) {
	let rval = true;
	let proto = protocol || PROTO_IPSEC;

	if (typeof data === "undefined") {
		return false;
	}
	if (type === "dynamic") {
		let dynamicKeys = [
            'bytes_sent', 'bytes_rcvd', 'vpn_state', 'auth_state'
		];
		if (proto === PROTO_IPSEC) {
			dynamicKeys.push( 'packets_sent', 'packets_rcvd', 'ike_rekey', 'ipsec_rekey');
		}
		dynamicKeys.forEach(function (key) {
			if (typeof data[key] === "undefined") {
				//console.log("Missing " + key + " in dynamic");
				rval = false;
			}
		});
	}
	else if (type === "config") {
		let configKeys = [
            'name', 'gateway', 'history'
		];
		let historyKeys = [
            'connect_time'
		];
		if (proto === PROTO_IPSEC) {
			configKeys.push('child');
		}
		else {
			configKeys.push('protocol');
		}
		configKeys.forEach(function (key) {
			if (typeof data[key] === "undefined") {
				//console.log("Missing " + key + " in config");
				rval = false;
			}
		});
		historyKeys.forEach(function (key) {
			if (typeof data['history'][key] === "undefined") {
				//console.log("Missing " + key + " in config.history");
				rval = false;
			}
		});
		// localAuth, remoteAuth needed?
	}
	else if (type === "endpoints") {
		let endpointsKeys = [
            'connected', 'gateway', 'name'
		];
		if (proto === PROTO_IPSEC) {
			endpointsKeys.push('local_id', 'remote_id');
		}

		endpointsKeys.forEach(function (key) {
			if (typeof data[key] === "undefined") {
				//console.log("Missing " + key + " in endpoints");
				rval = false;
			}
		});
	}
	else if (type === "network") {
		let networkKeys = [
            'local_port', 'remote_ip', 'remote_port', 'bytes_sent', 'bytes_rcvd'
		];
		if (proto === PROTO_IPSEC) {
			networkKeys.push('local_ip');
			networkKeys.push('packets_sent');
			networkKeys.push('packets_rcvd');
		}
		networkKeys.forEach(function (key) {
			if (typeof data[key] === "undefined" || data[key] === "") {
				//console.log("Missing " + key + " in network");
				rval = false;
			}
		});
	}
	else if (type === "security") {
		let securityKeys = [];
		if (proto === PROTO_IPSEC) {
			securityKeys = [
				'ipsec_enc_key_size', 'ipsec_enc_alg', 'ipsec_rekey',
				'ike_dh_group', 'ike_enc_alg', 'ike_enc_key_size', 'ike_hash_alg', 'ike_prf_alg', 'ike_rekey', 'ike_version'
			];
		}
		else {
			securityKeys = [
				'sslvpn_enc_alg', 'sslvpn_enc_key_size', 'sslvpn_hash_alg', 'sslvpn_compression'
			];
		}
		securityKeys.forEach(function (key) {
			if (typeof data[key] === "undefined" || data[key] === "") {
				//console.log("Missing " + key + " in security");
				rval = false;
			}
		});
	}
	else {
		rval = false;
	}
	return rval;
}

function checkMapSupport() {
    var testArray = [[1, 'msg'], [2, 'msg2']];
    var testMap = new Map(testArray);
    return testMap.has(2);
}

/*
function comp(newConn, savedConn) {
    if (!savedConn) {
        return true;
    }
    var nkeys = Object.keys(newConn);
    var skeys = Object.keys(savedConn);
    var len = nkeys.length;

    for (var i = 0; i < len; i++) {
        let key = nkeys[i];
        if (key === "details" || key === "title" || key === "config" || key === "sas") {
            continue;
        }
        if (newConn[key] !== savedConn[key]) {
            return false;
        }
    }
    return true;
}
*/

function convertRekey(rsecs) {
	let rekeyStr = "";

	if (rsecs >= 0) {
		let days = Math.floor(rsecs / 8.64e4);              // 24 * 60 * 60
		let hrs = Math.floor((rsecs % 8.64e4) / 3.6e3);
		let mins = Math.floor((rsecs - (days * 8.64e4 + hrs * 3.6e3)) / (60));
		let secs = Math.floor((rsecs - (days * 8.64e4 + hrs * 3.6e3 + mins * 60)));

		rekeyStr += days ? (days + (days > 1 ? " " + Label.getText(SC_TID_DAYS) + " " : " " + Label.getText(SC_TID_DAY) + " ")) : "";
		rekeyStr += hrs ? (hrs + (hrs > 1 ? " " + Label.getText(SC_TID_HOURS) + " " : " " + Label.getText(SC_TID_HOUR) + " ")) : "";
		rekeyStr += mins ? (mins + (mins !== 1 ? " " + Label.getText(SC_TID_MINUTES) + " " : " " + Label.getText(SC_TID_MINUTE) + " ")) : "";
		rekeyStr += secs + (secs === 1 ? " " + Label.getText(SC_TID_SECOND) + " " : " " + Label.getText(SC_TID_SECONDS));
	}

	return rekeyStr;
}

function getTimeStamp(ct) {
	let d = ct ? new Date(ct) : new Date();
	let langTag = StatusMsg.getLang().replace('_', '-');
	let ts = d.toLocaleDateString(langTag, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
	ts += ' @ ' + d.toLocaleTimeString(langTag);
	return ts;
}

function repeat (str, count) {
	var array = [];
	for (var i = 0; i < count;)
		array[i++] = str;
	return array.join('');
}

function dump_telem(resp) {
	let jResp = resp;
	let ret = true;
	if (typeof jResp === "object") {
		for (var key in jResp) {
			console.log(key + ": " + jResp[key]);
		}
	}
	else {
		ret = false;
	}
	return ret;
}

function uploadCert(data) {
	log(StatusMsg.getMsg(SC_SID_ADDING_CONNECTION_FILE, connState.getConnectionFile()));
	log(StatusMsg.getMsg(SC_SID_ADDING_CERTIFICATE_FILE, connState.getCertificateFile()));
    $("#statusImg").attr("class", "loading");
	$("#connectBtn").attr("disabled", "disabled");
	sc_cert(connState.getFileInfo(), connState.getFileType(), data, $("#pk12Password").val(), importCertCb);
    $("#pk12Password").val("");
}

