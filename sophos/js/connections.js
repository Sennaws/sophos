
/* eslint no-constant-condition: ["error", { "checkLoops": false }] */
/* eslint no-fallthrough: "off" */
/* eslint no-extra-parens: "off" */

// connection states
const INIT = 0xFFFF;
const IMPORT = 0x00;
const READY = 0x01;
const CONNECT = 0x02;
const CREDENTIAL = 0x04;
const AUTHENTICATE = 0x08;
const MONITOR = 0x10;
const DISABLE = 0x40;
const NOSERVICE = 0x80;
const DELETE = 0x100;
const CERTIMPORT = 0x200;
const OUTAGE = 0x400;
const RETRY = 0x800;
const UPDATE = 0x1000;
const RECONNECT = 0x2000;
const SSO = 0x4000;

// status polling
const MONITOR_STATUS = 1;
const DYNAMIC_STATUS = 2;
const SERVICE_STATUS = 3;
const MONITOR_INTERVAL = 2000;
const SERVICE_INTERVAL = 1000;

const RESP_TIMEOUT = 30000;
const SEND_TIMEOUT = 5000;

// connection vpn_state values
const VPN_DISCONNECTED = 0;
const VPN_CONNECTING = 1;
const VPN_RECONNECTING = 2;
const VPN_CONNECTED = 3;
const VPN_DISCONNECTING = 4;

// connection auth_state values
const AUTH_NONE = 0x00;
const AUTH_NEED_USERPASS = 0x01;
const AUTH_NEED_OTP = 0x02;

const MAX_IMPORT_FILE_SIZE = 2097152; // 2MB (2 * 1024 * 1024)

const PROTO_IPSEC = 0;
const PROTO_SSLVPN_TCP = 1;
const PROTO_SSLVPN_UDP = 2;

let ACTIVE_CONN_KEY = "activeConnectionKey";

var isUnderTest = false;

//credentials across two captcha requests.
var user_captcha = "";
var pass_captcha = "";
var otp_captcha = "";
var captcha_length = 0;

// Below values are as same as the values given to status messages in enum defined in ClearSSOCookie.h
const SSO_COOKIE_DELETE_STATUS = {
	DELETE_SUCCESS : 0,
	DELETE_NOTEXIST : 1,
	DELETE_ERROR : -1
};

// The following enum depends on the SIGN_IN_METHOD_TYPE enum(in os_win.h file) in the engine code.
// Do not change the order of cases unless you also update the dependent enum accordingly.
const SignInMethodType ={
	LOCAL: 0,
	SSO: 1
};

function confirmDeleteCookies(message) {
	if (confirm(StatusMsg.getMsg(SC_SID_FORCE_SSO_RE_LOGIN_CONFIRM_MSG))) {
		sendFrameMessage(message);
	}
}

function sendFrameMessage(message) {
	// Only send if we are running from our frame
	if (getUrlParam("frame", "false") === "true") {
		document.location.href = "frame://" + message;
	}
}

var Notify = (function () {
	const connectTitle = "Connection established";
	const errorTitle = "Connection failed";
	return {
		tid: 0,
		state: "normal",
		title: connectTitle,
		msg: "",
		display: "noop",
		balloon: "optional",
		ctx: {},
		icon: function (iconState) {
			this.state = typeof iconState === "string" ? iconState : "normal";
			sendFrameMessage("notify?state=" + this.state);
		},
		ssoDetailsSend: function (ssoCtx) {
			let ctx = ssoCtx || this.ssoCtx;
			sendFrameMessage("sso_details?fqdn=" + ctx.fqdn + "&type=" + ctx.type + "&name=" + ctx.name);
		},
		reset: function () {
			this.tid = 0;
			this.state = "normal";
			this.title = connectTitle;
			this.msg = "";
			this.display = "noop";
			this.balloon = "optional";
			this.ctx = {};
		},
		set: function (ctx) {
			if (ctx) {
				this.ctx = ctx;
				this.state = ctx.state || this.state;
				this.title = ctx.title || this.title;
				this.msg = ctx.msg || this.msg;
				this.display = ctx.display;
				this.balloon = ctx.balloon;
			}
		},
		send: function (inCtx) {
			let ctx = inCtx || this.ctx;
			if (typeof ctx.msg === "undefined") {
				console.log("Missing notify message");
				return;
			}
			if (typeof ctx.msg !== "string" || ctx.msg.length === 0) {
				console.log("Missing notify message");
				return;
			}
			this.state = ctx.state || "connected";
			switch (this.state) {
				case "connected":
					this.title = ctx.title || connectTitle;
					this.msg = ctx.msg;
					break;
				case "error":
					this.title = ctx.title || errorTitle;
					this.msg = ctx.msg;
					break;
				case "normal":
				case "warning":
					this.title = ctx.title;
					this.msg = ctx.msg;
					break;
				default:
					return;
			}
			this.display = typeof ctx.display === "undefined" ? "noop" : ctx.display;
			this.balloon = typeof ctx.balloon === "undefined" ? "optional" : ctx.balloon;
			this.ctx = {};
			if (this.title === "") {
				this.title = this.state === "warning" ? "Warning" : this.state === "error" ? "Error" : " ";
			}
			sendFrameMessage("notify?state=" + this.state + "&title=" + this.title +
				"&message=" + this.msg + "&display=" + this.display + "&balloon=" + this.balloon);
		},
		hide: function () {
			clearTimeout(this.tid);
			$("#StatusAlert").fadeOut(1200);
		},
		show: function () {
			sendFrameMessage("notify?state=normal&display=show");
		},
		alert: function (ctx) {
			if (typeof ctx.msg === "undefined") {
				console.log("Missing notify message");
				return;
			}
			$("#statusAlertIcon").removeClass("error");
			$("#statusAlertIcon").removeClass("warning");
			$("#statusAlertIcon").addClass(ctx.state);
			$("#statusAlertTitle").text(ctx.title);
			$("#statusAlertMsg").text(ctx.msg);
			$("#StatusAlert").fadeIn(900);
			this.tid = setTimeout(this.hide, 10000);
		}
	};
}());

var Display = (function () {
	return {
		showDetails: function (sel) {
			$("#connectionDetails").hide();
			$("#authDetails").hide();
			$("#monitorDetails").hide();
			$("#importDetails").hide();
			$("#certDetails").hide();
			$("#outageDetails").hide();
			$("#retryDetails").hide();
			$("#byPassSslDetails").hide();
			if (typeof sel === "string" && sel.length > 0) {
				$(sel).show();
			}
			return this;
		},
		showPage: function (sel) {
			$("#ConnectionsPage").hide();
			$("#EventsPage").hide();
			$("#AboutPage").hide();
			$("#byPassSslDetails").hide();
			$("#IframePage").hide();
			$(sel).show();
			return this;
		},
		showMonitor: function (sel) {
			$("#monitorDetails div.monitors").hide();
			$("#monitorDetails div.transient").hide();
			$("#monitorDetails div" + sel).show();
			return this;
		},
		showConnection: function (sel) {
			$("#monitorDetails").hide();
			$("#connectionDetails #connectionsList").hide();
			$("#connectionDetails div.transient").hide();
			$("#byPassSslDetails").hide();
			$(sel).show();
			return this;
		}
	};
})();

var Credentials = (function () {
	let u = "";
	let p = "";
	let o = "";
	let c = "";
	return {
		set: function (user, pwd, otp, captcha) {
			u = user;
			p = pwd;
			o = otp;
			c = captcha;
			return this;
		},
		clear: function () {
			u = Math.random().toString();
			u = "";
			p = Math.random().toString();
			p = "";
			o = Math.random().toString();
			o = "";
			c = Math.random().toString();
			c = "";
		},
		user: function () {
			return u;
		},
		pwd: function () {
			return p;
		},
		otp: function () {
			return o;
		},
		captcha: function () {
			return c;
		}
	};
})();

let requestCbArray = [
	importCb,		// req_cmd_add = 0,
	removeCb,		// req_cmd_remove,
	refreshListCb,	// req_cmd_list,
	enableCb,		// req_cmd_enable,
	disableCb,		// req_cmd_disable,
	monitorStatusCb,// req_cmd_get,
	updateCb,		// req_cmd_update,
	versionCb,		// req_cmd_version,
	helloCb,		// req_cmd_hello,
	null,			// req_cmd_log,
	null,			// req_cmd_test,
	null,			// req_cmd_telem,
	captchaCb,      // req_cmd_captcha
	null,           // req_cmd_sso_cookie
	ssoTriggerCb	// req_cmd_sso_trigger_connection
];

function scrollList($elem, $parent) {
	if ($elem && $elem.length > 0) {
		let elem = $elem[0];
		let paddingTop = parseInt($elem.parents('ul').css('padding-top'), 10);
		let $offsetParent = $parent || $elem.parents('div.fieldset');
		let offsetParent = $offsetParent[0];
		let scrollToPos = 0;

		if ($elem.offset().top < $offsetParent.offset().top + paddingTop) {
			offsetParent.scrollTop = elem.offsetTop - paddingTop;
		}
		else if ($elem.offset().top + $elem.height() > offsetParent.scrollTop + $offsetParent.height()) {
			let delta = ($elem.offset().top + $elem.height()) - ($offsetParent.offset().top + $offsetParent.height());
			scrollToPos = offsetParent.scrollTop + $elem.height() + delta;
			// check for horizontal scrollbar and adjust if needed
			if (offsetParent.clientWidth < offsetParent.scrollWidth) {
				scrollToPos += offsetParent.offsetHeight - offsetParent.clientHeight;
			}
			if (scrollToPos >= offsetParent.scrollTop) {
				$offsetParent.scrollTop(scrollToPos);
			}
		}
	}
}

var connState = (function () {
	var activeConnection = "",
		connectionCount = 0,
		connections = {},
		connInfo = null,
		connFile = "",
		certFile = "",
		uid = 0,
		fileInfo = "",
		fileType = "",
		lastDynamic = {
			local_id: "",
			local_ip: "",
			local_port: "",
			virtual_ip: "",
			bytes_sent: 0,
			bytes_rcvd: 0,
			packets_sent: 0,
			packets_rcvd: 0
		},
		lastAttempted = "",
		lastEstablished = "",
		lastState = IMPORT,
		fullSupport = false,
		monitorViewId = "connectionIcon",   // default Monitor Page view (Connection)
		listReply = false,
		remoteTSArray = [],
		responseTs = Date.now(),
		sendTs = Date.now(),
		state = INIT,
		statusMsg = "",
		intervalTimerId = 0,
		rcTimerId = 0,
		wdTimerId = 0,
		updatepending = false,
		serviceTimerId = 0,
		ssoFqdn = "",
		ssoType = "";
		ssoConnectionName = "";
		lastConnectedVPNSignInMethod = SignInMethodType.LOCAL;

	return {
		init: function () {
			activeConnection = "";
			connectionCount = 0;
			connections = {};
			connInfo = null;
			connFile = "";
			certFile = "";
			uid = 0;
			fileInfo = "";
			fileType = "";
			lastDynamic = {
				local_id: "",
				local_ip: "",
				local_port: "",
				virtual_ip: "",
				bytes_sent: 0,
				bytes_rcvd: 0,
				packets_sent: 0,
				packets_rcvd: 0
			};
			lastAttempted = "";
			lastEstablished = "";
			lastState = IMPORT;
			fullSupport = false;
			monitorViewId = "connectionIcon";   // default Monitor Page view (Connection)
			listReply = false;
			remoteTSArray = [];
			responseTs = Date.now();
			sendTs = Date.now();
			state = INIT;
			statusMsg = "";
			intervalTimerId = 0;
			serviceTimerId = 0;
			ssoFqdn = "";
			ssoType = "";
			ssoConnectionName = "";
			lastConnectedVPNSignInMethod = SignInMethodType.LOCAL;
			return this;
		},
		isAppMenuActive: function () { return $("#appMenu.active").length > 0; },
		isConfig: function () { return $("#editMenu.active").length > 0; },
		isEditing: function () {
			let isEdit = true;
			let $editElem = $("li.connListItem div.listText.editable");
			if ($editElem.length > 0) {
				setTimeout(function () { focus.call(this); }, 50);
			}
			else {
				isEdit = false;
			}
			return isEdit;
		},
		addConnection: function (connInfo) {
			connections[connInfo.name] = connInfo;
			connectionCount++;
		},
		getConnection: function (name) { return connections[name]; },
		checkTSArray: function (inArray) {
			let newTSArray = inArray || null;
			let rVal = 0;
			let tsArray = this.getRemoteTSArray();
			if (Array.isArray(newTSArray)) {
				if (newTSArray.length !== tsArray.length) {
					this.setRemoteTSArray(newTSArray);
					rVal = 1;
				}
				else {
					for (var i = 0; i < tsArray.length; i++) {
						if (newTSArray[i] !== tsArray[i]) {
							this.setRemoteTSArray(newTSArray);
							rVal = 1;
							break;
						}
					}
				}
			}
			return rVal;
		},
		clearDynamic: function () {
			lastDynamic = {
				local_id: "",
				local_ip: "",
				local_port: "",
				virtual_ip: "",
				bytes_sent: 0,
				bytes_rcvd: 0,
				packets_sent: 0,
				packets_rcvd: 0
			};
		},
		getDynamic: function () { return lastDynamic; },
		setDynamic: function (newDyn) {
			for (var key in newDyn) {
				if (lastDynamic.hasOwnProperty(key)) {
					lastDynamic[key] = newDyn[key];
				}
			}
		},
		getSendTs: function () { return sendTs; },
		setSendTs: function (newTs) {
			let ts = newTs || Date.now();
			if (ts - sendTs > SEND_TIMEOUT) {
				this.setResponseTs(ts);
			}
			sendTs = ts;
		},
		checkResponseTimeout: function () {
			let curTs = Date.now();
			return curTs - responseTs >= RESP_TIMEOUT ? NOSERVICE : READY;
		},
		getResponseTs: function () { return responseTs; },
		setResponseTs: function (newTs) {
			//let prevTs = responseTs;
			responseTs = newTs || Date.now();
            /*
            if (responseTs - prevTs > 5000) {
                console.log("Received service response after " + (responseTs - prevTs) + " ms");
            }
            */
		},
		clearConnections: function () {
			connections = {};
			connectionCount = 0;
			connInfo = null;
			return null;
		},
		isExistingAlias: function (connName, displayName) {
			for (var key in connections) {
				if (key !== connName && connections[key].display_name === displayName) {
					return true;
				}
			}
			return false;
		},
		isExistingConnection: function (connName) {
			for (var key in connections) {
				if (key === connName) {
					return true;
				}
			}
			return false;
		},
		getLastConnected: function () {
			let lastConn = null;
			for (var key in connections) {
				let ctime = lastConn ? lastConn.connect_time : 0;
				if (connections[key].connect_time > ctime) {
					lastConn = connections[key];
				}
			}
			return lastConn;
		},
		getLastConnectedVPNSignInMethod: function () { return lastConnectedVPNSignInMethod; },
		setLastConnectedVPNSignInMethod: function (mType) { lastConnectedVPNSignInMethod = mType; },
		getLastAttempted: function () { return lastAttempted; },
		setLastAttempted: function () { lastAttempted = activeConnection; return this; },
		getLastEstablished: function () { return lastEstablished; },
		setLastEstablished: function () { lastEstablished = activeConnection; },
		getLastState: function () {
			return lastState;
		},
		isupdatepending: function () {
			return updatepending;
		},
		resetupdatepending: function () {
			updatepending = false;
		},
		setLastState: function (cState) {
			lastState = cState;
		},
		initListReply: function () { listReply = false; },
		getListReply: function () { return listReply; },
		setListReply: function () { listReply = true; },
		getActiveConnection: function () { return activeConnection; },
		setSsoFqdn: function (fqdn) { ssoFqdn = fqdn; },
		setSsoType: function (type) { ssoType = type; },
		setSsoConnectionName: function (connectionName) { ssoConnectionName = connectionName; },
		setActiveConnection: function (name) {
			if (name && name.length) {
				// Allow setting the active connection name when the connection itself is not yet added.
				// On import, we set the active connection name just before refreshing the connections list
				// so that the connection, which will be added via refreshCb, will be selected in the list
				// and saved into connInfo.
				activeConnection = name;
				//scStore.set(ACTIVE_CONN_KEY, name);
				if (connections[name]) {
					connInfo = connections[name];
				}
				else {
					connInfo = null;
				}
			}
			else {
				//scStore.remove(ACTIVE_CONN_KEY);
				activeConnection = "";
				connInfo = null;
			}
			if (connInfo && $("#logMenuItemLInk").length) {
				if (connInfo.vpn_type === "ssl") {
					if ($("#logMenuItemLInk").attr("href").indexOf("openvpn") === -1) {
						$("#logMenuItemLInk").attr("href", "http://127.0.0.1:60110/request?log=openvpn");
					}
				}
				else {
					if ($("#logMenuItemLInk").attr("href").indexOf("charon") === -1) {
						$("#logMenuItemLInk").attr("href", "http://127.0.0.1:60110/request?log=charon");
					}
				}
			}

			this.setLastConnectedVPNSignInMethod(SignInMethodType.LOCAL);

			if (connInfo) {
				if (connInfo.last_connected_vpn_sign_in_method != null) {
					this.setLastConnectedVPNSignInMethod(connInfo.last_connected_vpn_sign_in_method);
				} 
			}

			return this;
		},
		getActiveDisplayName: function () { return connInfo.display_name; },
		deleteConnection: function (name) {
			for (var key in connections) {
				if (key === name) {
					connections[key] = null;
					delete connections[key];
					if (--connectionCount <= 0) {
						connectionCount = 0;
						connInfo = null;
					}
					break;
				}
			}
		},
		getConnInfo: function () { return connInfo; },
		setConnInfo: function (name) {
			connInfo = name && name.length ? connections[name] : null; return this;
		},
		getCount: function () {
			return connectionCount;
		},
		updateConn: function (connentionname, coninfo) {
			if (connentionname && connentionname.length)
			{
				connections[connentionname] = coninfo;
				this.setConnInfo(this.getActiveConnection());
			}
		},
		getCertificateFile: function () { return certFile; },
		setCertificateFile: function (path) { certFile = path; },
		getUid: function () { return uid; },
		setUid: function (newUid) { uid = newUid; },
		getConnectionFile: function () { return connFile; },
		setConnectionFile: function (path) { connFile = path; },
		getFileInfo: function () { return fileInfo; },
		setFileInfo: function (fInfo) { fileInfo = fInfo; },
		getFileType: function () { return fileType; },
		setFileType: function (fType) { fileType = fType; },
		isFullSupport: function () { return fullSupport; },
		setFullSupport: function (isSupported) { fullSupport = isSupported; },
		getMonitorView: function () { return monitorViewId; },
		setMonitorView: function (id) {
			if (typeof id === "string") {
				if (id === "connectionIcon" || id === "networksIcon" || id === "securityIcon") {
					monitorViewId = id;
				}
			}
		},
		clearRemoteTSArray: function () { remoteTSArray = []; },
		getRemoteTSArray: function () { return remoteTSArray; },
		setRemoteTSArray: function (newArray) { remoteTSArray = newArray; },
		getState: function () { return state; },
		setState: function (newState) { state = newState; return this; },
		getStatusMsg: function () { return statusMsg; },
		setStatusMsg: function (msg) { statusMsg = msg; },
		setStatusPoll: function (type, delay) {
			let isDelay = delay || false;
			if (type === SERVICE_STATUS) {
				clearInterval(serviceTimerId);
				if (!isDelay) {
					sc_hello(helloCb);
				}
				serviceTimerId = setInterval(monitorService, SERVICE_INTERVAL);
			}
			else if (type === MONITOR_STATUS) {
				clearInterval(intervalTimerId);
				if (!isDelay) {
					monitorConnection();
				}
				intervalTimerId = setInterval(monitorConnection, MONITOR_INTERVAL);
			}
			else {
				clearInterval(intervalTimerId);
				this.clearDynamic();
				if (!isDelay) {
					monitorDynamic();
				}
				intervalTimerId = setInterval(monitorDynamic, MONITOR_INTERVAL);
			}
		},
		clearServiceTimerId: function () {
			clearInterval(serviceTimerId);
			serviceTimerId = 0;
		},
		getTimerId: function () { return intervalTimerId; },
		setTimerId: function (tid) {
			clearInterval(intervalTimerId);
			intervalTimerId = tid;
		},
		clearTimerId: function () {
			clearInterval(intervalTimerId);
			intervalTimerId = 0;
		},
		setReconnectTimer: function (tid) {
			rcTimerId = tid;
		},
		getReconnectTimer: function () {
			return rcTimerId;
		},
		clearReconnectTimer: function () {
			clearTimeout(rcTimerId);
			rcTimerId = 0;
		},
		setWatchdogTimer: function (tid) {
			wdTimerId = tid;
		},
		getWatchdogTimer: function () {
			return wdTimerId;
		},
		clearWatchdogTimer: function () {
			clearTimeout(wdTimerId);
			wdTimerId = 0;
		},
		transition: function (transState) {
			let cInfo = null;
			let $tab = $("#connectionsTab").parent("li.tab");
			let details = "";
			if (transState) {
				switch (transState) {
					case READY:
						lastState = state;
						$('#divMenu').removeAttr("disabled");
						if (state !== DISABLE && state !== MONITOR) {
							if (state === DELETE || state === NOSERVICE || state === IMPORT) {
								$("#statusImg").attr("class", "normal");
								if (Notify.state !== "normal") {
									Notify.icon("normal");
								}
							}
							else if (state === OUTAGE || state === INIT) {
								$("#statusImg").attr("class", "warning");
								Notify.icon("warning");
							}
							else {
								$("#statusImg").attr("class", "error");
								Notify.icon("error");
							}
							$("#connectBtn").removeAttr("disabled").text(Label.getText(SC_TID_STATUS_CONNECT_BTN)).attr("title", Label.getTitle(SC_TID_STATUS_CONNECT_BTN));
						}
						if (state === DELETE) {
							this.setActiveConnection("");
							if (this.getCount() > 0) {
								state = IMPORT;
								refresh_list();
							}
							else {
								state = INIT;
								$("#connectionsList").empty();
								if ($("#ConnectionsPage:visible").length > 0) {
									$("#connectionsTab").click();
								}
							}
						}
						else if (state === MONITOR) {
							state = READY;
							refresh_list();
						}
						else if (state === NOSERVICE) {
							if (this.getCount() > 0) {
								state = IMPORT;
								refresh_list();
							}
							else {
								state = INIT;
								if ($("#ConnectionsPage:visible").length > 0) {
									$("#connectionsTab").click();
								}
							}
						}
						else {
							if (state === CERTIMPORT) {
								if (connState.getCount() > 0) {
									Display.showDetails("#connectionDetails");
									$("#connectionsList li.selected").focus();
									state = READY;
								}
								else {
									$("#statusContentBtn").hide();
									if (!$("#statusContentImportBtn").hasClass('active')) {
										$("#statusContentImportBtn").addClass('active');
									}
									Display.showDetails("#importDetails");
									state = INIT;
								}
								break;
							}
							// state is either DISABLE or IMPORT
							if (state === IMPORT) {
								$("#statusContentImportBtn").removeClass('active');
								refresh_list();
							}
							else if (state === DISABLE) {
								state = READY;
								this.clearTimerId();
								refresh_list();
							}
						}
						break;
					case CREDENTIAL:
						$("#statusContentImportBtn").removeClass('active');
						this.clearTimerId();
						if (!connInfo.provisioned) {// If not provisoned then load the page once captcha is available
							Display.showDetails("#monitorDetails").showMonitor("#connecting");
							sc_captcha(this.getActiveConnection(), captchaCb, false, true);
							setupSSOUIElements();
							break;
						}
						user_captcha = ""; pass_captcha = ""; otp_captcha = ""; //Clear Captcha Session Credentials
						if (!connInfo.otp && (state === READY || state === INIT) && connInfo.saved_credentials) {
							state = AUTHENTICATE;
							$("#statusImg").attr("class", "loading");
							$("#connectBtn").attr("disabled", "disabled").removeAttr("title");
							if (connInfo.conn_type === "pro") {
								let dispName = connState.getActiveDisplayName();
								setStatusArea({
									"display_name": dispName,
									"vpn_state": VPN_CONNECTING,
									"details": Label.getText(SC_TID_UPDATE_CONNECTION_POLICY)
								}, false);
								Display.showDetails("#connectionDetails").showConnection("#updating");
								log(Label.getText(SC_TID_UPDATE_CONNECTION_POLICY) + " " + dispName);
							}
							else {
								$("#statusDetails").text(StatusMsg.getMsg(SC_SID_CONNECTING, this.getActiveDisplayName())).removeAttr('title');
								Display.showDetails("#monitorDetails").showMonitor("#connecting");
								log(StatusMsg.getMsg(SC_SID_CONNECTING, this.getActiveDisplayName()), StatusMsg.getLogLevel(SC_SID_CONNECTING));
							}
							sc_enable(this.getActiveConnection(), enableCb, connInfo.saved_credentials, "", "", "", false, true);
						}
						else {
							$("#connectBtn").removeAttr("disabled").text(Label.getText(SC_TID_STATUS_CANCEL_BTN)).attr("title", Label.getTitle(SC_TID_STATUS_CANCEL_BTN));
							$("#statusContentBtn").show();
							$("#statusName").text(this.getActiveDisplayName());
							if (state === AUTHENTICATE) {
								$("#authPageIntroText").show();
								if (connInfo.status && connInfo.status.id) {
									let sMsg = StatusMsg.getMsg(connInfo.status.id, connInfo.status.args);
									let sObj = {
										state: StatusMsg.getState(connInfo.status.id),
										title: StatusMsg.getTitle(connInfo.status.id), msg: sMsg
									};
									$("#statusImg").attr("class", StatusMsg.getState(connInfo.status.id));
									$("#statusDetails").text(sMsg).removeAttr("title");
									Notify.send(sObj);
								}
								else {
									$("#statusImg").attr("class", StatusMsg.getState(SC_SID_AUTH_FAILED));
									$("#statusDetails").text(StatusMsg.getMsg(SC_SID_AUTH_FAILED)).removeAttr("title");
									Notify.send(NMap.get(SC_SID_AUTH_FAILED));
									connInfo.connect_result = SC_SID_AUTH_FAILED;
								}
								if (connInfo.otp && connInfo.saved_credentials) {
									$("#authDetails .fieldset.credential").removeClass('active');
								}
								else {
									$("#authDetails .fieldset.credential").addClass('active');
								}
							}
							else {
								if ((connInfo.status.id !== SC_SID_AUTH_FAILED && connInfo.saved_credentials) || connInfo.vpn_state === VPN_CONNECTED) {
									$("#authPageIntroText").hide();
									$("#authDetails .fieldset.credential").removeClass('active');
									$("#statusDetails").text(Label.getPlaceholder(SC_TID_AUTH_PAGE_OTP)).removeAttr("title");
									if (connInfo.otp && connInfo.vpn_state === VPN_DISCONNECTED) {
										// user has enabled a connection with saved credentials requiring otp
										log(StatusMsg.getMsg(SC_SID_NEED_AUTH_ERR), StatusMsg.getLogLevel(SC_SID_NEED_AUTH_ERR) | LOGEVENT);
									}
								}
								else if (connInfo.auth_state === AUTH_NEED_OTP) {
									$("#statusDetails").text(Label.getPlaceholder(SC_TID_AUTH_PAGE_OTP)).removeAttr("title");
									$("#authDetails .fieldset.credential").removeClass('active');
								}
								else if (connInfo.auth_state === AUTH_NONE && connInfo.user_auth !== 0 ||       // auth_state is not set before a connection attempt, but policy requires user_auth
									connInfo.auth_state & AUTH_NEED_USERPASS) {
									$("#authPageIntroText").show();
									$("#authDetails .fieldset.credential").addClass('active');
									$("#statusDetails").text(StatusMsg.getMsg(SC_SID_NEED_AUTH_ERR)).removeAttr("title");
									if (connInfo.auth_state === AUTH_NONE) {
										// user has enabled a connection requiring user authentication from the GUI - log need credentials message
										log(StatusMsg.getMsg(SC_SID_NEED_AUTH_ERR), StatusMsg.getLogLevel(SC_SID_NEED_AUTH_ERR) | LOGEVENT);
									}
								}
								$("#statusImg").attr("class", "normal");
							}

							$("#user").removeAttr("disabled").val("");
							$("#pass").removeAttr("disabled").val("");
							$("#captcha").removeAttr("disabled").val("");
							$("#otp").val("");
							if (connInfo.otp) {
								$("#otpFieldset").addClass("active");
							}
							else {
								$("#otpFieldset").removeClass("active");
							}
							if (!connInfo.provisioned && captcha_length !== 0) {
								$("#captchaFieldset").addClass("active");
							}
							else {
								$("#captchaFieldset").removeClass("active");
							}
							if (connInfo.can_save && connInfo.conn_type === "pro" &&
								connInfo.auth_state !== AUTH_NEED_OTP && !connInfo.saved_credentials) {
								$("#saveCredentials").prop("checked", true).removeAttr("disabled").parent().show();
							}
							else if (connInfo.auth_state !== AUTH_NEED_OTP && connInfo.can_save && (state === AUTHENTICATE || !connInfo.saved_credentials)) {
								$("#saveCredentials").prop("checked", connInfo.saved_credentials).removeAttr("disabled").parent().show();
							}
							else {
								$("#saveCredentials").prop('checked', false).parent().hide();
							}
							if (!$("#authDetails .fieldset.credential").hasClass('active')) {
								$("#saveCredentials").prop('checked', false).attr("disabled", "disabled").parent().hide();
								$("#authPageIntroText").hide();
							}
							if ($("#EventsPage:visible").length > 0) {
								Display.showDetails("#authDetails");
								$("#connectionsTab").click();
							}
							else {
								Display.showDetails("#authDetails").showPage("#ConnectionsPage");
								if (connInfo.auth_state !== AUTH_NEED_OTP) {
									setTimeout(function () { setFocusOnEmptyElement(); }, 50);
								}
							}
							if (state !== UPDATE && state !== RECONNECT) {
								lastState = state;
								state = transState;
							}
							
							setupSSOUIElements();
						}
						break;
					case DISABLE:
						lastState = state;
						this.clearTimerId();
						if (state !== OUTAGE && state !== CREDENTIAL && state !== INIT && this.getLastState() !== DISABLE) {
							lastState = transState;
							$('#divMenu').attr("disabled", "disabled");
							log(StatusMsg.getMsg(SC_SID_DISABLING_CONNECTION, this.getActiveDisplayName()), StatusMsg.getLogLevel(SC_SID_DISABLING_CONNECTION));
							$("#disablingMsg").text(StatusMsg.getMsg(SC_SID_DISABLING_CONNECTION, "..."));
							Display.showMonitor("#disabling").showDetails("#monitorDetails");
							$("#statusImg").attr("class", "loading");
							$("#statusDetails").text(StatusMsg.getMsg(SC_SID_DISABLING_CONNECTION, "...")).removeAttr("title");
							$("#connectBtn").attr("disabled", "disabled").removeAttr("title");
							$('#monitorDetails .subTitle img').each(function () {
								if (typeof $(this).data("title") === "undefined") {
									$(this).data("title", $(this).prop("title"));
								}
								$(this).prop("title", "").attr("disabled", "disabled");
							});
						}
						if (state === OUTAGE) {
							lastState = DISABLE;
						}
						else {
							state = DISABLE;
						}
						sc_disable(this.getActiveConnection(), disableCb);
						break;
					case NOSERVICE:
						lastState = state;
						if (state !== NOSERVICE) {
							let nfy = NMap.get(SC_SID_SERVICE_UNAVAILABLE);
							log(nfy.title, LOGEVENT | LOGERR);
							log(nfy.msg, LOGEVENT | LOGERR);
							Notify.icon(nfy.state);
							state = NOSERVICE;
							$("#statusImg").attr("class", "error").show();
							$("#statusName").text(nfy.title);
							$("#statusDetails").html(StatusMsg.getStatusDetails(SC_SID_SERVICE_UNAVAILABLE)).removeAttr("title");
							$("#statusContentBtn").hide();
							$("#statusContentImportBtn").removeClass('active');
							$("#generateTSR").trigger("service:toggle");
							Display.showDetails();
						}
						this.clearTimerId();
						break;
					case SSO:
						let sso_auth_req_details = {
							fqdn: ssoFqdn,
							type: ssoType,
							name: ssoConnectionName
						};
						Notify.ssoDetailsSend(sso_auth_req_details);
						break;
					case DELETE:
						log(StatusMsg.getMsg(SC_SID_REMOVING_CONNECTION, this.getActiveDisplayName()), StatusMsg.getLogLevel(SC_SID_REMOVING_CONNECTION));
						$("#statusImg").attr("class", "loading");
						$("#statusName").text(this.getActiveDisplayName());
						$("#statusDetails").text(StatusMsg.getMsg(SC_SID_REMOVING_CONNECTION, "...")).removeAttr("title");
						$("#connectBtn").attr("disabled", "disabled").removeAttr("title");
						lastState = state = transState;
						sc_remove(this.getActiveConnection(), removeCb);
						break;
					case CERTIMPORT:
						state = CERTIMPORT;
						$("#connectBtn").removeAttr("disabled").text(Label.getText(SC_TID_STATUS_CANCEL_IMPORT_CERT_BTN)).attr("title", Label.getTitle(SC_TID_STATUS_CANCEL_IMPORT_CERT_BTN)).show();
						$("#statusContentBtn").show();
						$("#importCertFile").attr("disabled", "disabled");
						$("#divCertImport").addClass("disabled");
						$("#statusContentImportBtn").removeClass('active');
						Display.showDetails("#certDetails");
						$("#pk12Password").focus();
						lastState = transState;
						break;
					case OUTAGE:
						state = OUTAGE;
						// Change active tab to Connections tab
						$("#connectionsTriangle").addClass("triangle");
						$("#eventsTriangle").removeClass("triangle");
						$tab.addClass("active");
						$tab.siblings('li.tab').each(function () {
							$(this).removeClass("active");
						});
						// set the status area and display
						$("#statusImg").attr("class", StatusMsg.getState(SC_SID_NO_INTERNET_ERR));
						$("#statusDetails").html(StatusMsg.getStatusDetails(SC_SID_NO_INTERNET_ERR)).removeAttr("title");
						// For cancel state, text and title are the same string
						$("#connectBtn").removeAttr("disabled").text(Label.getText(SC_TID_STATUS_CANCEL_BTN)).attr("title", Label.getText(SC_TID_STATUS_CANCEL_BTN)).show();
						$("#statusContentBtn").show();
						$("#statusContentImportBtn").removeClass('active');
						$("#statusArea").show();
						// show the outage page
						Display.showDetails("#outageDetails").showPage("#ConnectionsPage");
						Notify.icon(StatusMsg.getState(SC_SID_NO_INTERNET_ERR));
						lastState = transState;
						break;
					case RETRY:
						state = RETRY;
						cInfo = this.getConnInfo();
						this.clearTimerId();
						// Change active tab to Connections tab
						$("#connectionsTriangle").addClass("triangle");
						$("#eventsTriangle").removeClass("triangle");
						$tab.addClass("active");
						$tab.siblings('li.tab').each(function () {
							$(this).removeClass("active");
						});
						// set the status area and display
						$("#statusImg").attr("class", StatusMsg.getState(cInfo.status.id));
						details = StatusMsg.getStatusDetails(cInfo.status.id, cInfo.status.args);
						$("#statusDetails").html(details).attr("title", StatusMsg.getMsg(cInfo.status.id, cInfo.status.args));
						// For cancel state, text and title are the same string
						$("#connectBtn").removeAttr("disabled").text(Label.getText(SC_TID_STATUS_CANCEL_BTN)).attr("title", Label.getText(SC_TID_STATUS_CANCEL_BTN)).show();
						$("#statusContentBtn").show();
						$("#statusContentImportBtn").removeClass('active');
						$("#statusArea").show();
						// show the retry page
						Display.showDetails("#retryDetails").showPage("#ConnectionsPage");
						Notify.icon(StatusMsg.getState(cInfo.status.id));
						lastState = transState;
						break;
					case RECONNECT:
					case UPDATE:
						state = transState;
						cInfo = this.getConnInfo();
						this.clearTimerId();
						this.clearReconnectTimer();
						this.clearWatchdogTimer();
						// Change active tab to Connections tab
						$("#connectionsTriangle").addClass("triangle");
						$("#eventsTriangle").removeClass("triangle");
						$tab.addClass("active");
						$tab.siblings('li.tab').each(function () {
							$(this).removeClass("active");
						});
						// set the status area and display
						let sId = cInfo.status.id !== 0 ? cInfo.status.id : SC_SID_TIMEOUT_ERR;
						$("#statusImg").attr("class", "error");
						// We cannot retry immediately because the engine is cleaning up the last attempt.
						// This currently can take nearly 20 seconds.  During connection or update attempts,
						// we prevent the user from cancelling the attempt to prevent state conflicts in the
						// engine.  So, we first show the retry page which allows the user to cancel the
						// attempt.  Following the delay, the connection is enabled or updated depending
						// on which state, RECONNECT or UPDATE, we are currently in.
						//let rcTimeout = state === UPDATE ? 5000 : 5000;
						let rcTimeout = 5000;
						connState.setReconnectTimer(setTimeout(function (state) {
							$("#statusImg").attr("class", "loading");
							$("#connectBtn").attr("disabled", "disabled");
							// Since user cannot cancel during enable or update attempts, start a watchdog.
							// The engine sometimes stops its connection/update attempt but leaves the
							// connection in connecting state.
							connState.clearWatchdogTimer();
							connState.setWatchdogTimer(setTimeout(function () {
								let cInfo = connState.getConnInfo();
								//sc_disable(connState.getActiveConnection(), disableCb);
								log(StatusMsg.getMsg(SC_SID_TIMEOUT_ERR));
								setTimeout(function () { connState.transition(RECONNECT); }, 50);
							}, 120000));

							if (connState.getConnInfo().otp && false === connState.isupdatepending()) {
								setTimeout(function () { connState.transition(CREDENTIAL); }, 50);
							}
							else if (connState.getState() === RECONNECT) {
								Display.showDetails("#monitorDetails").showMonitor("#connecting");
								sc_enable(connState.getActiveConnection(), enableCb, false, null, null, null, false, false);
							}
							else {
								Display.showDetails("#connectionDetails").showConnection("#updating");
								sc_update(connState.getActiveConnection(), updateConnectionCb, { "updateConnection": true });
								$("#connectBtn").attr("disabled", "disabled");
								connState.resetupdatepending();
							}
						}, rcTimeout));
						details = StatusMsg.getStatusDetails(sId);
						$("#statusDetails").html(details).attr("title", StatusMsg.getMsg(sId));
						// For cancel state, text and title are the same string
						$("#connectBtn").removeAttr("disabled").text(Label.getText(SC_TID_STATUS_CANCEL_BTN)).attr("title", Label.getText(SC_TID_STATUS_CANCEL_BTN)).show();
						$("#statusContentBtn").show();
						$("#statusContentImportBtn").removeClass('active');
						$("#statusArea").show();
						// show the retry page
						Display.showDetails("#retryDetails").showPage("#ConnectionsPage");
						Notify.icon("error");
						lastState = transState;
						if (state === UPDATE) {
							updatepending = true;
						}
						break;
					default:
						break;
				}
			} else {
				lastState = state;
				switch (state) {
					case IMPORT:
					case OUTAGE:
						$("#divMenu").removeAttr("disabled");
						if (connectionCount > 0) {
							state = READY;
							setStatusArea(this.getConnInfo());
							$("#connectBtn").removeAttr("disabled").text(Label.getText(SC_TID_STATUS_CONNECT_BTN)).attr("title", Label.getTitle(SC_TID_STATUS_CONNECT_BTN)).show();
							$("#statusContentImportBtn").removeClass('active');
							$("#statusContentBtn").show();
							if ($("#connectionDetails:visible").length === 0 || $("#ConnectionsPage:visible").length === 0) {
								Display.showDetails("#connectionDetails");
								if ($("#EventsPage:visible").length === 0 && $("#AboutPage:visible").length === 0) {
									$("#statusArea").show();
									Display.showPage("#ConnectionsPage");
								}
							}
						}
						break;
					case READY:
						cInfo = this.getConnInfo();
						state = CONNECT;
						Display.showDetails("#monitorDetails").showMonitor("#connecting");
						$("#statusContentImportBtn").removeClass('active');
						log(StatusMsg.getMsg(SC_SID_ESTABLISHING_CONNECTION, this.getActiveDisplayName()), StatusMsg.getLogLevel(SC_SID_ESTABLISHING_CONNECTION));
						$("#connectBtn").attr("disabled", "disabled").removeAttr("title");
						if (cInfo.vpn_state === VPN_RECONNECTING) {
							if (cInfo.status.id === 0) {
								$("#statusDetails").text(StatusMsg.getMsg(SC_SID_ESTABLISHING_CONNECTION, " ")).removeAttr("title");
							}
							else {
								details = StatusMsg.getStatusDetails(cInfo.status.id, cInfo.status.args);
								$("#statusDetails").html(details).attr("title", StatusMsg.getMsg(cInfo.status.id, cInfo.status.args));
							}
						}
						else {
							$("#statusDetails").text(StatusMsg.getMsg(SC_SID_ESTABLISHING_CONNECTION, " ")).removeAttr("title");
						}
						$("li.connListItem").each(function () {
							$(this).addClass("disabled");
						});
						$("#statusImg").attr("class", "loading");
						break;
					case CONNECT:
					case AUTHENTICATE:
						this.clearRemoteTSArray();
						this.setStatusPoll(MONITOR_STATUS);
						break;
					case MONITOR:
						cInfo = this.getConnInfo();
						$("#divMenu").removeAttr("disabled");
						{
							let nMsg = StatusMsg.getMsg(SC_SID_CONNECTED, this.getActiveDisplayName());
							let nObj = StatusMsg.get(SC_SID_CONNECTED);
							let sendObj = { state: nObj.state, title: nObj.title, msg: nMsg };
							log(nMsg, StatusMsg.getLogLevel(SC_SID_CONNECTED));
							Notify.send(sendObj);
						}
						state = MONITOR;
						this.setLastEstablished();
						this.setLastAttempted();
						connState.setStatusPoll(MONITOR_STATUS);
						if ($("#monitorDetails:visible").length === 0) {
							Display.showDetails("#monitorDetails");
						}
						$("#connectBtn").text(Label.getText(SC_TID_STATUS_DISCONNECT_BTN)).attr("title", Label.getTitle(SC_TID_STATUS_DISCONNECT_BTN)).removeAttr("disabled");
						$("#statusImg").attr("class", "connected");
						$("#statusDetails").html(StatusMsg.getStatusDetails(SC_SID_CONNECTED_TODAY, getTimeStamp(cInfo.connect_time * 1000))).removeAttr("title");
						$('#monitorDetails .subTitle img').each(function () {
							$(this).prop("title", $(this).data("title")).removeAttr("disabled");
						});
						setTimeout(function () { $("#" + connState.getMonitorView()).focus(); }, 50);
						break;
					case CREDENTIAL:
						state = AUTHENTICATE;
						$("#authDetails").hide();
						$("#user").val('').attr("disabled", "disabled");
						$("#pass").val('').attr("disabled", "disabled");
						$("#send").attr("disabled", "disabled");
						$("#connectBtn").attr("disabled", "disabled").removeAttr("title");
						$("#statusImg").attr("class", "loading");
						$("#statusDetails").text(Label.getText(SC_TID_AUTHENTICATING)).removeAttr("title");
						if (connInfo.conn_type === "pro") {
							log(Label.getText(SC_TID_UPDATE_CONNECTION_POLICY) + " " + connInfo.display_name);
							Display.showDetails("#connectionDetails").showConnection("#updating");
						}
						else {
							log(StatusMsg.getMsg(SC_SID_ESTABLISHING_CONNECTION, connState.getActiveDisplayName()), StatusMsg.getLogLevel(SC_SID_ESTABLISHING_CONNECTION));
							Display.showDetails("#monitorDetails").showMonitor("#connecting");
							$('#monitorDetails .subTitle img').each(function () {
								if (typeof $(this).data("title") === "undefined") {
									$(this).data("title", $(this).prop("title"));
								}
							});
						}
						break;
					case DISABLE:
						state = READY;
						$("#divMenu").removeAttr("disabled");
						$("#statusDetails").text(this.getStatusMsg()).removeAttr("title");
						$("#statusImg").attr("class", "normal");
						$("#connectBtn").removeAttr("disabled").text(Label.getText(SC_TID_STATUS_CONNECT_BTN)).attr("title", Label.getTitle(SC_TID_STATUS_CONNECT_BTN));
						$("li.connListItem").each(function () {
							let $this = $(this);
							$this.removeClass("disabled");
							if ($this.attr("id") === connState.getActiveConnection()) {
								$this.addClass("selected");
							}
						});
						break;
					case NOSERVICE:
					case INIT:
						$("#statusImg").attr("class", "normal");
						if (Notify.state !== "normal") {
							Notify.icon("normal");
						}
						if (state === INIT) {
							getVersion();
						}
						else {
							setTimeout(function () { log(StatusMsg.getMsg(SC_SID_SERVICE_ENABLED), StatusMsg.getLogLevel(SC_SID_SERVICE_ENABLED)); }, 50);
							$("#generateTSR").trigger("service:toggle");
						}
						state = IMPORT;
						refresh_list();
						break;
					case CERTIMPORT:
						$("#connectBtn").show();
						$("#divCertImport").removeClass("disabled");
						Display.showDetails("#connectionDetails");
						refresh_list();
						break;
					case RECONNECT:
						break;
					default:
						connState.setState(INIT);
						break;
				}
			}
		}
	};
}());

function getVersion() {
	sc_version(versionCb);
}

function versionCb(jresp) {
	let bResponse = false;
	let tms = 5000;
	do {
		if (jresp) {
			if (jresp.code === SC_SID_TIMEOUT_ERR || jresp.code === SC_SID_ERRORED_OUT) {
				// AJAX send failed; code is set by AJAX error handler, not by the scvpn engine
				if (connState.getState() === NOSERVICE) {
					tms = 60000;
				}
				break;
			}
			if (jresp.scvpn && jresp.scvpn.length > 0) {
				// scvpn is always set if scvpn engine has processed the request
				bResponse = true;
				log(StatusMsg.getMsg(SC_SID_SC_VERSION, jresp.scvpn));
				$("#sophosConnect div.listText").text(jresp.scvpn);
				// version is set only if scvpn engine has successfully queried strongSwan
				if (jresp.strongswan && jresp.strongswan.length > 0) {
					log(StatusMsg.getMsg(SC_SID_SS_VERSION, jresp.strongswan));
					$("#strongSwan div.listText").text(jresp.strongswan);
				}
				else {
					let msg = StatusMsg.getMsg(SC_SID_SS_VERSION_UNAVAILABLE);
					log(msg, StatusMsg.getLogLevel(SC_SID_SS_VERSION_UNAVAILABLE));
					$("#strongSwan div.listText").text(msg);
				}
				if (jresp.openvpn && jresp.openvpn.length > 0) {
					log(StatusMsg.getMsg(SC_SID_OPENVPN_VERSION, jresp.openvpn));
					$("#openVpn div.listText").text(jresp.openvpn);
				}
				else {
					let msg = StatusMsg.getMsg(SC_SID_SRV_DOWN_ERR);
					log(msg, StatusMsg.getLogLevel(SC_SID_SRV_DOWN_ERR));
					$("#openVpn div.listText").text(msg);
				}
			}
		}
	} while (false);
	if (!bResponse) {
		setTimeout(getVersion, tms);
	}
	return bResponse;
}

function enableCb(jresp) {
	let msg = jresp.msg;
	let cState = connState.getState();

	if (cState === CONNECT || cState === AUTHENTICATE || cState === RECONNECT) {
		switch (jresp.code) {
			case 0:
				//connState.transition();
				break;
			case SC_SID_ALREADY_ERR:
				connState.transition();
				break;
			case SC_SID_AUTH_FAILED:
				log(msg, StatusMsg.getLogLevel(SC_SID_AUTH_FAILED));
				connState.transition(CREDENTIAL);
				break;
			case SC_SID_NEED_AUTH_ERR:
				log(StatusMsg.getMsg(SC_SID_NEED_AUTH_ERR), StatusMsg.getLogLevel(SC_SID_NEED_AUTH_ERR));
				if (connState.getConnInfo().saved_credentials) {
					connState.setState(CREDENTIAL);
				}
				connState.transition(CREDENTIAL);
				break;
			case SC_SID_IDIR_MISMATCH_ERR:
				log(StatusMsg.getMsg(SC_SID_IDIR_MISMATCH_ERR), StatusMsg.getLogLevel(SC_SID_IDIR_MISMATCH_ERR));
				connState.setState(DISABLE);
				connState.transition(READY);
				break;
			case SC_SID_ADD_ROUTE_FAILED:
				// Failure to add route - msg from engine specifies route
				// TBD - send route as parameter
				break;
			case SC_SID_RESOLVE_ERR:
				// DNS resolution of gateway failed - engine should send argument
				log(StatusMsg.getMsg(SC_SID_RESOLVE_ERR), StatusMsg.getLogLevel(SC_SID_RESOLVE_ERR));
				connState.setState(DISABLE);
				connState.transition(READY);
				break;
			case SC_SID_PSK_MISMATCH_ERR:   // Pre-shared key mismatch
				// received upon pre-shared key mismatch
				log(StatusMsg.getMsg(SC_SID_PSK_MISMATCH_ERR), StatusMsg.getLogLevel(SC_SID_PSK_MISMATCH_ERR));
				connState.setState(DISABLE);
				connState.transition(READY);
				break;
			case SC_SID_CONN_NOT_FOUND:
			case SC_SID_INVALID_REQUEST:
			case SC_SID_ERR_SVC_BUSY:			// Unable to service request - please retry
			case SC_SID_IKE_NO_RESPONSE_ERR:    // No response from gateway
			case SC_SID_NO_INTERNET_ERR:    // No Internet connectivity
			case SC_SID_PING_SEND_ERR:      // Ping send failure
			case SC_SID_PING_RECV_ERR:      // Ping receive failure
			case SC_SID_SOCK_CREATE_ERR:    // Failure creating socket
			case SC_SID_SOCK_ADDR_ERR:      // Missing address info
			case SC_SID_IKE_SEND_ERR:       // IKE send failure
			case SC_SID_INVALID_P2_ID:
			case SC_SID_NO_PROPOSAL_ERR:
			case SC_SID_CHILD_SA_ERR:
			case SC_SID_CONN_LOAD_ERR:
			case SC_SID_CERT_LOAD_ERR:
			case SC_SID_SWAN_CMD_ERR:
			case SC_SID_IKE_NO_PROPOSAL_ERR:
				log(StatusMsg.getMsg(jresp.code), StatusMsg.getLogLevel(jresp.code));
				connState.setState(DISABLE);
				connState.transition(READY);
				break;
			case SC_SID_TIMEOUT_ERR:
			case SC_SID_SSL_CONNECTION_RESET:
				console.log(StatusMsg.getMsg(jresp.code));
				connState.transition(RECONNECT);
				break;
			case SC_SID_ERRORED_OUT:
				// Service polling will determine service availability and refresh the connections list
				// once the service is back.
				console.log(StatusMsg.getMsg(jresp.code));
				break;
			default:
				log(StatusMsg.getMsg(SC_SID_SYSTEM_ERR_MSG, jresp.code.toString(), msg), StatusMsg.getLogLevel(SC_SID_SYSTEM_ERR_MSG));
				connState.setState(DISABLE);
				connState.transition(READY);
				break;
		}
	}
	if (jresp.code !== 0 && (connState.getState() === READY || connState.getState() === INIT)) {		// INIT state needed to handle auto-start error upon launch
		let nMsg = msg;
		let nState = "error";
		if (StatusMsg.has(jresp.code)) {
			nMsg = jresp.args ? StatusMsg.getMsg(jresp.code, jresp.args) : StatusMsg.getMsg(jresp.code);
			nState = StatusMsg.getState(jresp.code);
		}
		Notify.send({ state: nState, msg: nMsg });
	}
}

function ssoTriggerCb(jresp)
{
	let msg = jresp.msg;
	let cState = connState.getState();

	if (cState === CONNECT || cState === AUTHENTICATE || cState === RECONNECT) {
		switch (jresp.code) {
			case 0:
				break;
			case SC_SID_SSO_NO_REACHABLE_ENABLED_PROV_GW:
			case SC_SID_SSO_GATEWAY_UNREACHABLE:
				console.log("ssotriggerCb : No SSO enabled reachable gateways");
				connState.setState(DISABLE);
				connState.transition(READY);
				break;
			default:
				log(StatusMsg.getMsg(SC_SID_SYSTEM_ERR_MSG, jresp.code.toString(), msg), StatusMsg.getLogLevel(SC_SID_SYSTEM_ERR_MSG));
				connState.setState(DISABLE);
				connState.transition(READY);
				break;
		}
	}
}

function updateCb(jresp) {
	let msg = jresp.msg;
	//this is a case that we want the reprovisioning to happen
	if ( jresp.proceedprovisioning === "true" )
	{
		let connectionname = connState.getActiveConnection();
		let coninfo = connState.getConnInfo();
		coninfo.conn_type = "pro";
		coninfo.provisioned = jresp.provisioned;
		connState.updateConn(connectionname,coninfo);
		connState.transition(CREDENTIAL);
		return;
	}

	switch (jresp.code) {
		case 0:
			// engine will update uid if needed to cause helloCb to refresh connections list
			//log('connection update complete');
			break;
		case SC_SID_INVALID_REQUEST:
			log(StatusMsg.getMsg(jresp.code), StatusMsg.getLogLevel(jresp.code));
			break;
		case SC_SID_TIMEOUT_ERR:
		case SC_SID_ERRORED_OUT:
			// drop silently since service monitoring will determine service availability
			break;
		case SC_SID_NEED_AUTH_ERR:
			msg = StatusMsg.getMsg(SC_SID_NEED_AUTH_ERR);
			log(StatusMsg.getMsg(SC_SID_NEED_AUTH_ERR), StatusMsg.getLogLevel(SC_SID_NEED_AUTH_ERR));
			connState.transition(CREDENTIAL);
			break;
		case SC_SID_UNTRUSTED_SERVER_ERR:
			// ignore this return code - a notification is also sent which pops up a confirmation dialog
			break;
		case SC_SID_POLICY_GATEWAY_CONNECT_ERR:
			console.log("updateCb received SC_SID_POLICY_GATEWAY_CONNECT_ERR");
			// ignore this return code - a notification is also sent which will be logged
			break;
		case SC_SID_NOT_PERMITTED_ERR:
			// ignore
			break;
		default:
			log(StatusMsg.getMsg(SC_SID_SYSTEM_ERR_MSG, jresp.code.toString(), msg), StatusMsg.getLogLevel(SC_SID_SYSTEM_ERR_MSG));
			break;
	}
}

function byPassSsl() {
	log(Label.getText(SC_TID_ACCEPTED_CERT_WARNING));
	Display.showDetails("#connectionDetails").showConnection("#updating");
	sc_captcha(connState.getActiveConnection(), captchaCb, true);
}

function byPassServerCertValidation(server) {
	$("#statusImg").attr("class", "warning");
	$("#statusDetails").html(Label.getStatusDetails(SC_TID_NOT_PRIVATE_CONNECTION)).removeAttr("title");
	$("#connectBtn").removeAttr("disabled").text(Label.getText(SC_TID_STATUS_CANCEL_BTN)).attr("title", Label.getTitle(SC_TID_STATUS_CANCEL_BTN));
	Display.showDetails("#byPassSslDetails");
	$("#connectingToServer").html(StatusMsg.getMsg(SC_SID_TRYING_TO_CONNECT, server)).removeAttr("title");

}

function helloCb(jresp) {
	let bChanged = false;
	let isThere = true;
	do {
		if (!jresp) {
			// ignore empty response - but we need to fix as this should never happen;
			// our ajax error handling should always send a response with code set.
			//isThere = false;
			break;
		}
		if (typeof jresp.code !== "undefined") {
			if (jresp.code === SC_SID_TIMEOUT_ERR || jresp.code === SC_SID_ERRORED_OUT) {
				isThere = false;
				break;
			}
		}
		if (connState.getState() === NOSERVICE) {
			let nfy = NMap.get(SC_SID_SERVICE_ENABLED);
			connState.setState(READY);
			log(StatusMsg.getMsg(SC_SID_SERVICE_ENABLED), StatusMsg.getLogLevel(SC_SID_SERVICE_ENABLED));
			Notify.icon(nfy.state);
			$("#generateTSR").trigger("service:toggle");
			$("#statusImg").attr("class", "normal");
			bChanged = true;
			break;
		}
		if (typeof jresp.notifications !== "undefined") {
			let nEntries = jresp.notifications;
			if ($.isArray(nEntries)) {
				nEntries.forEach(function (n) {
					if (NMap.has(n.id)) {
						// There is a notifyMsgArray entry matching this id
						let nObj = NMap.get(n.id);
						let nMsg = NMap.getMsg(n.id, n.args);
						let numArgs = nObj.args;
						if (n.id === SC_SID_NO_INTERNET_ERR) {
							log(nMsg, StatusMsg.getLogLevel(SC_SID_NO_INTERNET_ERR));
							connState.transition(OUTAGE);
							return;
						}
						else if (n.id === SC_SID_UNTRUSTED_SERVER_ERR) {
							byPassServerCertValidation(n.args[0]);
							return;
						}
						else if (n.id === SC_SID_AUTOIMPORT_SUCCESS) {
							if (n.args[0] && n.args[0].indexOf(', ') !== -1) {
								let conns = n.args[0].split(",");
								let lnames = [];
								conns.forEach(function (s) {
									let found = false;
									lnames.forEach(function (n) {
										if (n === s.trim()) {
											found = true;
											return false;
										}
									});
									if (!found) {
										lnames.push(s.trim());
									}
								});
								lnames.forEach(function (n) {
									log(StatusMsg.getMsg(SC_SID_CONNECTION_ADDED, n), StatusMsg.getLogLevel(SC_SID_CONNECTION_ADDED));
								});
							}
						}
						else if (n.id === SC_SID_BAD_COMPRESSION_ERR) {
							log(nMsg, StatusMsg.getLogLevel(n.id));
							sc_enable(connState.getActiveConnection(), enableCb, false, null, null, null, null);
							return;
						}
						else if (n.id === SC_SID_POLICY_UPLOAD_MSG || n.id === SC_SID_POLICY_GATEWAY_CONNECT_ERR) {
							log(nMsg, StatusMsg.getLogLevel(n.id));
							let cInfo = connState.getConnInfo();
							if (cInfo.status.id === 0) {
								cInfo.status = n;
							}
							connState.transition(UPDATE);
							return;
						}
						else if (n.id === SC_SID_TIMEOUT_ERR || n.id === SC_SID_SSL_CONNECTION_RESET) {
							log(nMsg, StatusMsg.getLogLevel(n.id));
							let cInfo = connState.getConnInfo();
							if (cInfo.status.id === 0) {
								cInfo.status = n;
							}
							if (connState.getLastConnectedVPNSignInMethod() === SignInMethodType.SSO) {
								let portValue = cInfo.sso_api_port;
								let connection_name = connState.getActiveConnection();
								sc_sso_trigger_connection(connection_name, portValue, ssoTriggerCb, true);
								connState.transition();
							} else {
								connState.transition(RECONNECT);
							}
							return;
						}
						else if (n.id === SC_SID_MGMT_SOCK_CONN_ERR) {
							log(nMsg, StatusMsg.getLogLevel(n.id));
							sc_disable(connState.getActiveConnection(), disableCb);
							connState.transition(RECONNECT);
							return;
						}
						else if (n.id === SC_SID_SSO_AUTH_WV2_SETUP_ERROR ||
							n.id === SC_SID_SSO_AUTH_FQDN_NAVIGATION_FAILED ||
							n.id === SC_SID_SSO_AUTH_USER_EMBEDDED_BROWSER ||
							n.id === SC_SID_SSO_AUTH_INVALID_AUTH_RESPONSE ||
							n.id === SC_SID_SSO_AUTH_TIMEOUT ||
							n.id === SC_SID_SSO_NOT_ENABLED_PROV_GW ||
							n.id === SC_SID_SSO_GATEWAY_UNREACHABLE ||
							n.id === SC_SID_SSO_NO_REACHABLE_ENABLED_PROV_GW ||
							n.id === SC_SID_SSO_CERTIFICATE_REVOKED ||
							n.id === SC_SID_SSO_CERTIFICATE_EXPIRED) {
							//No need to log any message as it is already logged
							//Add logic here if you need any action for these errors case
						}
						else if (n.id === SC_SID_SSO_TRIGGER_AUTH) {
							let connectionName = n.args[0];
							let fqdn = n.args[1];
							let connectionType = n.args[2];

							if (connectionName && connectionName.trim() !== "" &&
								fqdn && fqdn.trim() !== "" &&
								connectionType && connectionType.trim() !== "") {
								connState.setSsoFqdn(fqdn);
								connState.setSsoType(connectionType);
								connState.setSsoConnectionName(connectionName);

								connState.transition(SSO);
							}
						}
						else if (n.id === SC_SID_SSO_TRIGGER_CONN) {
							let connectionName = n.args[0];
							let portValue = n.args[1];
							let retryFlag = n.args[2];
							if (connectionName && connectionName.trim() !== "" && portValue && portValue.trim() !== "" && retryFlag) {
								let retryOnNetConnectFail = (retryFlag === "1");
								sc_sso_trigger_connection(connectionName.trim(), portValue, ssoTriggerCb, retryOnNetConnectFail);
								connState.transition();
							}
						}
						else if (n.id === SC_SID_RETRY_GATEWAY_REACHABILITY || n.id === SC_SID_RETRY_SSO_AUTH_SERVICE_REACHABILITY) {
							connState.transition(RETRY);
							return;
						}

						let sendObj = null;
						// If arguments are required for this entry, get total required
						if (numArgs) {
							// check arg list in entry against msg and replace
							if (n.args && typeof n.args !== "undefined" && $.isArray(n.args)) {
								nMsg = NMap.getMsg(n.id, n.args);
								sendObj = { state: nObj.state, title: nObj.title, msg: nMsg };
							}
							else {
								console.log("Missing arguments for Notify");
							}
						}
						else {
							sendObj = { state: nObj.state, title: nObj.title, msg: nMsg };
						}
						if (sendObj) {
							if (nObj.targets & STATUS_TARGET_EVENT) {
								if (n.id !== SC_SID_AUTOIMPORT_SUCCESS || n.args[0].indexOf(', ') === -1) {
									log(nMsg, (nObj.state === "error" ? LOGERR : nObj.state === "warning" ? LOGWARN : LOGINFO) | LOGEVENT);
								}
							}
							if (nObj.targets & STATUS_TARGET_SYSTEM) {
								Notify.send(sendObj);
							}
							if (nObj.targets & STATUS_TARGET_ALERT) {
								Notify.alert(sendObj);
								Notify.icon(sendObj.state);
							}
							console.log("Received notify: " + nMsg);
						}
						bChanged = true;
					}
				});
			}
		}
		if (typeof jresp.connections_uid !== "undefined" && jresp.connections_uid !== connState.getUid()) {
			let cState = connState.getState();
			let connInfo = connState.getConnInfo();
			if (cState === OUTAGE && !connInfo) {
				connInfo = connState.setConnInfo(connState.getLastAttempted()).getConnInfo();
			}
			if (!connInfo) {
				// If scvpn first starts with a connection having auto-connect enabled,
				// it sends a new connections_uid but there will not yet be an active connection
				// and therefore no connInfo will be available. Refreshing the list will
				// set the active connection and connInfo so the connect_result and vpn_state
				// will be available to check below.
				//console.log("Received connections_uid change but no connection is (yet) active");
				console.log("Received uid at startup - refreshing list");
				connState.setState(INIT);
				connState.setUid(jresp.connections_uid);
				refresh_list();
				return;
			}
			console.log("Received uid change");
			//console.log("connect_result: " + connInfo.connect_result);
			//console.log("vpn_state: " + connInfo.vpn_state);
			//console.log("Notify state: " + Notify.state);
			//console.log("state: " + cState + ", uid: " + jresp.connections_uid);
			if (connInfo.connect_result === 0 && connInfo.vpn_state === VPN_DISCONNECTED && Notify.state !== "normal") {
				Notify.icon("normal");
			}
			switch (cState) {
				case IMPORT:
				case CERTIMPORT:
					break;
				case CREDENTIAL:
					console.log("new uid in CREDENTIAL state");
					bChanged = true;
					break;
				case DELETE:
					console.log("new uid in DELETE state");
					bChanged = true;
					break;
				case DISABLE:
					Notify.icon();
					bChanged = true;
					break;
				case CONNECT:
					console.log("new uid in CONNECT state");
					bChanged = true;
					break;
				case AUTHENTICATE:
					console.log("new uid in AUTHENTICATE state");
					bChanged = true;
					break;
				case MONITOR:
					console.log("new uid in MONITOR state");
					bChanged = true;
					break;
				case OUTAGE:
					console.log("new uid in OUTAGE state");
					bChanged = true;
					break;
				case INIT:
				case READY:
				case RETRY:
					if (cState === INIT) {
						console.log("new uid in INIT state");
					}
					else if (cState === RETRY) {
						console.log("new uid in RETRY state");
					}
					else {
						console.log("new uid in READY state");
					}
					bChanged = true;
					break;
				case UPDATE:
					console.log("new uid in UPDATE state");
					//connState.clearReconnectTimer();
					//connState.clearWatchdogTimer();
					bChanged = true;
					break;
				case RECONNECT:
					console.log("new uid in RECONNECT state");
					connState.clearReconnectTimer();
					connState.clearWatchdogTimer();
					bChanged = true;
					break;
				default:
					break;
			}
		}
	} while (false);
	if (!isThere) {
		if (connState.getState() !== NOSERVICE) {
			if (connState.checkResponseTimeout() === NOSERVICE) {
				connState.transition(NOSERVICE);
			}
		}
	}
	else {
		if (bChanged) {
			connState.setUid(jresp.connections_uid);
			refresh_list();
		}
	}
}

function monitorStatusCb(jresp) {
	if (connState.getState() === DISABLE) {
		// ignore previously scheduled monitor poll which may fire while disabling.
		return;
	}
	try {
		if (jresp.code === 0) {
			let connInfo = connState.getConnInfo();

			if (jresp.config && jresp.config.child) {
				if (jresp.config.vpn_state !== VPN_CONNECTED) {
					return;
				}
				connInfo.vpn_state = jresp.config.vpn_state;
				connInfo.auth_state = jresp.config.auth_state;
				//connInfo["connect_result"] = jresp.config.history.connect_result;
				if ($("#ConnectionsPage:visible").length > 0) {
					if ($("#monitorViews ul:visible").length === 0) {
						$("#monitorViews").empty();
						if (!createMonitorPage(jresp)) {
							// some data not yet available; continue requesting all data
							return;
						}
					}
					connState.setStatusPoll(DYNAMIC_STATUS);
					return;
				}
			}
			else if (jresp.dynamic) {
				let dynamic = jresp.dynamic;
				let lastDyn = connState.getDynamic();
				let proto = dynamic.protocol || PROTO_IPSEC;

				if (checkData(dynamic, "dynamic", proto)) {
					if (dynamic.vpn_state !== VPN_DISCONNECTED) {
						if ($("ul.mNetworkList:visible").length > 0) {
							try {
								if (dynamic.local_ip !== lastDyn.local_ip || dynamic.local_port !== lastDyn.local_port) {
									lastDyn.local_ip = dynamic.local_ip;
									lastDyn.local_port = dynamic.local_port;
									$("ul.mNetworkList div text.local_ip").parent().next('div').text(dynamic.local_ip + " : " + dynamic.local_port);
								}
								$("ul.mNetworkList div text.rxBytes").parent().next('div').text(dynamic.bytes_rcvd);
								$("ul.mNetworkList div text.txBytes").parent().next('div').text(dynamic.bytes_sent);
								$("ul.mNetworkList div text.rxPackets").parent().next('div').text(dynamic.packets_rcvd);
								$("ul.mNetworkList div text.txPackets").parent().next('div').text(dynamic.packets_sent);
								if (dynamic.virtual_ip !== lastDyn.virtual_ip) {
									lastDyn.virtual_ip = dynamic.virtual_ip;
									if (dynamic.virtual_ip && dynamic.virtual_ip.length > 0) {
										// To get a virtual_ip here in the dynamic object the row will have been
										// added already in createMonitorPage when the config object is processed since
										// vip must be set in the configured connecton when it is loaded.
										// No need to call show(), just update the value.
										$("ul.mNetworkList div text.vip").parent().next('div').text(dynamic.virtual_ip);
									}
									else {
										// If for some reason the data is no longer set, hide the row.
										$("ul.mNetworkList div text.vip:visible").parents('li').hide();
									}
								}
							}
							catch (e) {
								// console.log(e);
							}
						}
						else if ($("ul.mSecurityList:visible").length > 0) {
							if (proto === PROTO_IPSEC) {
								try {
									$("ul.mSecurityList div text.p2Rekey").parent().next('div').text(convertRekey(dynamic.ipsec_rekey));
								}
								catch (e) {
									// console.log(e);
								}
								$("ul.mSecurityList div text.IKERekey").parent().next('div').text(convertRekey(dynamic.ike_rekey));
							}
							else {
								$("ul.mSecurityList div text.compression").parent().next('div').text(
									dynamic.sslvpn_compression ? Label.getText(SC_TID_TRUE) : Label.getText(SC_TID_FALSE));
							}
						}
						else if ($("ul.mConnList:visible").length > 0) {
							if (dynamic.local_id !== lastDyn.local_id) {
								lastDyn.local_id = dynamic.local_id;
								try {
									$("ul.mNetworkList div text.local_id").parent().next('div').text(dynamic.local_id);
								}
								catch (e) {
									// console.log(e);
								}
							}
						}
						if (Notify.state === "warning") {
							if (Notify.title === StatusMsg.getTitle(SC_SID_VPN_UNSTABLE)) {
								if (dynamic.bytes_rcvd > lastDyn.bytes_rcvd) {
									Notify.icon("connected");
								}
							}
							else if (dynamic.vpn_state === VPN_CONNECTED) {
								Notify.icon("connected");
							}
						}
						else if (Notify.state === "normal") {	// ensure that tray icon shows connected state
							Notify.icon("connected");
						}
						lastDyn.bytes_rcvd = dynamic.bytes_rcvd;
					}
					else {
						// stop monitoring - the IKE SA has been deleted;
						// helloCb will detect changed connections_uid and refresh the connections list
						connState.clearTimerId();
						return;
					}
				}
			}
		}
		else {
			switch (jresp.code) {
				case SC_SID_ERR_SVC_BUSY:
					break;
				case SC_SID_TIMEOUT_ERR:
				case SC_SID_ERRORED_OUT:
					// no response from server possibly due to network errors;
					// keep monitoring unless total failed attempts exceeded
					if (connState.checkResponseTimeout() === NOSERVICE) {
						connState.transition(NOSERVICE);
					}
					break;
				case SC_SID_CONN_LIST_ERR:
				// Failed to get Connections list
				case SC_SID_INVALID_REQUEST:
				// Invalid request
				case SC_SID_CONN_NOT_FOUND:
					// Connection not found - possible deletion by CLI
					log(StatusMsg.getMsg(jresp.code), StatusMsg.getLogLevel(jresp.code));
					connState.setState(DISABLE);
					connState.transition(READY);
					break;
				default:
					log(StatusMsg.getMsg(SC_SID_SYSTEM_ERR_MSG, jresp.code.toString(), jresp.msg || "none"), StatusMsg.getLogLevel(SC_SID_SYSTEM_ERR_MSG));
					// for now, just log unhandled codes since we don't know how to process -
					// since we handle SC_SID_SVC_STOPPED_ERR and SC_SID_TIMEOUT_ERR and SC_SID_ERRORED_OUT
					// there is no reason to go to NOSERVICE state since we have received a
					// response and therefore the service is definitely available.
					break;
			}
		}
	}
	catch (err) {
		let responseErr = false;
		let connInfo = connState.getConnInfo();
		if (!jresp) {
			log(StatusMsg.getMsg(SC_SID_MISSING_RESPONSE), StatusMsg.getLogLevel(SC_SID_MISSING_RESPONSE));
			responseErr = true;
		}
		if (responseErr) {
			connState.transition(READY);
		}
	}
}

function captchaCb(jresp) {
	let state = connState.getState();
	let connInfo = connState.getConnInfo();

	// it is success and we have a valid json response
	if (jresp && jresp.code === 0 ) {
		let captchaValue = jresp.captcha;
		captcha_length = captchaValue.length;
		if (captcha_length === 0) {
			if (connInfo.saved_credentials && !connInfo.otp) {
				// no captcha on fw and we have saved cred
				sc_enable(connState.getActiveConnection(), enableCb, false, null, null, null, null, false, true);
				return;
			}
		}

		$("#imgCaptcha").attr("src", captchaValue);
		$("#statusImg").attr("class", StatusMsg.getState(connInfo.status.id));
		$("#connectBtn").removeAttr("disabled").text(Label.getText(SC_TID_STATUS_CANCEL_BTN)).attr("title", Label.getTitle(SC_TID_STATUS_CANCEL_BTN));
		$("#authPageIntroText").show();
		$("#authDetails .fieldset.credential").addClass('active');
		$("#statusDetails").text(StatusMsg.getMsg(SC_SID_NEED_AUTH_ERR)).removeAttr("title");
		$("#user").removeAttr("disabled").val(user_captcha);
		$("#pass").removeAttr("disabled").val(pass_captcha);
		if (captcha_length !== 0) {
			$("#captcha").removeAttr("disabled").val("");
		}
		$("#otp").val(otp_captcha);
		if (connInfo.otp) {
			$("#otpFieldset").addClass("active");
		}
		else {
			$("#otpFieldset").removeClass("active");
		}

		/*if (connInfo.can_save && connInfo.conn_type === "pro" &&
			connInfo.auth_state !== AUTH_NEED_OTP && !connInfo.saved_credentials) {
			$("#saveCredentials").prop("checked", true).removeAttr("disabled").parent().show();
		}
		else if (connInfo.auth_state !== AUTH_NEED_OTP && connInfo.can_save && (state === AUTHENTICATE || !connInfo.saved_credentials)) {
			$("#saveCredentials").prop("checked", connInfo.saved_credentials).removeAttr("disabled").parent().show();
		}
		else {
			$("#saveCredentials").prop('checked', false).parent().hide();
		}*/
		/*if (!$("#authDetails .fieldset.credential").hasClass('active')) {
			$("#saveCredentials").prop('checked', false).attr("disabled", "disabled").parent().hide();
			$("#authPageIntroText").hide();
		}
		if ($("#EventsPage:visible").length > 0) {
			Display.showDetails("#authDetails");
			$("#connectionsTab").click();
		}
		else {
			Display.showDetails("#authDetails").showPage("#ConnectionsPage");
			if (connInfo.auth_state !== AUTH_NEED_OTP) {
				setTimeout(function () { setFocusOnEmptyElement(); }, 50);
			}
		}
		if (state !== UPDATE && state !== RECONNECT) {
			lastState = state;
			state = CREDENTIAL;
		}*/

		connState.setState(CREDENTIAL);
		Display.showDetails("#authDetails");
		if (captcha_length === 0)
		{
			$("#captchaFieldset").removeClass("active");
			if (connInfo.saved_credentials) {
				$("#authPageIntroText").hide();
				$("#saveCredentials").prop('checked', false).parent().hide();
				$("#authDetails .fieldset.credential").removeClass('active');
				$("#statusDetails").text(Label.getPlaceholder(SC_TID_AUTH_PAGE_OTP)).removeAttr("title");
				setTimeout(function () { setFocusOnEmptyElement(); }, 50);
				return;
			}
		}
		else
		{
			$("#captchaFieldset").addClass("active");
		}

		if (connInfo.can_save)
		{
			$("#saveCredentials").removeAttr("disabled").parent().show();
		}
		else
		{
			$("#saveCredentials").prop('checked', false).parent().hide();
		}
		setTimeout(function () { setFocusOnEmptyElement(); }, 50);
	}
}

function setFocusOnEmptyElement() {
	let connInfo = connState.getConnInfo();
	if (user_captcha === "")
		$("#user").focus();
	else if (pass_captcha === "")
		$("#pass").focus();
	else if (connInfo.otp && otp_captcha === "")
		$("#otp").focus();
	else
		$("#captcha").focus();

}

function monitorService() {
	sc_hello(helloCb);
}

function monitorDynamic() {
	if (connState.getActiveConnection().length > 0) {
		sc_get(connState.getActiveConnection(), "dynamic", monitorStatusCb);
	}
}

function monitorConnection() {
	if (connState.getActiveConnection().length > 0) {
		sc_get(connState.getActiveConnection(), "all", monitorStatusCb);
	}
	else if (connState.getState() !== OUTAGE) {
		connState.setState(INIT);
	}
}

function setStatusArea(statusInfo, isError) {
	if (statusInfo) {
		let icon = isError ? "error" : statusInfo.vpn_state === VPN_CONNECTED ? "connected" : statusInfo.vpn_state === VPN_CONNECTING ? "loading" : StatusMsg.getState(statusInfo.connect_result);
		$("#statusName").text(statusInfo.display_name);
		let details = statusInfo.auto_connect && statusInfo.auto_connect.enabled && statusInfo.auto_connect.on_network ? StatusMsg.getStatusDetails(SC_SID_ON_NETWORK) : statusInfo.details;
		$("#statusDetails").html(details);
		$("#statusImg").attr("class", icon);
		// If status name has exceeded available space, css rule will truncate (with ellipsis)
		// so show the full display name in title tooltip; else, no need for the tooltip.
		if ($("#statusName").length && $("#statusName")[0].offsetWidth < $("#statusName")[0].scrollWidth) {
			if (statusInfo.display_name === Label.getText(SC_TID_FILE_IMPORT_ERROR)) {
				$("#statusName").prop("title", statusInfo.display_name);
			}
			else {
				$("#statusName").prop("title", Label.getText(SC_TID_MONITOR_CONNECTION_NAME) + " " + statusInfo.name);
			}
		}
		else {
			$("#statusName").prop("title", "");
		}
		if ($("#statusDetails").length && $("#statusDetails")[0].offsetWidth < $("#statusDetails")[0].scrollWidth) {
			let titleStr = statusInfo.status ? StatusMsg.getMsg(statusInfo.status.id, statusInfo.status.args) : "";
			if (titleStr === "") {
				titleStr = $("#statusDetails").text();
			}
			$("#statusDetails").attr("title", titleStr);
		}
		else {
			$("#statusDetails").removeAttr("title");
		}
	}
}

function onChangeConnectionsList($sel) {
	let connName = $sel.attr('data-conn');
	let connInfo = connState.getConnection(connName);
	if (connInfo.connect_result) {
		connInfo.details = StatusMsg.getStatusDetails(connInfo.connect_result, connInfo.status.args);
	}

	connState.setActiveConnection(connName);
	connState.setLastAttempted();
	//scStore.set(ACTIVE_CONN_KEY, connName);

	setStatusArea(connInfo);
	$("#connectionsList li.selected div.subtext").html(connInfo.details);

	scrollList($sel);
	$sel.focus();
}

function onClickConnect(evt) {
	let target = evt.currentTarget || evt.target;
	let $elem = $(target);
	let elemText = $elem.text();
	let currState = connState.getState();
	let connInfo = connState.getConnInfo();
	user_captcha = ""; pass_captcha = ""; otp_captcha = ""; //Clear Captcha Session Credentials
	evt.stopImmediatePropagation();
	if (!connInfo) {
		let cName = connState.getLastAttempted();
		if (cName === "") {
			cName = connState.getActiveConnection();
		}
		if (cName && cName.length > 0) {
			connInfo = connState.setConnInfo(cName).getConnInfo();
		}
	}
	if (!connState.isEditing() && !connState.isConfig() && !connState.isAppMenuActive()) {
		if (elemText === Label.getText(SC_TID_STATUS_CANCEL_BTN) || currState === MONITOR) {
			if (currState === RECONNECT || currState === UPDATE) {
				connState.clearReconnectTimer();
				connState.clearWatchdogTimer();
			}
			if (currState === OUTAGE) {
				connState.transition(DISABLE);
			}
			else if (currState === CERTIMPORT) {
				$("#pk12Password").val(Math.random().toString()).val('');
				connState.transition.call(DISABLE);
			}
			else if (connInfo && connInfo.auth_state === AUTH_NEED_OTP && connInfo.vpn_state === VPN_CONNECTED) {
				// cancelling from auth page when connected and re-entry of OTP is required
				connState.setState(MONITOR);
				log(StatusMsg.getMsg(SC_SID_AUTH_CANCELLED), StatusMsg.getLogLevel(SC_SID_AUTH_CANCELLED) | LOGEVENT);
				connState.transition(DISABLE);
			}
			else if (currState === CREDENTIAL) {
				$("#user").val(Math.random().toString()).val("");
				$("#pass").val(Math.random().toString()).val("");
				$("#otp").val(Math.random().toString()).val("");
				log(StatusMsg.getMsg(SC_SID_AUTH_CANCELLED), StatusMsg.getLogLevel(SC_SID_AUTH_CANCELLED) | LOGEVENT);
				connState.setLastAttempted();
				if (connInfo) {
					// for a non provisioned connection we might have started the captcha session
					// forcing the state to disable makes the captcha session cleanup
					if (!connInfo.provisioned) {
						connState.setState(INIT);
						connState.transition(DISABLE);
						return;
					}
					if (connInfo.status.id === SC_SID_NEED_OTP && connInfo.vpn_state === VPN_DISCONNECTED && connInfo.auth_state === AUTH_NEED_OTP) {
						// cancelling from auth page upon auto-connecting connection with saved credentials that requires otp
						connState.setState(INIT);
						connState.transition(DISABLE);
						return;
					}
					if (connInfo.vpn_state === VPN_DISCONNECTED && connInfo.auth_state === AUTH_NONE) {
						// user enabled a connection requiring user authentication or
						// user enabled a connection with saved credentials requiring otp.
						// In these two cases, the auth page is shown before the connection is enabled in the engine
						// so there is no need to disable.
						refresh_list();
						return;
					}
					if (connInfo.status.id === SC_SID_NEED_AUTH_ERR && connInfo.vpn_state === VPN_DISCONNECTED && connInfo.auth_state & AUTH_NEED_USERPASS) {
						// auto-connecting connection without saved credentials requiring user credentials with or without otp
						connState.setState(INIT);
						connState.transition(DISABLE);
						return;
					}
					if (connInfo.status.id === SC_SID_AUTH_FAILED && (connInfo.auth_state & AUTH_NEED_USERPASS)) {
						// cancel from auth page after user authentication failed:
						// wrong user name or password entered for non-otp connection or
						// any of user name, password, or otp is incorrect for otp connection
						connState.setState(INIT);
						connState.transition(DISABLE);
						return;
					}
				}
				connState.transition(DISABLE);
			}
			else {
				if (currState !== MONITOR) {
					connState.setState(INIT);
				}
				connState.transition(DISABLE);
			}
		}
		else if (currState === READY) {
			let connInfo = connState.getConnInfo();
			Notify.icon();
			setStatusArea(connInfo);
			if (connInfo.user_auth !== 0) {
				connState.transition(CREDENTIAL);
			}
			else {
				connState.transition();
				sc_enable(connState.getActiveConnection(), enableCb, false, null, null, null, null, false, true);
			}
		}
		else {
			connState.transition();
		}
	}
	else if (connState.isConfig()) {
		$("#editMenu").removeClass('active');
		$elem.focus();
	}
	else if (connState.isAppMenuActive()) {
		$("#appMenu").toggleClass('active');
		$("#divMenu").focus();
	}
	else {
		if (!saveConnectionName($('li.connListItem.selected div.listText.editable'))) {
			setTimeout(function () { $elem.focus(); }, 50);
		}
	}
}

function keyCb(evt) {
	let $elem = $(evt.currentTarget).find('li.selected');
	let $next = $elem.next();
	let $prev = $elem.prev();
	if (!evt.isDefaultPrevented()) {
		switch (evt.keyCode) {
			case 9:
				// Tab
				$elem.blur();
				if (evt.shiftKey) {
					$("#connectBtn").focus();
				} else {
					setTimeout(function () { $("#connectionsTab").focus(); }, 50);
				}
				break;
			case 13:
			case 32:
				//  Enter or Space Bar
				if (connState.getConnInfo().user_auth !== 0) {
					connState.transition(CREDENTIAL);
				}
				else {
					connState.transition();
					sc_enable(connState.getActiveConnection(), enableCb, false, null, null, null, null, false, true);
				}
				break;
			case 38:
				// Arrow up
				if ($prev.length) {
					$elem.removeClass('selected').blur();
					$prev.addClass('selected');
					$prev.focus();
					onChangeConnectionsList($prev);
				}
				break;
			case 39:
				// Right Arrow
				if ($("#editMenu.active").length === 0) {
					$elem.find('.editIcon').click();
				}
				break;
			case 40:
				// Arrow down
				if ($next.length) {
					$elem.removeClass('selected').blur();
					$next.addClass('selected');
					$next.focus();
					onChangeConnectionsList($next);
				}
				break;
			case 46:
				// Delete key
				if (confirm(StatusMsg.getMsg(SC_SID_REMOVE_CONNECTION_CONFIRM, connState.getActiveConnection()))) {
					connState.transition(DELETE);
				}
				break;
			default:
				break;
		}
		evt.preventDefault();
		evt.stopImmediatePropagation();
	}
	return 1;
}

// When retrying to refresh the list, delay in increments of 500ms until the delay reaches 5 seconds;
// the failure is most likely because scvpn was unable to connect to strongSwan or is processing another
// request (possibly for the same reason) so there's no point in retrying too frequently.
var listRetryDelay = 500;
function refreshListCb(jresp) {
	if (jresp && jresp.code) {
		switch (jresp.code) {
			case 0:
				break;
			case SC_SID_ERR_SVC_BUSY:
			case SC_SID_TIMEOUT_ERR:
			case SC_SID_ERRORED_OUT:
				setTimeout(refresh_list, listRetryDelay);
				if (listRetryDelay < 5000) {
					listRetryDelay += 500;
				}
				return;
			default:
				if (StatusMsg.has(jresp.code)) {
					log(StatusMsg.getMsg(jresp.code), StatusMsg.getLogLevel(jresp.code));
				}
				else {
					log(StatusMsg.getMsg(SC_SID_SYSTEM_ERR_MSG, jresp.code.toString(), jresp.msg || "none"), StatusMsg.getLogLevel(SC_SID_SYSTEM_ERR_MSG));
				}
				return;
		}
	}
	if (!connState.getListReply()) {
		connState.setListReply();
	}
	$("#connectionsList").empty();
	if (jresp && jresp.connections) {
		// refresh local list with new list response
		connState.clearConnections();
		connState.setActiveConnection("");
		for (let i = 0; i < jresp.connections.length; i++) {
			let connInfo = jresp.connections[i];
			// normalize connInfo for unit tests - these members will be set when connections are received from engine
			if (!connInfo.status) {
				connInfo["status"] = { id: 0, args: [] };
			}
			if (!connInfo.auto_connect) {
				connInfo["auto_connect"] = { enabled: false, mode: 1, on_network: false };
			}
			if (!connInfo.vpn_state) {
				connInfo["vpn_state"] = VPN_DISCONNECTED;
			}
			if (!connInfo.auth_state) {
				connInfo["auth_state"] = AUTH_NONE;
			}
			connState.addConnection(connInfo);
			jresp.connections[i] = connInfo;
		}
		for (let i = 0; i < jresp.connections.length; i++) {
			let connInfo = jresp.connections[i];
			let vpn_state = connInfo.vpn_state || VPN_DISCONNECTED;
			let auth_state = connInfo.auth_state || AUTH_NONE;
			if (vpn_state !== VPN_DISCONNECTED) {
				connState.setActiveConnection(connInfo.name);
			}
			else if (connInfo.status && connInfo.status.id !== 0 && connState.getLastAttempted().length > 0 && connInfo.name === connState.getLastAttempted()) {
				connState.setActiveConnection(connInfo.name);
			}
			if (vpn_state === VPN_CONNECTING) {
				console.log("VPN state is connecting");
				if (connInfo.auth_type !== 0) {
					if (connInfo.saved_credentials) {
						$("#statusDetails").html(StatusMsg.getMsg(SC_SID_CONNECTING, connInfo.display_name), StatusMsg.getLogLevel(SC_SID_CONNECTING));
						$("#statusDetails").attr("title", $("#statusDetails").text());
					}
					else {
						$("#statusDetails").text(Label.getText(SC_TID_AUTHENTICATING)).removeAttr("title");
					}
					connState.setState(AUTHENTICATE);
				}
				else {
					$("#statusDetails").text(Label.getText(SC_SID_ESTABLISHING_CONNECTION)).removeAttr("title");
					connState.setState(CONNECT);
				}
				if ($("#connecting:visible").length === 0) {
					Display.showDetails("#monitorDetails").showMonitor("#connecting");
					$("#connectBtn").attr("disabled", "disabled").removeAttr("title");
					$("#statusName").text(connInfo.display_name);
					$("#statusImg").attr("class", "loading");
					log(StatusMsg.getMsg(SC_SID_ESTABLISHING_CONNECTION, connState.getActiveDisplayName()), StatusMsg.getLogLevel(SC_SID_ESTABLISHING_CONNECTION));
					$('#monitorDetails .subTitle img').each(function () {
						if (typeof $(this).data("title") === "undefined") {
							$(this).data("title", $(this).prop("title"));
						}
					});
				}
				return;
			}
			else if (vpn_state === VPN_CONNECTED) {
				console.log("VPN state is connected");
				connState.clearReconnectTimer();
				connState.clearWatchdogTimer();
				setStatusArea(connInfo);
				connState.setActiveConnection(connInfo.name);
				
				if ((auth_state & AUTH_NEED_USERPASS) === AUTH_NEED_USERPASS ||
					(auth_state & AUTH_NEED_OTP) === AUTH_NEED_OTP) {
					Notify.show();
					Notify.icon(NMap.get(SC_SID_NEED_AUTH_ERR).state);
					connState.setActiveConnection(connInfo.name);
					connState.transition(CREDENTIAL);
				}
				else if (connState.getState() !== MONITOR) {
					connState.setState(MONITOR);
					connState.transition();
				}
				return;
			}
			else if (vpn_state === VPN_RECONNECTING) {
				if ((auth_state & AUTH_NEED_USERPASS) === AUTH_NEED_USERPASS ||
					(auth_state & AUTH_NEED_OTP) === AUTH_NEED_OTP) {
					Notify.show();
					Notify.icon(NMap.get(SC_SID_NEED_AUTH_ERR).state);
					connState.setActiveConnection(connInfo.name);
					connState.transition(CREDENTIAL);
					return;
				}
				if (connState.getState() === RECONNECT || connState.getState() === UPDATE) {
					connState.transition(connState.getState());
					return;
				}
				let statusId = connInfo.status ? connInfo.status.id : SC_SID_BASE - 1;
				switch (statusId) {
					// failures due to transient condition that may resolve itself - retry
					case SC_SID_IKE_NO_RESPONSE_ERR:
						connState.transition(RETRY);
						return;
					case SC_SID_AUTH_FAILED:
						connState.setState(AUTHENTICATE);
						connState.transition(CREDENTIAL);
						return;
					case SC_SID_RESOLVE_ERR:
					case SC_SID_INVALID_P2_ID:
					case SC_SID_CHILD_SA_ERR:
					case SC_SID_IKE_NO_PROPOSAL_ERR:
					case SC_SID_PSK_MISMATCH_ERR:
					case SC_SID_ADD_ROUTE_FAILED:
					case SC_SID_INVALID_SERVER_CERT:
					case SC_SID_IDIR_MISMATCH_ERR:
						// failures that are not due to transient condition -
						// send disable ipc to clear retry state
						connState.transition(DISABLE);
						return;
					default:
						if (connState.getState() === OUTAGE) {
							return;
						}
						console.log("VPN state is reconnecting");
						connState.transition(RETRY);
						return;
				}
			}
			else if (vpn_state === VPN_DISCONNECTING) {
				console.log("VPN state is disconnecting");
				console.log("conn state is " + connState.getState());
				return;
			}
			else if (connState.getState() === OUTAGE &&
				connInfo.name === connState.getLastAttempted()) {
				if (connState.getLastState() === DISABLE) {
					break;
				}
				return;
			}
			else if ((auth_state & AUTH_NEED_USERPASS) === AUTH_NEED_USERPASS ||
				(auth_state & AUTH_NEED_OTP) === AUTH_NEED_OTP) {
				Notify.show();
				Notify.icon(NMap.get(SC_SID_NEED_AUTH_ERR).state);
				connState.setActiveConnection(connInfo.name).setLastAttempted();
				connState.transition(CREDENTIAL);
				return;
			}
			else {
				if (connState.getLastState() === DISABLE) {
					if (connInfo.name === connState.getLastEstablished()) {
						connState.setConnInfo(connInfo.name);
						log(StatusMsg.getMsg(SC_SID_DISABLED_CONNECTION, connState.getActiveDisplayName()), StatusMsg.getLogLevel(SC_SID_DISABLED_CONNECTION));
						connState.setLastState(connState.getState());
						connState.setLastEstablished();
					}
				}
				if (connInfo.status.id !== 0 && connInfo.name === connState.getLastAttempted()) {
					connState.clearTimerId();
				}
			}
		}
		listRetryDelay = 500;
		if (connState.getLastAttempted().length > 0 && connState.getActiveConnection().length === 0) {
			connState.setActiveConnection(connState.getLastAttempted());
		}
		if (connState.getActiveConnection().length === 0) {
			if (connState.getLastConnected() && connState.getLastConnected().name) {
				connState.setActiveConnection(connState.getLastConnected().name);
			}
		}
		Display.showConnection("#connectionsList");
		for (let i = 0; i < jresp.connections.length; i++) {
			let classStr = "connListItem";
			let connInfo = jresp.connections[i];
			let cName = connInfo.name;
			let ctime = parseInt(connInfo.connect_time, 10) * 1000;     // convert to msecs
			let frag = document.createDocumentFragment();
			let vpnTypeStr = connInfo.conn_type === "pro" ? Label.getText(SC_TID_SSL_PROVISIONING_TYPE) :
				connInfo.vpn_type === "ssl" ? "SSL" : "IPsec";
			if (vpnTypeStr === "SSL" && connInfo.pro_gateways.length > 0) {
				vpnTypeStr += " Pro";
			}
			if (connInfo.vpn_state !== VPN_CONNECTED) {
				if (connInfo.conn_type === "pro") {
					if (connInfo.connect_result === 0) {
						connInfo["details"] = Label.getStatusDetails(SC_TID_CONNECT_TO_DOWNLOAD);
					}
					else {
						let args = connInfo.status && connInfo.status.args ? connInfo.status.args : "";
						connInfo["details"] = StatusMsg.getStatusDetails(connInfo.connect_result, args);
					}
				}
				else if (ctime || connInfo.connect_result) {
					if (connInfo.connect_result === 0) {
						if (ctime) {
							connInfo["details"] = StatusMsg.getStatusDetails(SC_SID_LAST_CONNECTED, getTimeStamp(ctime));
						}
						else {
							connInfo["details"] = StatusMsg.getStatusDetails(SC_SID_NEVER_CONNECTED);
						}
					}
					else {
						let args = connInfo.status && connInfo.status.args ? connInfo.status.args : "";
						connInfo["details"] = StatusMsg.getStatusDetails(connInfo.connect_result, args);
					}
				}
				else {
					connInfo["details"] = StatusMsg.getStatusDetails(SC_SID_NEVER_CONNECTED);
				}
				let connTitle = Label.getText(SC_TID_MONITOR_CONNECTION_NAME) + " " + cName + "\n" +
					Label.getText(SC_TID_MONITOR_VPN_TYPE) + " " + vpnTypeStr + "\n" + Label.getText(SC_TID_MONITOR_GATEWAY);
				if (connInfo["pro_gateways"]) {
					if (connInfo["pro_gateways"].length > 1) {
						connTitle += "\n";
						let garray = connInfo["pro_gateways"];
						for (var n = 0; n < garray.length;) {
							connTitle += "\t" + garray[n];
							if (++n !== garray.length) {
								connTitle += "\n";
							}
						}
					}
					else {
						connTitle += " " + connInfo["pro_gateways"];
					}
				}
				else if (connInfo["gateway"]) {
					connTitle += " " + connInfo["gateway"];
				}
				connInfo["title"] = connTitle;
			}

			if (connState.getActiveConnection().length === 0) {
				if (connInfo.auto_connect && connInfo.auto_connect.enabled) {
					connState.setActiveConnection(connInfo.name);
					classStr += " selected";
				}
			}
			else if (connInfo.name === connState.getActiveConnection()) {
				connState.setActiveConnection(connInfo.name);
				classStr += " selected";
			}

			$(frag).append(
				$(document.createElement('li')).hide().
					addClass(classStr).
					attr("tabindex", "0").
					attr("data-conn", cName).
					attr("id", cName.substr(0, 60)).
					append($(document.createElement('div')).
						addClass("listIcons").
						append($(document.createElement('img')).
							addClass("favIcon").attr("src", "css/images/connection-default.png")).
						append($(document.createElement('img')).
							addClass("autoConnect").attr("src", "css/images/connection-auto.png").attr("title", "Auto-Connect").hide())
					).
					append($(document.createElement('div')).
						addClass("listData").
						append($(document.createElement('div')).
							addClass("listText").text(connInfo.display_name).attr("title", connInfo.title)).
						append($(document.createElement('div')).attr("title", connInfo.status.id ? StatusMsg.getMsg(connInfo.status.id, connInfo.status.args) : "").
							addClass('subtext').html(connInfo.details))
					).
					append($(document.createElement('div')).
						addClass("settingsIcon").
						append($(document.createElement('img')).
							addClass("editIcon").attr("src", "css/images/edit.png").
							attr("title", Label.getText(SC_TID_EDIT_MENU_ICON)).
							on('click', editIconClick).on('dblclick', editIconDblClick))
					).
					show()
			);
			$("#connectionsList").append(frag);

			if (connInfo.auto_connect.enabled) {
				$("#connectionsList li[id='" + connInfo.name + "'] img.autoConnect").show();
			}
		}

		$("#connectionsList").off('keydown').on('keydown', function (e) {
			if (!$("#editMenu").hasClass('active')) {
				keyCb.call(this, e);
			}
		});
		$('#connectionsList li.connListItem').off('click').on('click', function (e) {
			let evt = e || event;
			let $elem = $(evt.currentTarget);
			let isUser = !(evt.triggered);
			evt.preventDefault();
			//connState.setActiveConnection($elem.attr('id'));
			if (!connState.isEditing() && !connState.isConfig() && !connState.isAppMenuActive()) {
				if (!evt.isImmediatePropagationStopped()) {
					evt.stopImmediatePropagation();
					setStatusArea(connState.getConnInfo());
					if ($("li.connListItem.selected").attr('id') !== $elem.attr('id')) {
						$('li.connListItem.selected').find('#editIcon.editIcon').removeAttr("id");
						$("li.connListItem.selected").removeClass("selected").blur();
						$elem.addClass("selected").focus();
						$("#editIcon.editIcon").removeAttr('id');
						$elem.find(".editIcon").attr('id', 'editIcon');
						onChangeConnectionsList($elem);
						// note: onChangeConnectionsList will scroll to the selected item - don't scroll here
					}
					if (isUser) {
						if (Notify.state !== "normal") {
							Notify.icon("normal");
						}
					}
				}
			}
			else {
				evt.stopImmediatePropagation();
				if (connState.isConfig()) {
					$('#editMenu').removeClass('active');
					$("li.connListItem.selected").removeClass("selected").blur();
					$elem.addClass("selected");
					onChangeConnectionsList($elem);
				}
				else if (connState.isAppMenuActive()) {
					$('#appMenu').toggleClass('active');
					$elem.focus();
				}
				else if (connState.isEditing() && $elem.attr('id') !== connState.getActiveConnection()) {
					if (!saveConnectionName($('li.connListItem.selected div.listText.editable'))) {
						onChangeConnectionsList($("li.connListItem.selected"));
					}
				}
			}
		}).off('dblclick').on('dblclick', function (e) {
			if (!connState.isEditing() && !connState.isConfig() && !connState.isAppMenuActive()) {
				let evt = e || event;
				if (!evt.isImmediatePropagationStopped()) {
					let connInfo = connState.getConnInfo();
					if (connInfo.user_auth !== 0) {
						connState.transition(CREDENTIAL);
					}
					else {
						Notify.icon();
						connState.transition();
						sc_enable(connState.getActiveConnection(), enableCb, false, null, null, null, null, false, true);
					}
					evt.preventDefault();
					evt.stopImmediatePropagation();
				}
			}
		});

		let $selectedItem = $('li.connListItem.selected');
		if (!$selectedItem || $selectedItem.length === 0) {
			$selectedItem = $('li[data-conn="' + connState.getActiveConnection() + '"]');
			if ($selectedItem.length === 0) {
				$selectedItem = $('li.connListItem:first-of-type');
			}
			$selectedItem.addClass('selected');
		}
		let connInfo = connState.setActiveConnection($selectedItem.attr('id')).getConnInfo();
		if (connInfo) {
			setStatusArea(connInfo);
		}
		if ($selectedItem.length > 0) {
			if (connInfo.connect_result === 0) {
				if (Notify.state !== "normal") {
					Notify.icon();
				}
			}
			else {
				let nState = StatusMsg.getState(connInfo.connect_result);
				if (Notify.state !== nState) {
					Notify.icon(nState);
				}
			}
			$selectedItem.find('div.settingsIcon').show();
			$('#editIcon.editIcon').removeAttr("id").off('click');
			$selectedItem.find(".editIcon").attr('id', 'editIcon');
			$selectedItem.trigger({ type: "click", triggered: true });
			$selectedItem.focus();
		}
		if (connState.getState() !== OUTAGE) {
			connState.setState(IMPORT);
		}
		connState.transition();
	}
	else if (jresp) {
		connState.clearConnections();
		connState.setActiveConnection("");
	}

	// if there are no connections and neither Import page, Events page, nor About page is being displayed,
	// click connection tab to show the Import page (no connections) or show the Connections list
	if (connState.getCount() === 0 && $("#importDetails:visible").length === 0 &&
		$("#EventsPage:visible").length === 0 && $("#AboutPage:visible").length === 0) {
		$("#connectionsTab").click();
	}
}

function refresh_list() {
	sc_list(refreshListCb);
}

function getUrlVars(inStr) {
	let testStr = inStr || window.location.href;
	var vars = {};
	testStr.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
		vars[key] = value;
	});
	return vars;
}

function getUrlParam(parameter, defaultvalue, inStr) {
	let srchStr = inStr || window.location.href;
	if (srchStr.indexOf(parameter) > -1) {
		return getUrlVars(inStr)[parameter];
	}
	return defaultvalue;
}

function getLang(l) {
	let inLang = l ? l.toLowerCase() : navigator.language.toLowerCase();
	if (inLang.indexOf("de-") === 0) { return "de_de"; }
	if (inLang.indexOf("en-") === 0) { return "en_us"; }
	if (inLang.indexOf("es-") === 0) { return "es_es"; }
	if (inLang.indexOf("fr-") === 0) { return "fr_fr"; }
	if (inLang.indexOf("it-") === 0) { return "it_it"; }
	if (inLang.indexOf("ja-") === 0) { return "ja_jp"; }
	if (inLang.indexOf("ko-") === 0) { return "ko_kr"; }
	if (inLang.indexOf("pt-") === 0) { return "pt_br"; }
	// Return traditional for Taiwan and Hong Kong, simplified everywhere else
	if (inLang.indexOf("zh-tw") === 0) { return "zh_tw"; }
	if (inLang.indexOf("zh-hk") === 0) { return "zh_tw"; }
	if (inLang.indexOf("zh-mo") === 0) { return "zh_tw"; }
	if (inLang.indexOf("zh-") === 0) { return "zh_cn"; }
	//log("Unsupported language '" + navigator.language + ", defaulting to en-US");
	return "en_us";
}


function init_page(config) {
	let cfg = config || {};
	let lang = getUrlParam("lang", "");
	if (lang.length === 0) {
		lang = getLang();
	}
	else {
		lang = getLang(lang);
	}
	Label.init(lang);
	StatusMsg.init(lang);

	Label.replaceAll();

	addEventHandlers();

	// initialize before contacting engine
	$("#statusImg").attr("class", "loading");
	$("#connectBtn").attr("disabled", "disabled");
	$("#statusName").text(Label.getText(SC_TID_PRODUCT_NAME));

	connState.setFullSupport(checkMapSupport());

	sc_establish_websocket("ws://localhost:60110/websocket");

	if (cfg.logName && cfg.logName.length > 0) {
		Logger.setLogName(cfg.logName);
	}
	//log(StatusMsg.getMsg(SC_SID_INITALIZING));

	return ensureElemsHaveIdAttribute();
}

function quitCb(jresp) {
	switch (jresp.code) {
		case 0:
			log(StatusMsg.getMsg(SC_SID_DISABLED_CONNECTION, connState.getActiveDisplayName()), StatusMsg.getLogLevel(SC_SID_DISABLED_CONNECTION));
			break;
		case 1:
			log(StatusMsg.getMsg(SC_SID_CONNECTION_ALREADY_DISABLED), StatusMsg.getLogLevel(SC_SID_CONNECTION_ALREADY_DISABLED));
			break;
		case SC_SID_CONN_NOT_FOUND:
			log(StatusMsg.getMsg(jresp.code), StatusMsg.getLogLevel(jresp.code));
			break;
		default:
			let msg = jresp.msg;
			if (typeof msg === "undefined" || msg.length === 0) {
				msg = "Missing message in response";
			}
			log(StatusMsg.getMsg(SC_SID_SYSTEM_ERR_MSG, jresp.code.toString(), msg), StatusMsg.getLogLevel(SC_SID_SYSTEM_ERR_MSG));
			break;
	}

	// send quit message to frame
	sendFrameMessage("quit");
}

function disableCb(jresp) {
	let msg = jresp.msg;
	$("#divMenu").removeAttr("disabled");
	connState.clearWatchdogTimer();
	connState.clearReconnectTimer();
	switch (jresp.code) {
		case 0:
			if (connState.getState() !== OUTAGE) {
				connState.setState(INIT);
			}
			break;
		case SC_SID_NOT_PERMITTED_ERR:
			// Command could not be issued or completed 
			log(StatusMsg.getMsg(SC_SID_NOT_PERMITTED_ERR), StatusMsg.getLogLevel(SC_SID_NOT_PERMITTED_ERR));
			break;
		case SC_SID_INVALID_REQUEST:
			// Invalid command
			log(StatusMsg.getMsg(SC_SID_INVALID_REQUEST), StatusMsg.getLogLevel(SC_SID_INVALID_REQUEST));
			break;
		case SC_SID_TIMEOUT_ERR:
		case SC_SID_ERRORED_OUT:
			// service response timeout - most likely temporary
			// service polling will reset as needed
			console.log(msg);
			break;
		case SC_SID_CONN_LIST_ERR:
		// Failed to get connection info from strongSwan
		case SC_SID_SWAN_CMD_ERR:
		// Failed to send command to strongSwan
		case SC_SID_SA_TERMINATE_ERR:
		// Failed to terminate SA
		case SC_SID_SA_UNLOAD_ERR:
		// Failed to unload SA (covers multiple unload failures (e.g. private key, psk, user auth key id)
		case SC_SID_CONN_NOT_ENABLED:
		// Connection not enabled
		case SC_SID_CONN_NOT_FOUND:
		// Connection not found
		case SC_SID_INTERNAL_ERR:
			// An internal error occurred
			log(StatusMsg.getMsg(jresp.code), StatusMsg.getLogLevel(jresp.code));
			break;
		default:
			if (typeof msg === "undefined" || msg.length === 0) {
				msg = "Missing message in response";
			}
			log(StatusMsg.getMsg(SC_SID_SYSTEM_ERR_MSG, jresp.code.toString(), msg), StatusMsg.getLogLevel(SC_SID_SYSTEM_ERR_MSG));
			break;
	}
	if (connState.getLastState() !== DISABLE) {
		if (jresp.code === 0) {
			refresh_list();
		}
		else {
			connState.transition(READY);
		}
	}
}

function onRefreshCaptcha(e) {
	//Retain credentials between refresh captcha sessions
	user_captcha = $("#user").val();
	pass_captcha = $("#pass").val();
	otp_captcha = $("#otp").val();
	sc_captcha(connState.getActiveConnection(), captchaCb);
}

function onShowCredit()
{
	Display.showPage("#IframePage");
	return true ;
}
function onKeyupCheckSend(e) {
	let evt = e || event;
	let connInfo = connState.getConnInfo();
	let disabled = false;
	if (!connInfo.provisioned) {
		disabled = $("#user").val().length === 0 || $("#pass").val().length === 0;
		if (captcha_length !== 0) {
			disabled = disabled || $("#captcha").val().length === 0;
		}
	}

	else
		disabled = $("#user").val().length === 0 || $("#pass").val().length === 0;
	if (connInfo.otp) {
		if (connInfo.saved_credentials || connInfo.auth_state === AUTH_NEED_OTP) {
			disabled = $("#otp").val().length === 0;
		}
		else {
			disabled = disabled || $("#otp").val().length === 0;
		}
	}
	if (disabled) {
		$("#send").attr("disabled", "disabled");
	} else {
		$("#send").removeAttr("disabled");
		if (evt.key === "Enter") {
			onClickSend();
		}
	}
}

function onClickSend() {
	if (!connState.isAppMenuActive()) {
		let connInfo = connState.getConnInfo();
		if (connState.getState() === UPDATE) {
			sc_update(connState.getActiveConnection(), updateConnectionCb, { "updateConnection": true, "otp": $('#otp').val() });
		}
		else if (connInfo.vpn_state === VPN_CONNECTED && connState.getState() !== RECONNECT) {
			sc_update(connInfo.name, updateCb, { "otp": $('#otp').val() });
		}
		else {
			if ($("#user").val().length > 0) {
				Credentials.set($("#user").val(), $("#pass").val(), $("#otp").val(), $("#captcha").val());
			}
			sc_enable(connState.getActiveConnection(), enableCb, $("#saveCredentials").prop("checked"), Credentials.user(), Credentials.pwd(), Credentials.captcha(), $("#otp").val(), false, true);
		}

		connState.transition();
	}
}

// sc_update callback
function updateCredentialsCb(jresp) {
	if (jresp.code === 0) {
		let connInfo = connState.getConnInfo();
		connInfo.saved_credentials = false;
		log(StatusMsg.getMsg(SC_SID_CLEARED_CREDENTIALS, connState.getActiveDisplayName()), StatusMsg.getLogLevel(jresp.code));
	}
	else {
		log(StatusMsg.getMsg(SC_SID_CLEAR_CREDENTIALS_ERR, connState.getActiveDisplayName()), StatusMsg.getLogLevel(jresp.code));
	}
}

// sc_update callback
function updateConnectionCb(jresp) {
	//if (jresp.code === 0) {
		//log(StatusMsg.getMsg(SC_SID_PROVISIONING_CONNECTION, connState.getActiveDisplayName()), StatusMsg.getLogLevel(jresp.code));
	//}
	//else {
		//log(StatusMsg.getMsg(SC_SID_PROVISIONING_CONNECTION_ERR, connState.getActiveDisplayName()), StatusMsg.getLogLevel(jresp.code));
	//}
	return;
}

// sc_remove callback
function removeCb(jresp) {
	let msg = jresp.msg || typeof jresp.msg;

	switch (jresp.code) {
		case 0:
			log(StatusMsg.getMsg(SC_SID_CONNECTION_REMOVED, connState.getActiveDisplayName()), StatusMsg.getLogLevel(SC_SID_CONNECTION_REMOVED));
			connState.deleteConnection(jresp.name);
			connState.transition(READY);
			break;
		case SC_SID_CONN_NOT_FOUND:     // name not found
			log(StatusMsg.getMsg(SC_SID_CONN_NOT_FOUND), StatusMsg.getLogLevel(SC_SID_CONN_NOT_FOUND));
			connState.setState(DISABLE);
			connState.transition(READY);
			break;
		case SC_SID_TIMEOUT_ERR:
		case SC_SID_ERRORED_OUT:
			// No response from service - transition will change to
			// NOSERVICE state if service remains unresponsive.
			// These response codes are received only when the send_request
			// failed. It is unlikely that the service is still running so
			// it is unlikely that the connection was removed.  In either case,
			// there is no need to change our local connections list since
			// further polling will determine the engine state and refresh
			// the list once the service responds.
            /*
            connState.setState(DISABLE);
            connState.transition(READY);
            */
			break;
		default:
			if (StatusMsg.hasMsg(jresp.code)) {
				log(StatusMsg.getMsg(jresp.code), StatusMsg.getLogLevel(jresp.code));
			}
			else {
				log(StatusMsg.getMsg(SC_SID_SYSTEM_ERR_MSG, jresp.code.toString(), msg), StatusMsg.getLogLevel(SC_SID_SYSTEM_ERR_MSG));
			}
			connState.setState(DISABLE);
			connState.transition(READY);
			break;
	}
}

// Certificate Page functions
function importCertCb(jresp) {
	let msg = jresp.msg || typeof jresp.msg;
	let args = jresp.args || "";
	switch (jresp.code) {
		case 0:
			log(StatusMsg.getMsg(SC_SID_CONNECTION_ADDED, connState.getActiveConnection()), StatusMsg.getLogLevel(SC_SID_CONNECTION_ADDED));
			connState.setLastAttempted();
			connState.transition();
			break;
		case SC_SID_CERT_IMPORT_ERR:
		case SC_SID_CONN_FORMAT_ERR:
		case SC_SID_CONN_PARSE_ERR:
		case SC_SID_CONN_CONFIG_ERR:
		case SC_SID_USER_CERT_IMPORT_ERR:
		case SC_SID_CA_CERT_IMPORT_ERR:
		case SC_SID_KEY_IMPORT_ERR:
			log(StatusMsg.getMsg(jresp.code, args), StatusMsg.getLogLevel(SC_SID_CERTIFICATE_IMPORT_FAILED));
			setStatusArea({
				"display_name": Label.getText(SC_TID_FILE_IMPORT_ERROR),
				"details": StatusMsg.getStatusDetails(jresp.code)
			}, true);
			connState.transition(READY);
			break;
		default:
			if (StatusMsg.hasMsg(jresp.code)) {
				log(StatusMsg.getMsg(jresp.code, args), StatusMsg.getLogLevel(jresp.code));
			}
			else {
				log(StatusMsg.getMsg(SC_SID_SYSTEM_ERR_MSG, jresp.code.toString(), msg), StatusMsg.getLogLevel(SC_SID_SYSTEM_ERR_MSG));
			}
			setStatusArea({
				"display_name": Label.getText(SC_TID_FILE_IMPORT_ERROR),
				"details": StatusMsg.getStatusDetails(jresp.code, args)
			}, true);
			connState.transition(READY);
			break;
	}
}

function checkImportCertBtn(evt) {
	let disabled = $("#pk12Password").val().length === 0;
	if (disabled) {
		$("#divCertImport").addClass("disabled");
		$("#importCertFile").attr("disabled", "disabled");
	} else {
		$("#divCertImport").removeClass("disabled");
		$("#importCertFile").removeAttr("disabled");
	}
}

function importConnectionFile(fInfo) {
	let fr = new FileReader();
	fr.onload = connectionFileLoadCb;
	log(StatusMsg.getMsg(SC_SID_ADDING_CONNECTION_FILE, fInfo.name), StatusMsg.getLogLevel(SC_SID_ADDING_CONNECTION_FILE));
	fr.readAsText(fInfo);
}

function importCertificateFile(fInfo) {
	let fr = new FileReader();
	fr.onload = pkcs12FileLoadCb;

	if (fInfo && typeof fInfo.type === "string" && fInfo.type === "application/x-pkcs12") {
		fr.readAsDataURL(fInfo);    // this will produce a base64-encoded string with prefix (which will be stripped in onload handler)
	}
	else {
		Notify.alert(StatusMsg.get(SC_SID_PKCS12_ALERT));
	}
}

function importCert(fileInfo, connName) {
	if (connState.isExistingConnection(connName)) {
		if (!confirm(Label.getText(SC_TID_OVERWRITE_CONFIRM))) {
			$("#connectionsList li[id='" + connName + "']").trigger({ type: "click", triggered: true });
			return;
		}
	}
	setStatusArea({
		display_name: connName,
		connect_result: 0,
		details: StatusMsg.getStatusDetails(SC_SID_CERT_IMPORT_REQUIRED)
	});
	connState.setActiveConnection(connName);
	connState.transition(CERTIMPORT);
}

// Import Page functions

function importCb(jresp) {
	let msg = jresp.msg || typeof jresp.msg;
	let args = jresp.args || "";
	let logMsg = "";

	switch (jresp.code) {
		case 0:
			if (jresp.name) {
				let conns = jresp.name.split(",");
				let lnames = [];
				conns.forEach(function (s) {
					let found = false;
					lnames.forEach(function (n) {
						if (n === s.trim()) {
							found = true;
							return false;
						}
					});
					if (!found) {
						lnames.push(s.trim());
					}
				});
				lnames.forEach(function (n) {
					log(StatusMsg.getMsg(SC_SID_CONNECTION_ADDED, n), StatusMsg.getLogLevel(SC_SID_CONNECTION_ADDED));
				});
				connState.setState(IMPORT).setActiveConnection(lnames[lnames.length - 1]).setLastAttempted();
				connState.transition(READY);
			} else {
				// an error should be returned in jresp.code but sanity check
				logMsg = StatusMsg.getMsg(SC_SID_MISSING_RESPONSE);
			}
			break;
		case SC_SID_ERR_CONN_EXISTS:
			// connection already exists, no override option yet
			if (confirm(Label.getText(SC_TID_OVERWRITE_CONFIRM))) {
				sc_add(connState.getFileInfo(), connState.getFileType(), true, importCb);
			} else {
				log(StatusMsg.getMsg(SC_SID_ERR_CONN_EXISTS, args), StatusMsg.getLogLevel(SC_SID_ERR_CONN_EXISTS));
			}
			break;
		case SC_SID_IKE_NO_RESPONSE_ERR:
		case SC_SID_TIMEOUT_ERR:
		case SC_SID_ERRORED_OUT:
		case SC_SID_CONN_IMPORT_ERR:
		case SC_SID_CONN_FORMAT_ERR:
		case SC_SID_CONN_PARSE_ERR:
		case SC_SID_CONN_CONFIG_ERR:
		case SC_SID_USER_CERT_IMPORT_ERR:
		case SC_SID_CA_CERT_IMPORT_ERR:
		case SC_SID_KEY_IMPORT_ERR:
		case SC_SID_NAME_LENGTH_ERR:
			logMsg = StatusMsg.getMsg(jresp.code);
			break;
		case SC_SID_DUPLICATE_CONNECTION:
			logMsg = StatusMsg.getMsg(jresp.code, msg);
			break;
		default:
			logMsg = StatusMsg.getMsg(SC_SID_SYSTEM_ERR_MSG, jresp.code.toString(), msg);
			break;
	}
	if (logMsg.length) {
		log(logMsg, LOGERR);
		setStatusArea({
			"display_name": Label.getText(SC_TID_FILE_IMPORT_ERROR),
			"details": StatusMsg.hasMsg(jresp.code) ? StatusMsg.getStatusDetails(jresp.code, args) : logMsg
		}, true);
		$("#connectionsList li.selected").focus();
		if (connState.getState() === INIT && connState.getCount() === 0) {
			Display.showDetails("#importDetails");
		}
		else {
			Display.showDetails("#connectionDetails");
		}

	}
}

function ensureElemsHaveIdAttribute() {
	let elems = document.body.getElementsByTagName("*");
	let isDefined = true;
	for (var i = 0; i < elems.length; i++) {
		let $entry = $(elems[i]);
		if (!$entry.hasClass("header") && !$entry.hasClass("subTitle") && !$entry.hasClass("fieldset") &&
			!$entry.hasClass("option") && !$entry.hasClass("icon") && !$entry.is("option") && !$entry.hasClass("tabs") &&
			!$entry.hasClass("tab") && !$entry.hasClass("line") && !$entry.hasClass("listData") && !$entry.hasClass("listText") &&
			!$entry.hasClass("listIcons") && !$entry.hasClass("favIcon") && !$entry.hasClass("autoConnect") && !$entry.hasClass("subtext") &&
			!$entry.hasClass("editMenuImg") && !$entry.hasClass("editMenuText") && !$entry.hasClass("ts") && !$entry.hasClass("logMsg") && !$entry.hasClass("legal") &&
			!$entry.hasClass("appMenuText") && !$entry.is("br") && !$entry.is("script") && !$entry.is("link") && !$entry.is("label") && !$entry.is("li")) {
			isDefined = typeof ($entry).attr("id") !== "undefined";
			if (!isDefined) {
				log($entry[0].tagName);
				break;
			}
		}
	}
	return isDefined;
}

function saveConnectionName($elem) {
	let bSaveEdit = true;
	let connInfo = connState.getConnInfo();
	if (connInfo.display_name === $elem.text()) {
		// no change has been entered
		bSaveEdit = false;
	}
	else if (connState.isExistingAlias(connInfo.name, $elem.text())) {
		alert(Label.getText(SC_TID_CONNECTION_EXISTS_ALERT));
		$elem.text(connState.getActiveDisplayName());
		bSaveEdit = false;
	}
	$elem.prop("contentEditable", false).removeClass('editable');
	$elem.parent().next('.subtext').show();
	if (bSaveEdit) {
		connInfo.display_name = $elem.text();
		log(StatusMsg.getMsg(SC_SID_EDITED_CONNECTION_NAME, connInfo.display_name), StatusMsg.getLogLevel(SC_SID_EDITED_CONNECTION_NAME));
		//scStore.set(connInfo.name, connInfo.display_name);
		sc_update(connInfo.name, refresh_list, { "display_name": connInfo.display_name });
	}
	return bSaveEdit;
}

function setEditMenuPosition($elem) {
	let $editMenu = $('#editMenu');
	let nleft = $elem.parents('li')[0].offsetWidth - $editMenu.width() - 10;
	let nTop = $elem.parents('li')[0].offsetTop + $elem.parents('.fieldset')[0].offsetTop - $elem[0].offsetHeight - $elem.parents('.fieldset').scrollTop();
	$editMenu.css('left', nleft);
	$editMenu.css('top', nTop);
}

function editIconDblClick(e) {
	let evt = e || event;
	evt.preventDefault();
	evt.stopImmediatePropagation();
}

function editIconClick(e) {
	let evt = e || event;
	let $elem = $(evt.currentTarget);
	let $editMenu = $("#editMenu");
	let isNewSelection = false;
	evt.preventDefault();
	evt.stopImmediatePropagation();

	if (connState.isAppMenuActive()) {
		$("#appMenu").toggleClass('active');
		$("#divMenu").focus();
	}
	else if (connState.isConfig()) {
		$editMenu.toggleClass("active");
		$elem.focus();
	}
	else if (!connState.isEditing()) {
		let connInfo = connState.getConnInfo();
		if (!$elem.attr('id')) {
			// This is the edit icon in an, as yet, unselected connection;
			// close the config/edit menu if opened in the current selection
			// and remove the editIcon identifier.
			isNewSelection = true;
			if (connState.isConfig()) {
				$editMenu.removeClass('active');
			}
			$("#editIcon.editIcon").removeAttr('id');
			$elem.attr('id', 'editIcon');
			$('li.connListItem.selected').removeClass('selected');
			$elem.parents('li.connListItem').addClass('selected');
		}
		if (isNewSelection) {
			onChangeConnectionsList($("li.connListItem.selected"));
			connInfo = connState.getConnInfo();
		}

		$editMenu.toggleClass("active");
		if ($editMenu.hasClass("active")) {
			$elem.blur();
			scrollList($elem.parents('li'));
			setEditMenuPosition($elem);
			$editMenu.find('li:first-of-type').focus();
		}
		else {
			$editMenu.find('li.selected').removeClass('selected').blur();
		}

		if (connInfo && connInfo.auto_connect.mode !== 0) {
			if (connInfo.auto_connect.enabled) {
				$('#autoConnect div.editMenuImg').addClass("autoConnect");
			}
			else {
				$('#autoConnect div.editMenuImg').removeClass("autoConnect");
			}
			if (!$("#autoConnect").hasClass('active')) {
				$("#autoConnect").addClass('active');
			}
			if (connInfo.auto_connect.mode === 2) {
				$("#autoConnect").attr("disabled", "disabled");
			}
			else {
				$("#autoConnect").removeAttr("disabled");
			}
		}
		else {
			$('#autoConnect div.editMenuImg').removeClass("autoConnect");
			$("#autoConnect").attr("disabled", "disabled");
		}

		if (connInfo && connInfo.user_auth !== 0) {
			if (connInfo.saved_credentials) {
				$("#clearCredentials").addClass('active');
			}
			else {
				$("#clearCredentials").removeClass('active');
			}
		}
		else {
			$("#clearCredentials").removeClass('active');
		}

		if (connInfo && connInfo.conn_type !== "pro") {
			$("#updateConnection").addClass('active');
			if (connInfo.pro_gateways.length === 0) {
				$("#updateConnection").removeClass('active');
			}
			else {
				$("#updateConnection").removeAttr("disabled");
			}
		}
		else {
			$("#updateConnection").removeClass('active');
		}

		if (connInfo && connInfo.conn_type !== "pro") {
			if (connInfo.conn_prov_context) {
				$("#rename").removeClass('active');
			}
			else {
				$("#rename").addClass("active");
			}
		}
		else {
			$("#rename").addClass('active');
		}
	}
	else {
		if (!saveConnectionName($('li.connListItem.selected div.listText.editable'))) {
			setTimeout(function () { $elem.focus(); }, 50);
		}
	}
}


function editConnectionCb(evt) {
	let $elem = $(evt.currentTarget);
	evt.stopImmediatePropagation();
	switch (evt.keyCode) {
		case 9:
		case 27:
			// Tab or Esc
			evt.preventDefault();
			$elem.text(connState.getActiveDisplayName());
			$elem.prop("contentEditable", false).removeClass('editable');
			$elem.parent().next('.subtext').show();
			log(StatusMsg.getMsg(SC_SID_CANCELLED_EDIT, $elem.text()), StatusMsg.getLogLevel(SC_SID_CANCELLED_EDIT));
			onChangeConnectionsList($("li.connListItem.selected"));
			break;
		case 13:
			// Enter
			if (!saveConnectionName($elem)) {
				onChangeConnectionsList($("li.connListItem.selected"));
			}
			break;
		case 38:
			// Arrow up
			break;
		case 40:
			// Arrow down
			break;
		default:
			break;
	}
}

function dropMenuCb($elem, keyCode) {
	let $next = $elem.next();
	let $prev = $elem.prev();
	switch (keyCode) {
		case 13:
		case 32:
			// Enter or Space Bar
			let $labelElem = $elem.find('label');
			let $linkElem = $elem.find('a');
			$elem.removeClass('selected').blur();
			if ($labelElem.length > 0) {
				$labelElem.click();
			}
			else if ($linkElem.length > 0) {
				window.open($linkElem.attr('href'), '_blank');
				$("#appMenu").toggleClass('active');
			}
			else {
				$elem.click();
			}
			break;
		case 27:
		case 37:
			// Esc or Left Arrow
			$elem.removeClass('selected').blur();
			if ($elem.hasClass('editMenuItem')) {
				$("#editIcon").click();
			}
			else if ($elem.hasClass('appMenuItem')) {
				$("#divMenu").click().focus();
			}
			break;
		case 38:
			// Arrow up
			if ($prev.length) {
				$elem.removeClass('selected').blur();
				$prev.addClass('selected');
				$prev.focus();
			}
			break;
		case 40:
			// Arrow down
			if ($next.length) {
				$elem.removeClass('selected').blur();
				$next.addClass('selected');
				$next.focus();
			}
			break;
		default:
			break;
	}
}

function addEditMenuEventHandlers() {
	$("li.editMenuItem").off('focus').on('focus', function (e) {
		let evt = e || event;
		let $elem = $(evt.currentTarget);
		$("li.editMenuItem.selected").removeClass("selected").blur();
		$elem.addClass('selected');
		evt.preventDefault();
		evt.stopPropagation();
	}).
		off('click').on('click', function (e) {
			let evt = e || event;
			let $elem = $(evt.currentTarget);
			if ($elem.attr("disabled") === "disabled") {
				return;
			}
			if (!evt.isDefaultPrevented()) {
				let connInfo = connState.getConnInfo();
				evt.preventDefault();
				evt.stopImmediatePropagation();
				switch ($elem.attr('id')) {
					case "autoConnect":
						if (connInfo.auto_connect.mode === 2) {
							evt.stopPropagation();
						}
						else if (connInfo.auto_connect.mode === 1) {
							$("#editMenu").removeClass("active");
							$("#editIcon").focus();
							$("li.connListItem img.autoConnect").each(function () {
								$(this).hide();
							});
							$elem.find('div.editMenuImg').toggleClass('autoConnect');
							connState.setActiveConnection("");
							sc_update(connInfo.name, updateCb, { "auto_connect": !connInfo.auto_connect.enabled });
						}
						break;
					case "delete":
						$("#editMenu").removeClass("active");
						if (confirm(StatusMsg.getMsg(SC_SID_REMOVE_CONNECTION_CONFIRM, connState.getActiveDisplayName()))) {
							connState.transition(DELETE);
						}
						else {
							$("li.connListItem.selected").focus();
						}
						break;
					case "rename":
						$("#editMenu").removeClass("active");
						$elem = $("li.connListItem.selected div.listText");
						$elem.addClass("editable").prop("contentEditable", true).
							off('keydown').on('keydown', editConnectionCb);
						$elem.parent().next('.subtext').hide();
						setTimeout(function () { $elem.focus(); }, 100);
						break;
					case "clearCredentials":
						if (confirm(Label.getText(SC_TID_CLEAR_CREDENTIALS_CONFIRM))) {
							$("#editMenu").removeClass("active");
							sc_update(connState.getActiveConnection(), updateCredentialsCb, { "clear_credentials": true });
							$("#editIcon").focus();
						}
						break;
					case "updateConnection":
						if (confirm(Label.getText(SC_TID_UPDATE_CONNECTION_CONFIRM))) {
							$("#editMenu").removeClass("active");
							sc_update(connState.getActiveConnection(), updateConnectionCb, { "updateConnection": true });
							$("#editIcon").focus();
							let dispName = connState.getActiveDisplayName();
							setStatusArea({
								"display_name": dispName,
								"vpn_state": VPN_CONNECTING,
								"details": Label.getText(SC_TID_UPDATE_CONNECTION_POLICY)
							}, false);
							$("#connectBtn").attr("disabled", "disabled").removeAttr("title");
							log(Label.getText(SC_TID_UPDATE_CONNECTION_POLICY) + " " + dispName);
							Display.showDetails("#connectionDetails").showConnection("#updating");
						}
						break;
					default:
						// console.log("Unhandled Edit Menu list item with id: " + $elem.attr('id'));
						break;
				}
			}
		});
}

function addAppMenuEventHandlers() {
	$("li.appMenuItem").
		off('focus').on('focus', function (e) {
			let evt = e || event;
			let $elem = $(evt.currentTarget);
			$("li.appMenuItem.selected").removeClass("selected").blur();
			$elem.addClass('selected');
			evt.preventDefault();
			evt.stopPropagation();
		}).
		off('click').on('click', function (e) {
			let evt = e || event;
			let $elem = $(evt.currentTarget);
			evt.stopPropagation();
			if (!evt.isDefaultPrevented()) {
				let connInfo = connState.getConnInfo();
				switch ($elem.attr('id')) {
					case "importMenuItem":
						$("#appMenu").removeClass("active");
						break;
					case "logMenuItem":
						$("#appMenu").removeClass("active");
						$(".header ul.tabs > li.tab").each(function () {
							$(this).removeClass("active");
						});
						$("#eventsTriangle").removeClass("triangle");
						$("#connectionsTriangle").removeClass("triangle");
						Display.showPage("#IframePage")
						break;
					case "helpMenuItem":
						$("#appMenu").removeClass("active");
						$("#ellipsisIcon").focus();
						break;
					case "aboutMenuItem":
						$("#appMenu").removeClass("active");
						$(".header ul.tabs > li.tab").each(function () {
							$(this).removeClass("active");
						});
						$("#eventsTriangle").removeClass("triangle");
						$("#connectionsTriangle").removeClass("triangle");
						Display.showPage("#AboutPage");
						$("#legal > a").focus();
						if (connState.getState() === NOSERVICE) {
							$("#generateTSR").attr("disabled", "disabled");
						}
						else {
							$("#generateTSR").removeAttr("disabled");
						}
						break;
					case "forceSSORelogonItem":
						$("#appMenu").removeClass("active");
						$(".header ul.tabs > li.tab").each(function () {
							$(this).removeClass("active");
						});
						confirmDeleteCookies("forceSSORelogonItem");
						break;
					case "quitMenuItem":
						if (connState.getState() !== DISABLE) {
							if (connInfo && connInfo.vpn_state !== VPN_DISCONNECTED && connInfo.vpn_state !== VPN_RECONNECTING && connState.getState() !== NOSERVICE) {
								if (confirm(StatusMsg.getMsg(SC_SID_APP_QUIT_CONNFIRM, connInfo.display_name))) {
									$("#appMenu").removeClass("active");
									connState.setState(DISABLE);
									sc_disable(connInfo.name, quitCb);
								}
							}
							else {
								$("#appMenu").removeClass("active");
								sendFrameMessage("quit");
							}
						}
						$("#appMenu").removeClass("active");
						break;
					default:
						// console.log("Unhandled App Menu list item with id: " + $elem.attr('id'));
						break;
				}
			}
		});
}

function unloadCb(evt) {
	console.log("event beforeunload");
}

function addEventHandlers() {
	$("ul.tabs a").click(function (e) {
		let evt = e || event;
		let $elem = $(evt.currentTarget);
		let $tab = $elem.parents('li.tab');
		if (!connState.isEditing() && !connState.isConfig() && !connState.isAppMenuActive()) {
			switch ($elem.attr("id")) {
				case "connectionsTab":
					$("#connectionsTriangle").addClass("triangle");
					$("#eventsTriangle").removeClass("triangle");
					$tab.addClass("active");
					$tab.siblings('li.tab').each(function () {
						$(this).removeClass("active");
					});
					// When first starting GUI and scvpn service is unavailable, GUI will not yet have any connections,
					// even if there are connections available, because GUI cannot get the list from the service.
					// Do not show the Import page; instead, show the Connections page with busy status icon (2nd else below)
					// until timeout for service connection occurs, at which point, Service unavailable will be shown.
					// When service is available, show the Import page when empty connections list is returned.
					if (connState.getState() !== NOSERVICE && connState.getListReply() && connState.getCount() === 0) {
						$("#statusContentBtn").hide();
						if (!$("#statusContentImportBtn").hasClass('active')) {
							$("#statusContentImportBtn").addClass('active');
						}
						$("#statusImg").attr("class", StatusMsg.getState(SC_SID_NO_CONNECTIONS)).show();
						$("#statusName").attr("title", "").text(StatusMsg.getTitle(SC_SID_NO_CONNECTIONS));
						$("#statusDetails").text(StatusMsg.getMsg(SC_SID_NO_CONNECTIONS)).removeAttr("title");
						$("#statusArea").show();
						Display.showDetails("#importDetails").showPage("#ConnectionsPage");
						$("#importBtn").focus();
					}
					else if (connState.getState() === NOSERVICE) {
						$("#statusContentImportBtn").removeClass('active');
						$("#statusArea").show();
						Display.showDetails().showPage("#ConnectionsPage");
						$("#generateTSR").trigger("service:toggle");
						if (Notify.state !== NMap.getState(SC_SID_SERVICE_UNAVAILABLE)) {
							Notify.icon(NMap.get(SC_SID_SERVICE_UNAVAILABLE).state);
						}
					}
					else {
						$("#statusContentImportBtn").removeClass('active');
						$("#statusContentBtn").show();
						$("#statusArea").show();
						switch (connState.getState()) {
							case INIT:
								Display.showDetails("#connectionDetails").showPage("#ConnectionsPage");
								break;
							case READY:
								Display.showDetails("#connectionDetails").showPage("#ConnectionsPage");
								setTimeout(function () { $('li.connListItem.selected').click(); }, 50);
								break;
							case CREDENTIAL:
								Display.showDetails("#authDetails").showPage("#ConnectionsPage");
								setFocusOnEmptyElement();
								break;
							case CONNECT:
							case AUTHENTICATE:
								Display.showDetails("#monitorDetails").showPage("#ConnectionsPage");
								break;
							case MONITOR:
								Display.showDetails("#monitorDetails").showPage("#ConnectionsPage");
								let $activeDiv = $("div.mConnection ul.active");
								if ($activeDiv.hasClass("mConnList")) {
									$("#connectionIcon").focus();
								}
								else if ($activeDiv.hasClass("mNetworkList")) {
									$("#networksIcon").focus();
								}
								else if ($activeDiv.hasClass("mSecurityList")) {
									$("#securityIcon").focus();
								}
								break;
							case CERTIMPORT:
								Display.showDetails("#certDetails").showPage("#ConnectionsPage");
								break;
							case OUTAGE:
								Display.showDetails("#outageDetails").showPage("#ConnectionsPage");
								break;
							case RETRY:
							case RECONNECT:
								Display.showDetails("#retryDetails").showPage("#ConnectionsPage");
								break;
							case UPDATE:
								Display.showPage("#ConnectionsPage").showDetails("#connectionDetails").showConnection("#updating");
								break;
							default:
								Display.showDetails().showPage("#ConnectionsPage");
								break;
						}
					}
					break;
				case "eventsTab":
					$("#eventsTriangle").addClass("triangle gray");
					$("#connectionsTriangle").removeClass("triangle");
					$tab.addClass("active");
					$tab.siblings('li.tab').each(function () {
						$(this).removeClass("active");
					});
					$("#statusArea").hide();
					Display.showPage("#EventsPage");
					$("#logarea").show();
					$("#logarea li:last-of-type").focus();
					scrollList($("#logarea li:last-of-type"), $("#logarea"));
					break;
				default:
					$("#EventsPage").hide();
					$("#ConnectionsPage").hide();
					break;
			}
		}
		else if (connState.isConfig()) {
			$('#editMenu').removeClass('active');
			$elem.focus();
		}
		else if (connState.isAppMenuActive()) {
			$("#appMenu").toggleClass('active');
			$elem.focus();
		}
		else {
			evt.stopImmediatePropagation();
			evt.preventDefault();
			if (!saveConnectionName($('li.connListItem.selected div.listText.editable'))) {
				setTimeout(function () { $elem.focus(); }, 50);
			}
		}
	});
	$("ul.tabs a").on("keydown", function (e) {
		if (!connState.isEditing() && !connState.isConfig() && !connState.isAppMenuActive()) {
			let evt = e || event;
			let $elem = $(evt.currentTarget);
			let isConnectionsTab = $elem.attr('id') === "connectionsTab";
			let isEventsTab = $elem.attr('id') === "eventsTab";
			let isConnectionDetails = $("#connectionDetails:visible").length > 0;
			let isEventsPage = $("#EventsPage:visible").length > 0;
			let isAboutPage = $("#AboutPage:visible").length > 0;
			let isAuthPage = $("#authDetails:visible").length > 0;
			let isImportPage = $("#importBtn:visible").length > 0;
			let isMonitorPage = $("#monitorDetails:visible").length > 0;
			switch (evt.keyCode) {
				case 9:
					// Tab
					evt.preventDefault();
					evt.stopImmediatePropagation();
					$(evt.currentTarget).blur();
					if (evt.shiftKey) {
						if (isConnectionsTab) {
							if (isConnectionDetails) {
								$("#connectionDetails li.selected").focus();
							}
							else if (isEventsPage) {
								$("#clearEventsBtn").focus();
							}
							else if (isMonitorPage) {
								$("#securityIcon").click();
							}
							else if (isAboutPage) {
								$("#community a").focus();
							}
							else if (isAuthPage) {
								if ($("#send").prop("disabled")) {
									if (connState.getConnInfo().can_save) {
										$("#saveCredentials").focus();
									}
									else if (connState.getConnInfo().otp) {
										$("#otp").focus();
									}
									else {
										$("#pass").focus();
									}
								}
								else {
									$("#send").focus();
								}
							}
							else if (isImportPage) {
								$("#importDetailsLink").focus();
							}
						}
						else {
							$("#connectionsTab").focus();
						}
					}
					else {
						if (isConnectionsTab) {
							$("#eventsTab").focus();
						}
						else if (isEventsTab) {
							$("#divMenu").focus();
						}
						else if (isEventsPage) {
							$("#clearEventsBtn").focus();
						}
						else if (isAboutPage) {
							$("#legal a.listData").focus();
						}
						else if (isImportPage) {
							$("#importBtn").focus();
						}
						else {
							$("#connectBtn").focus();
						}
					}
					break;
				case 13:
				case 32:
					// Enter or Space
					$elem.click();
					break;
				default:
					break;
			}
		}
	});

	// connection and certificate file import
	$(".inputFile").change(function (e) {
		var evt = e || event;
		if (this.files.length > 0) {
			let fileInfo = this.files[0];
			if (!fileInfo.size) {
				let logMsg = StatusMsg.getMsg(SC_SID_IMPORT_FILE_EMPTY_ERR, fileInfo.name);
				log(logMsg, StatusMsg.getLogLevel(SC_SID_IMPORT_FILE_EMPTY_ERR));
				alert(logMsg);
			}
			else if (fileInfo.size > MAX_IMPORT_FILE_SIZE) {
				let logMsg = StatusMsg.getMsg(SC_SID_IMPORT_FILE_SIZE_ERR, fileInfo.name);
				log(logMsg, LOGERR);
				alert(logMsg);
				/* Use custom alert rather than browser alert
            	let nObj = NMap.get(SC_SID_IMPORT_FILE_SIZE_ERR);
            	let sendObj = { state: nObj.state, title: nObj.title, msg: logMsg };
            	Notify.alert(sendObj);
				*/
			}
			else {
				connState.setConnectionFile(fileInfo.name);
				importConnectionFile(fileInfo);
			}
		}
		// clear the filename so sequential selection of the same file will fire the change event
		evt.currentTarget.value = "";
	});

	// certificate file import
	$(".inputPKCSFile").off('change').on('change', inputPKCSFileChangeCb);

	// connect button
	$("#connectBtn").keydown(function (e) {
		let isConnectionsList = $('#connectionsList:visible').length > 0;
		let isAuthPage = $("#authDetails:visible").length > 0;
		if (isConnectionsList || isAuthPage) {
			let evt = e || event;
			let $elem = $(evt.currentTarget);
			switch (evt.keyCode) {
				case 9:
					// Tab
					evt.preventDefault();
					evt.stopPropagation();
					$elem.blur();
					if (evt.shiftKey) {
						$("#divMenu").focus();
					} else {
						if (isConnectionsList) {
							$('li.connListItem.selected').focus();
						}
						else {
							$('#user').focus();
						}
					}
					break;
				case 13:
				case 32:
					// Enter or Space Bar
					evt.preventDefault();
					evt.stopPropagation();
					$elem.click();
					break;
				default:
					break;
			}
		}
	});

	// auth page
	$("#saveCredentials").click(function (evt) {
		if (connState.isAppMenuActive()) {
			$("#appMenu").toggleClass('active');
		}
	});

	// import page
	$("#importBtn").keydown(function (e) {
		let evt = e || event;
		let $elem = $(evt.currentTarget);
		switch (evt.keyCode) {
			case 9:
				// Tab
				evt.preventDefault();
				evt.stopImmediatePropagation();
				$(evt.currentTarget).blur();
				if (evt.shiftKey) {
					$("#divMenu").focus();
				}
				else {
					$("#importDetailsLink").focus();
				}
				break;
			case 13:
			case 32:
				// Enter or Space
				$elem.click();
				break;
			default:
				break;
		}
	});

	$("#importDetailsLink").keydown(function (e) {
		let evt = e || event;
		let $elem = $(evt.currentTarget);
		switch (evt.keyCode) {
			case 9:
				// Tab
				evt.preventDefault();
				evt.stopImmediatePropagation();
				$(evt.currentTarget).blur();
				if (evt.shiftKey) {
					$("#importBtn").focus();
				}
				else {
					setTimeout(function () { $("#connectionsTab").focus(); }, 50);
				}
				break;
			case 13:
			case 32:
				// Enter or Space
				$elem.click();
				break;
			default:
				break;
		}
	});

	// certificate import page
	$("#importCertFile").focus(function (e) {
		$("#importCertBtn").addClass("hasFocus");
	});

	$("#importCertFile").blur(function (e) {
		$("#importCertBtn").removeClass("hasFocus");
	});

	$("#importCertFile").keydown(function (e) {
		let evt = e || event;
		let $elem = $(evt.currentTarget);
		switch (evt.keyCode) {
			case 9:
				// Tab
				evt.preventDefault();
				evt.stopImmediatePropagation();
				$(evt.currentTarget).blur();
				if (evt.shiftKey) {
					$("#pk12Password").focus();
				}
				else {
					$("#aboutBtn").focus();
				}
				break;
			case 13:
			case 32:
				// Enter or Space Bar
				$elem.click();
				break;
			default:
				break;
		}
	});

	$("#AboutPage a.listData").off('keydown').on('keydown', aboutPageLinkKeydown);

	$("#aboutMenuItem").off('click').on('click', aboutMenuClickCb);

	// app menu icon
	$("#divMenu").off('keydown').on('keydown', divMenuKeydownCb);
	$("#divMenu").off('click').on('click', divMenuClickCb);

	addAppMenuEventHandlers();

	addEditMenuEventHandlers();

	$("#connectionIcon").off('keydown').on('keydown', connectionIconKeydownCb);

	$("#networksIcon").off('keydown').on('keydown', networksIconKeydownCb);

	$("#securityIcon").off('keydown').on('keydown', securityIconKeydownCb);

	$("#monitorPageTitle > img").off('click').on('click', monitorPageIconClickCb);

	$("#monitorPageTitle > img").off('focus').on('focus', monitorPageIconFocusCb);

	// Events page clear button
	$("#clearEventsBtn").off('click').on('click', clearEventsBtnClickCb);
	$("#clearEventsBtn").off('keydown').on('keydown', clearEventsBtnKeydownCb);

	// About page generateTSR button
	$("#generateTSR").off('service:toggle').on("service:toggle", generateTSRServiceToggleCb);
	$("#generateTSR").off('click').on("click", generateTSRClickCb);

	// body event handlers
	$("body").off('click').on('click', bodyClickCb);
	$("body").keydown(function (e) {
		let $activeMenu = null;
		let evt = e || event;
		let isMonitorIcon = evt.target.tagName === "IMG" && $(evt.target).parent().attr('id') === 'monitorPageTitle';
		if (!isMonitorIcon) {
			if ($("#editMenu.active").length > 0) {
				$activeMenu = $("#editMenu.active");
			}
			else if ($("#appMenu.active").length > 0) {
				$activeMenu = $("#appMenu.active");
			}
			else if ($(evt.target).attr('id') === "ellipsisIcon") {
				$("#appMenu").toggleClass('active');
			}
			if ($activeMenu) {
				let $elem = $activeMenu.find("li.selected");
				//evt.stopPropagation();
				evt.preventDefault();
				if ($elem.length > 0) {
					if ($elem.hasClass('editMenuItem')) {
						dropMenuCb.call(this, $elem, evt.keyCode);
					}
					else if ($elem.hasClass('appMenuItem')) {
						dropMenuCb.call(this, $elem, evt.keyCode);
					}
				}
				else {
					switch (evt.keyCode) {
						case 9:
							// Tab
							if (evt.shiftKey) {
								$("#editIcon").click().focus();
							}
							else {
								$activeMenu.find("li:first-of-type").addClass('selected').focus();
							}
							break;
						case 13:    // Enter
						case 32:    // Space
						case 38:    // Arrow Up
						case 40:    // Arrow Down
							let $li = $activeMenu.find("li:first-of-type");
							while (!$li.is(':visible')) {
								$li = $li.next();
							}
							$li.addClass('selected').focus();
							break;
						case 27:
							// Esc
							if ($activeMenu.hasClass('editMenu')) {
								$("#editIcon").click().focus();
							}
							else if ($activeMenu.hasClass('appMenu')) {
								$("#divMenu").click().focus();
							}
							break;
						default:
							break;
					}
				}
			}
			else {
				let isMonitorPage = $("#monitorDetails:visible").length > 0;
				let $elem = $(evt.target);
				let elemId = $elem.attr('id');
				switch (evt.keyCode) {
					case 9:
						if (evt.shiftKey) {
							if (elemId === "user") {
								evt.preventDefault();
								$("#connectBtn").focus();
							}
						}
						else if (elemId === "pass") {
							if (!connState.getConnInfo().otp) {
								if (connState.getConnInfo().provisioned) {
									if (!connState.getConnInfo().can_save) {
										if ($('#send').prop('disabled')) {
											evt.preventDefault();
											$("#connectionsTab").focus();
										}
										else {
											evt.preventDefault();
											$("#send").focus();
										}
									}
									else {
										evt.preventDefault();
										$("#saveCredentials").focus();
									}
								}
								else {
									evt.preventDefault();
									$("#captcha").focus();
								}
							}
						}
						else if (elemId === "otp") {
							if (connState.getConnInfo().provisioned) {
								if (!connState.getConnInfo().can_save) {
									if ($('#send').prop('disabled')) {
										evt.preventDefault();
										$("#connectionsTab").focus();
									}
									else {
										evt.preventDefault();
										$("#send").focus();
									}
								}
								else {
									evt.preventDefault();
									$("#saveCredentials").focus();
								}
							}
						}
						else if (elemId === "saveCredentials") {
							if ($('#send').prop('disabled')) {
								evt.preventDefault();
								$("#connectionsTab").focus();
							}
						}
						else if (elemId === "send") {
							evt.preventDefault();
							$("#connectionsTab").focus();
						}
						else if (isMonitorPage && elemId === "connectBtn") {
							evt.preventDefault();
							$("#connectionIcon").click();
						}
						break;
					case 13:
					case 32:
						switch (elemId) {
							case "divMenu":
								$('#divMenu').click();
								break;
							case "connectBtn":
								$elem.click();
								break;
							default:
								break;
						}
						break;
					default:
						break;
				}
			}
		}
	});

	// display of connection config menu upon scroll event
	$("#connectionDetails div.fieldset").scroll(function (e) {
		let evt = e || event;
		evt.stopImmediatePropagation();
		evt.preventDefault();
		if (connState.isConfig()) {
			let $selItem = $('li.connListItem.selected');
			let $viewport = $selItem.parents('.fieldset');
			let $editMenu = $("#editMenu");

			if ($selItem.offset().top < $viewport.offset().top) {
				$editMenu.removeClass("active");
			}
			else if ($selItem.offset().top + $selItem[0].offsetHeight > $viewport.offset().top + $viewport.height()) {
				$editMenu.removeClass("active");
			}
			else {
				setEditMenuPosition($selItem.find('img'));
			}
		}
	});
	
	$("#vpn-portal-port-input-field").on("input", function () {
		vpnPortalPortDidChange();
	});

	$("#importDetailsLink").on("click", function (e) {
		launchDefaultBrowser(e, "importDetails");
	});

	$("#helpMILink").on("click", function (e) {
		launchDefaultBrowser(e, "help");
	});

	$("#legalLink").on("click", function (e) {
		launchDefaultBrowser(e, "legalDetails");
	});

	$("#communityLink").on("click", function (e) {
		launchDefaultBrowser(e, "communityForum");
	});

}

// Monitor page functions

function createMonitorPage(jresp) {
	// check for required data
	if (typeof jresp === "undefined" || typeof jresp.config === "undefined" || typeof jresp.endpoints === "undefined" ||
		typeof jresp.network === "undefined" || typeof jresp.security === "undefined") {
		return false;
	}
	Display.showMonitor("#polling");
	if (connState.getState() !== MONITOR) {
		$("#statusDetails").text(Label.getText(SC_TID_MONITOR_PAGE_POLLING)).removeAttr("title");
	}

	//let connName = jresp.name;
	let config = jresp.config;
	let endpoints = jresp.endpoints;
	let network = jresp.network;
	let security = jresp.security;
	let tsArray = [];
	let frag = null;
	let remoteTSLabel = Label.getText(SC_TID_MONITOR_REMOTE_NETWORK);
	let proto = config.protocol || PROTO_IPSEC;

	function addListItem(frag, listClass, label, data, labelClass) {
		$(frag).find('ul.' + listClass).
			append(($(document.createElement('li')).
				append($(document.createElement('div')).
					append($(document.createElement('text')).
						addClass(labelClass).
						text(label))).
				append($(document.createElement('div')).
					append($(document.createElement('text')).
						text(data)))
			));
	}

	// and security
	if (!checkData(security, 'security', proto)) {
		console.log("Missing data in security");
		return false;
	}
	// sanity check config data
	if (!checkData(config, 'config', proto)) {
		console.log("Missing data in config");
		return false;
	}
	// and endpoints
	if (!checkData(endpoints, 'endpoints', proto)) {
		console.log("Missing data in endpoints");
		return false;
	}
	// and network
	if (!checkData(network, 'network', proto)) {
		console.log("Missing data in network");
		return false;
	}

	$("#statusContentBtn").show();
	Display.showMonitor("#monitorViews");

	if (network.networks) {
		network.networks.forEach(function (ts) {
			tsArray.push(ts);
		});
	}
	connState.checkTSArray(tsArray.sort());

	frag = document.createDocumentFragment();

	$(frag).append(($(document.createElement('div')).
		addClass("mConnection").
		append(($(document.createElement('ul')).
			addClass('mConnList').hide())).
		append(($(document.createElement('ul')).
			addClass('mNetworkList').hide())).
		append(($(document.createElement('ul')).
			addClass('mSecurityList').hide()))
	));
	addListItem(frag, "mConnList", Label.getText(SC_TID_MONITOR_CONNECTION_NAME), config.name);
	if (proto === PROTO_IPSEC) {
		addListItem(frag, "mConnList", Label.getText(SC_TID_MONITOR_GATEWAY), config.gateway);
		addListItem(frag, "mConnList", Label.getText(SC_TID_MONITOR_REMOTE_ID), endpoints.remote_id, "remote_id");
		addListItem(frag, "mConnList", Label.getText(SC_TID_MONITOR_LOCAL_ID), endpoints.local_id, "local_id");
	}
	else {
		addListItem(frag, "mConnList", Label.getText(SC_TID_MONITOR_GATEWAY), network.remote_ip);
	}
	addListItem(frag, "mConnList", Label.getText(SC_TID_MONITOR_CONNECTED), getTimeStamp(config.history.connect_time * 1000));
	let protoStr = proto === PROTO_IPSEC ? "IPsec"
		: proto === PROTO_SSLVPN_TCP ? "SSL/TCP"
			: proto === PROTO_SSLVPN_UDP ? "SSL/UDP"
				: "IPsec";
	addListItem(frag, "mConnList", Label.getText(SC_TID_MONITOR_VPN_TYPE), protoStr, "vpn_type");

	if (proto === PROTO_IPSEC || (network['local_ip'] && network['local_ip'].length > 0)) {
		addListItem(frag, "mNetworkList", Label.getText(SC_TID_MONITOR_LOCAL_IP), network['local_ip'] + " : " + network['local_port'], "local_ip");
	}
	addListItem(frag, "mNetworkList", Label.getText(SC_TID_MONITOR_GATEWAY_IP), network['remote_ip'] + " : " + network['remote_port']);

	if (typeof config['vip'] !== "undefined" && config['vip'].length > 0) {
		// Assume client will have a single local ts since it does not act as a gateway.
		// If remote peer sends a list, take the first - as a client we should get only one
		// so receiving more than one is assumed to be a bug in peer implementation.
		addListItem(frag, "mNetworkList", Label.getText(SC_TID_MONITOR_VIRTUAL_IP), config['vip'], "vip");
	}

	//network["dns_servers"].push("220.220.220.220"); network["dns_servers"].push("222.222.222.222");
	if ($.isArray(network["dns_servers"]) && network["dns_servers"].length > 0) {
		let servers = "";
		network["dns_servers"].forEach(function (srv) {
			if (servers.length > 0) {
				servers += ", ";
			}
			servers += srv;
		});
		addListItem(frag, "mNetworkList", Label.getText(SC_TID_MONITOR_DNS_SERVERS), servers, "dnsText");
	}

	//network["dns_suffixes"] = []; network["dns_suffixes"].push("my.domain.com"); network["dns_suffixes"].push("their.domain.com")
	//network["dns_suffixes"].push("his.domain.com"); network["dns_suffixes"].push("her.domain.com");
	if ($.isArray(network["dns_suffixes"]) && network["dns_suffixes"].length > 0) {
		let sfxs = "";
		network["dns_suffixes"].forEach(function (sfx) {
			if (sfxs.length > 0) {
				sfxs += ", ";
			}
			sfxs += sfx;
		});
		addListItem(frag, "mNetworkList", Label.getText(SC_TID_MONITOR_DNS_SUFFIXES), sfxs, "dnsText");
	}

	if (tsArray.length > 0) {
		if (tsArray.length > 1) {
			remoteTSLabel = Label.getText(SC_TID_MONITOR_REMOTE_NETWORKS);
		}
		addListItem(frag, "mNetworkList", remoteTSLabel, tsArray[0]);
		tsArray.shift();
		tsArray.forEach(function (p2) {
			addListItem(frag, "mNetworkList", "", p2);
		});
		addListItem(frag, "mNetworkList", Label.getText(SC_TID_MONITOR_BYTES_RECEIVED), network.bytes_rcvd, "rxBytes");
		addListItem(frag, "mNetworkList", Label.getText(SC_TID_MONITOR_BYTES_TRANSMITTED), network.bytes_sent, "txBytes");
		if (proto === PROTO_IPSEC) {
			addListItem(frag, "mNetworkList", Label.getText(SC_TID_MONITOR_PACKETS_RECEIVED), network.packets_rcvd, "rxPackets");
			addListItem(frag, "mNetworkList", Label.getText(SC_TID_MONITOR_PACKETS_TRANSMITTED), network.packets_rcvd, "txPackets");
		}
	}
	else {
		// no IPsec sa - show labels with empty data
		if (proto === PROTO_IPSEC) {
			addListItem(frag, "mNetworkList", remoteTSLabel, Label.getText(SC_TID_MONITOR_NO_IPSEC_ACTIVE));
		}
		addListItem(frag, "mNetworkList", Label.getText(SC_TID_MONITOR_BYTES_RECEIVED), "", "rxBytes");
		addListItem(frag, "mNetworkList", Label.getText(SC_TID_MONITOR_BYTES_TRANSMITTED), "", "txBytes");
		if (proto === PROTO_IPSEC) {
			addListItem(frag, "mNetworkList", Label.getText(SC_TID_MONITOR_PACKETS_RECEIVED), "", "rxPackets");
			addListItem(frag, "mNetworkList", Label.getText(SC_TID_MONITOR_PACKETS_TRANSMITTED), "", "txPackets");
		}
	}

	if (proto === PROTO_IPSEC) {
		addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_IKE), "", "sectionLabel");
		addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_ENCRYPTION_ALG), security.ike_enc_alg + " / " + security.ike_enc_key_size);
		addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_INTEGRETY_ALG), security.ike_hash_alg);
		addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_PRF), security.ike_prf_alg);
		addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_DH_GROUP), security.ike_dh_group);
		addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_NEXT_REKEY), convertRekey(security.ike_rekey), "IKERekey");

		addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_IPSEC), "", "sectionLabel");

		if (security.ipsec_enc_alg.length > 0) {
			addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_ENCRYPTION_ALG), security.ipsec_enc_alg + " / " + security.ipsec_enc_key_size);
			if(security.ipsec_hash_alg){
				addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_INTEGRETY_ALG), security.ipsec_hash_alg);
			}
			if (security.ipsec_dh_group) {
				addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_DH_GROUP), security.ipsec_dh_group);
			}
			addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_NEXT_REKEY), convertRekey(security.ipsec_rekey), "p2Rekey");
		}
		else {
			addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_ENCRYPTION_ALG), Label.getText(SC_TID_MONITOR_NO_IPSEC_ACTIVE));
			addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_INTEGRETY_ALG), "");
			addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_DH_GROUP), "");
			addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_NEXT_REKEY), "", "p2Rekey");
		}
	}
	else {
		addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_SSLVPN), "", "sectionLabel");
		addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_SSL_ENCRYPTION_ALG), security.sslvpn_enc_alg);
		addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_INTEGRETY_ALG), security.sslvpn_hash_alg);
		addListItem(frag, "mSecurityList", Label.getText(SC_TID_MONITOR_COMPRESSION),
			security.sslvpn_compression ? Label.getText(SC_TID_TRUE) : Label.getText(SC_TID_FALSE), "compression");
	}

	$("div.monitors").append(frag);

	$("#" + connState.getMonitorView()).click();

	// dns_servers, dns_suffixes lists are shown on a single line which may overflow - add title attribute to show the entire list
	$("text.dnsText").each(function () {
		let $elem = $(this).parent().next();
		$elem.attr('title', $elem.text());
	});

	return true;
}

function setupSSOUIElements() {

	if (isConnectionHasSsoApiDomain()) {//Set up SSO UI with sso details
		setVPNPortalPortValue();
		setSSOButtonState();
		setupVPNPortalPortView();
	} else {//No sso auth details, disable sso button action and set tooptip for hint
		disableSsoOptionAndSetTooltip();
	} 
}

// Will trigger when the user clicks the SSO button
function onClickSSOLogin() {

	if (!connState.isAppMenuActive()) {

		let portValue = vpnPortalPortValue();
		let connection_name = connState.getActiveConnection();

		sc_sso_trigger_connection(connection_name, portValue, ssoTriggerCb);

		connState.transition();
	}
}

function vpnPortalPortValue() {
	const inputField = document.getElementById("vpn-portal-port-input-field");
	return inputField.value;
}

function isNumeric(value) {
	return /^[0-9]+$/.test(value);
}

function parsePortValueToInt(portValue) {
	if (isNumeric(portValue)) {
		return parseInt(portValue, 10);
	}
	return 0; // Return 0 if the value is not a valid numeric string
}

function isValidPortValue(portValue) {
	let port = parsePortValueToInt(portValue);
	return (port > 0 && port <= 65535);
}

function isVPNPortalPortHasValidValue() {
	const portValue = vpnPortalPortValue();
	return isValidPortValue(portValue);
}

function isConnectionHasSsoApiDomain() {
	let conInfo = connState.getConnInfo();

	// Return true if the connection type is "pro"
	if (conInfo.conn_type === "pro") {
		return true;
	}
		// Check if sso_api_domain exists and is not an empty string
	else if (conInfo.sso_api_domain && conInfo.sso_api_domain.trim() !== "") {
		return true;
	}

	// Default to false if the above conditions are not met
	return false;
}

function setVPNPortalPortValue() {
	const inputField = document.getElementById("vpn-portal-port-input-field");
	let conInfo = connState.getConnInfo();
	if ( conInfo.sso_api_port.trim() !== "") {
		let portValue = connState.getConnInfo().sso_api_port;
		
		if (isValidPortValue(portValue)) {
			inputField.value = portValue;
		} else {//if not a valid value set as empty
			inputField.value = "";
		}
	} else {//No Value for port, set default value
		inputField.value = "443";
	}
	
}

function onClickChangeVPNPortalPort() {

	let isValidValue = isVPNPortalPortHasValidValue();
	const img = document.getElementById("vpn-portal-port-icon");

	if (isValidValue) {
		const src = img.src.split("/").pop();  // Get only the file name from the src path
		if (src === "down-arrow.png") {
			$("#vpn-portal-port-input-area").hide();
			img.src = "css/images/right-arrow.png";
		} else {
			$("#vpn-portal-port-input-area").show();
			img.src = "css/images/down-arrow.png";
		}
	} else {//Keep open if there is no valid value for port
		$("#vpn-portal-port-input-area").show();
		img.src = "css/images/down-arrow.png";
	}
}

function setupVPNPortalPortView() {

	$("#vpn-portal-port-input-area").hide();
	const img = document.getElementById("vpn-portal-port-icon");
	img.src = "css/images/right-arrow.png";

	let isValidValue = isVPNPortalPortHasValidValue();

	if (!isValidValue) {//Keep open if there is no valid value for port
		$("#vpn-portal-port-input-area").show();
		img.src = "css/images/down-arrow.png";
	}
}

function vpnPortalPortDidChange() {

	const inputField = document.getElementById("vpn-portal-port-input-field");
	let value = inputField.value;
	// Check if the first character is '0' and remove it
	if (value.length > 0 && value[0] === '0') {
		value = value.slice(1); // Remove the first '0'
	}

	// Remove any non-digit characters for the rest of the input
	inputField.value = value.replace(/[^0-9]/g, '');
	setSSOButtonState();
}

function setSSOButtonState() {

	let enable = isVPNPortalPortHasValidValue();
	if (enable) {
		$("#sso-button").removeAttr("disabled");
		$("#sso-button-tooltip").text("");
		$("#vpn-portal-port-button").removeAttr("disabled");
	} else {
		$("#sso-button").attr("disabled", "disabled");
		$("#sso-button-tooltip").text(Label.getText(SC_TID_TOOLTIP_ENTER_VALID_PORT_VALUE));
	}
}

function disableSsoOptionAndSetTooltip() {
	$("#sso-button").attr("disabled", "disabled");
	$("#vpn-portal-port-button").attr("disabled", "disabled");
	$("#vpn-portal-port-input-area").hide();
	const img = document.getElementById("vpn-portal-port-icon");
	img.src = "css/images/right-arrow.png";
	$("#sso-button-tooltip").text(Label.getText(SC_TID_TOOLTIP_SSO_DETAILS_MISSING_CONNECT_TO_ADMIN));
}

function forceSSOReLogonCallback(ssoCookieDeleteStatus)
{

	if(ssoCookieDeleteStatus == SSO_COOKIE_DELETE_STATUS.DELETE_SUCCESS)
	{
		log(StatusMsg.getMsg(SC_SID_SSO_CLEAR_COOKIE_SUCCESS), StatusMsg.getLogLevel(SC_SID_SSO_CLEAR_COOKIE_SUCCESS));
	}
	else if(ssoCookieDeleteStatus == SSO_COOKIE_DELETE_STATUS.DELETE_NOTEXIST)
	{
		log(StatusMsg.getMsg(SC_SID_SSO_COOKIE_NOTEXIST), StatusMsg.getLogLevel(SC_SID_SSO_COOKIE_NOTEXIST));
	}
	else
	{
		log(StatusMsg.getMsg(SC_SID_SSO_CLEAR_COOKIE_FAILED), StatusMsg.getLogLevel(SC_SID_SSO_CLEAR_COOKIE_FAILED));
		alert(StatusMsg.getMsg(SC_SID_SSO_CLEAR_COOKIE_FAILED));
	}
	
}

function launchDefaultBrowser(e, message)
{
	e.preventDefault();
	e.stopImmediatePropagation();

	if(message != undefined)
	{
		sendFrameMessage(message);
	}
}
