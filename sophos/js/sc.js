const LOGERR = 3,
    LOGWARN = 4,
    LOGINFO = 6,
    LOGDEBUG = 7,
	LOGEVENT = 8;

const WAITFOR = 3000;

const DEBUG = true;

var sc_ws = null;


var Encode = {
	HTML_CHAR_MAPPING: {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#x27;',
		'/': '&#x2F;',
		'`': '&#x60;'
	},
	htmlReplacer: function (match) {
		return Encode.HTML_CHAR_MAPPING[match];
	},
	forHtml: function (string) {
		if (string === null) {
			return string;
		}
		return (string + '').replace(/[&<>"'\/`]/g, Encode.htmlReplacer);
	}
};



function log(msg, level) {
	var logLevel = level || LOGINFO;
	if (typeof msg === "string") {
		if (logLevel & LOGEVENT || msg !== Logger.lastMsg() && connState.getState() !== NOSERVICE) {
			Logger.sendLog(msg, logLevel);
		}
	}
	else {
		Logger.clearLastMsg();
	}
}

var Logger = (function () {
	var lastMsg = "";
	var logName = "scgui";
	var logLevel = LOGINFO;
    return {
		sendLog: function (msg, inLevel) {
            let ts = new Date();
            let re = /(\d+)[^\d]*(\d+)[^\d]*(\d{4})[^\d]*(,)*/;
            let tStr = ts.toLocaleString("en-US").replace(re, '$3-$1-$2 ');
            let iconClass = "";
            if (typeof msg !== "string" || msg.length === 0) {
                return;
            }
			logLevel = inLevel || LOGINFO;
            if ((logLevel & ~LOGEVENT) === LOGERR) {
				iconClass = " err";
            }
            else if ((logLevel & ~LOGEVENT) === LOGWARN) {
				iconClass = " warning";
			}
			let formattedmsg = Encode.forHtml(msg);
			$("#logarea").append("<li><div class='listIcons" + iconClass + "'></div><div class='ts'>" + tStr + "</div><div class='logMsg'>" + formattedmsg + "</div></li>");

			lastMsg = msg;
			let data = { "name": logName, "message": msg, "level": logLevel };
			var request = {};
			request["log"] = data;
			if (sc_ws && sc_ws.readyState === sc_ws.OPEN) {
				sc_ws.send(JSON.stringify(request));
			}
		},
		clearLastMsg: function () {
			lastMsg = "";
		},
        lastMsg: function () {
            return lastMsg;
        },
        getLogName: function (name) {
			return logName;
        },
		setLogName: function (name) {
			logName = name;
		},
		getLogLevel: function () {
			return logLevel;
		}
    };
}());

function onAjaxError(XMLHttpRequest, textStatus, errorThrown, callback) {
	let jTxt = "";
	let jObj = {};
	let data = this.data;
	let cb = callback;
	// Dump request onto console
	//console.log(this.data);
	if (textStatus === "timeout") {
		// resend these send requests since they will not otherwise retry
		if (connState.getState() !== NOSERVICE && cb === enableCb || cb === disableCb || cb === importCb) {
			send_request(data, cb);
		}
		else {
			jTxt = '{ "code": ' + SC_SID_TIMEOUT_ERR + ', "msg": "Timed out waiting for service response" }';
			jObj = JSON.parse(jTxt);
			callback(jObj);
		}
	}
	else if (textStatus === "error") { // try to determine if the request was ever sent
		if ((XMLHttpRequest.status === 0 && XMLHttpRequest.getAllResponseHeaders() === "") || XMLHttpRequest.state() === "rejected") {
			//log(StatusMsg.getMsg(SC_SID_NETWORK_CHANGE_ERR), LOGEVENT);
			if (connState.getState() !== NOSERVICE) {
				if (cb === enableCb || cb === disableCb || cb === importCb) {
					send_request(data, cb);
				}
			}
		}
		jTxt = '{ "code": ' + SC_SID_ERRORED_OUT + ', "msg": "Errored out waiting for service response" }';
		jObj = JSON.parse(jTxt);
		callback(jObj);
	}
}

function onAjaxSuccess(data, callback) {
	try {
		connState.setResponseTs();
		if (data) {
			if (typeof data.code !== "undefined" && data.code === SC_SID_SVC_STOPPED_ERR) {
				// this is returned for any request while scvpn is stopping so handle generically here
				log(StatusMsg.getMsg(SC_SID_SVC_STOPPED_ERR), LOGERR);
				connState.transition(NOSERVICE);
			}
			else if (callback && typeof callback === "function") {
				callback(data);
			}
		}
	}
	catch (e) {
        console.log(e);
	}
}

// jreq is a JSON string request. The callback is called with the returned
// JSON object
function send_request(jreq, callback) {
    let wait = 35000;
    if (typeof jreq !== "string" || jreq.length === 0 || typeof callback !== "function") {
        return false;
    }
    if (callback === monitorStatusCb || callback === helloCb) {
        wait = 0;
	}
	try {
		connState.setSendTs();
        $.ajax({
            type: "POST",
            url: "http://localhost:60110/request",
            contentType: "application/json",
            dataType: "json",
            data: jreq,
            error: function (XMLHttpRequest, textStatus, errorThrown) {
				onAjaxError(XMLHttpRequest, textStatus, errorThrown, callback);
            },
            success: function (data) {
				onAjaxSuccess(data, callback);
            },
            timeout: wait
        });
    }
    catch (e) {
        console.log(e);
    }
    return true;
}

function send_request2(command, callback, request_data, waitfor)
{
    var request = {};
    request[command] = request_data || {};
    request["waitfor"] = waitfor || WAITFOR;
    send_request(JSON.stringify(request), callback);
}

function send_request_ws(command, callback, request_data, waitfor)
{
	var request = {};
    request[command] = request_data || {};
    request["waitfor"] = waitfor || WAITFOR;
	if (sc_ws && sc_ws.readyState === sc_ws.OPEN) {
		sc_ws.send(JSON.stringify(request));
	}
	connState.setSendTs();
}

function sc_establish_websocket(url)
{
	try {
		if (!sc_ws) {
			sc_ws = new WebSocket(url);
			if (sc_ws.onopen === null) {
				sc_ws.onopen = function (evt) {
					//console.log("WebSocket open");
					connState.setStatusPoll(SERVICE_STATUS);
					connState.transition();
				};
				sc_ws.onmessage = function (evt) {
					let jObj = JSON.parse(evt.data);
					if (jObj.cbid && typeof requestCbArray[jObj.cbid] === "function") {
						requestCbArray[jObj.cbid](jObj);
					}
					connState.setResponseTs();
				};
				sc_ws.onerror = function (evt) {
					//console.log("web socket error");
				};
				sc_ws.onclose = function (evt) {
					//console.log("received web socket close");
					if (sc_ws.readyState !== sc_ws.CLOSED) {
						sc_ws.close();
					}
					sc_ws = null;
					setTimeout(function () { sc_establish_websocket(url); }, 2000);
					if (connState.getState() !== NOSERVICE) {
						connState.transition(NOSERVICE);
					}
				};
			}
		}
		if (sc_ws.readyState === sc_ws.CLOSED) {
			throw("WebSocket readyState: " + sc_ws.readyState);
		}
	}
	catch (exception) {
		console.log(exception);
		setTimeout(function () { sc_establish_websocket(url); }, 2000);
	}
	return true;
}

function sc_version( callback )
{
    send_request_ws("version", callback);
}

function sc_list( callback )
{
    send_request_ws("list", callback, { "details": true });
}

function sc_add( data, type, overwrite, callback )
{
    if (callback && data.length > 0) {
        var add = {};
        add["overwrite"] = overwrite;
        add["file"] = data;
		add["data"] = true;
		add["type"] = type;
        send_request2("add", callback, add);
    }
}

function sc_enable( name, callback, save_credentials, user, pass, captcha, otp, verified, reorder )
{
	connState.setLastAttempted();
    if (callback && name && name.length > 0) {
        var enable = {};
        enable["name"] = name;
        enable["user"] = user || "";
        enable["pass"] = pass || "";
        enable["otp"] = otp || "";
        enable["captcha"] = captcha || "";
		enable["verified"] = verified ? true : false;
		enable["save_credentials"] = save_credentials ? true : false;
		enable["reorder"] = reorder ? true : false;
		send_request_ws("enable", callback, enable);
    }
}

function sc_sso_trigger_connection(connection_name, vpn_portal_port, callback, retry_on_failure )
{
	connState.setLastAttempted();
	if (callback && typeof callback === "function" && connection_name && connection_name.length > 0 &&
		vpn_portal_port && vpn_portal_port.length > 0)
	{
		var sso_trigger_connection = {};
		sso_trigger_connection["name"] = connection_name;
		sso_trigger_connection["vpn_portal_port"] = vpn_portal_port;
		retry_on_failure  = (typeof retry_on_failure  !== 'undefined') ? retry_on_failure : false;
		sso_trigger_connection["retry_on_failure "] = retry_on_failure ;

		send_request_ws("sso_trigger_connection", callback, sso_trigger_connection);
	}
}

function sc_captcha(name, callback, trusted, ignore_multi_gw_error)
{
    trusted = (typeof trusted !== 'undefined') ? trusted : false;
    ignore_multi_gw_error = (typeof ignore_multi_gw_error !== 'undefined') ? ignore_multi_gw_error : false;

	if (callback && typeof callback === "function" && name && name.length > 0) {
        send_request_ws("captcha", callback, { "name": name, "verified": trusted, "ignore_multi_gw_error": ignore_multi_gw_error });
    }
}

function sc_disable( name, callback )
{
	if (callback && typeof callback === "function" && name && name.length > 0) {
		send_request_ws("disable", callback, { "name": name });
    }
}

function sc_get(name, type, callback, wait)
{
	send_request_ws("get", callback, { "name": name, "type": type }, wait || 1200);
}

function sc_remove(name, callback) {
	send_request_ws("remove", callback, { "name": name });
}

function sc_update(name, callback, jsonData) {
    var update = jsonData;
	update["name"] = name;
    send_request_ws("update", callback, update);
}

function sc_cert(data, type, certdata, pwd, callback) {
    // certdata is a base64-encoded string
    if (data.length > 0 && certdata.length > 0 &&  pwd.length > 0 && typeof callback === "function") {
        var add = {};
		add["file"] = data;
		add["type"] = type;
        add["cert"] = certdata;
        add["pass"] = pwd;
        add["data"] = true;
        add["overwrite"] = true;
        send_request2("add", callback, add);
    }
}

function sc_hello(callback) {
	send_request_ws("hello", callback);
}

function sc_telem(callback) {
	if (typeof callback === "function") {
		send_request_ws("telem", callback);
    }
	return true;
}

// Returns the value for the named parameter
function get_param( name ) {
    var rx = new RegExp('[\&|\?]'+ name +'=([^\&\#]+)'),
    val = window.location.search.match(rx);
    return !val ? '':val[1];
}

function sc_close() {
    window.close();
}

var testResp = null;
function testAjaxCb(jObj) {
	testResp = jObj;
}
