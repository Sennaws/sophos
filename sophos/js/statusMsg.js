
var StatusMsg = (function (langCode) {
	let msgMap = null;
	let statusMsgArray = null;
	let langTag = "en_us";
	return {
		init: function (langCode) {
			let arrayMap = null;
			if (langCode) {
				langTag = langCode;
			}
			try {
				let langArrays = [
					["de_de", statusMsgArray_de_de],
					["en_us", statusMsgArray_en_us],
					["es_es", statusMsgArray_es_es],
					["fr_fr", statusMsgArray_fr_fr],
					["it_it", statusMsgArray_it_it],
					["ja_jp", statusMsgArray_ja_jp],
					["ko_kr", statusMsgArray_ko_kr],
					["pt_br", statusMsgArray_pt_br],
					["zh_cn", statusMsgArray_zh_cn],
					["zh_tw", statusMsgArray_zh_tw]
				];
				if (checkMapSupport()) {
					arrayMap = new Map(langArrays);
				}
				else {
					arrayMap = new Map();
					langArrays.forEach(function (item) {
						arrayMap.set(item[0], item[1]);
					});
				}
				statusMsgArray = arrayMap.get(langTag);
				if (typeof statusMsgArray === "undefined") {
					langTag = "en_us";
					statusMsgArray = arrayMap.get(langTag);
				}
			}
			catch (e) {
				statusMsgArray = statusMsgArray_en_us;
				langTag = "en_us";
			}
			if (checkMapSupport()) {
				msgMap = new Map(statusMsgArray);
			}
			else {
				msgMap = new Map();
				statusMsgArray.forEach(function (item) {
					msgMap.set(item[0], item[1]);
				});
			}
		},
		get: function (mCode) {
			return msgMap.has(mCode) ? msgMap.get(mCode) : {};
		},
		getSrcArray: function () { return statusMsgArray; },
		getMsg: function (msgCode, inArgs) {
			if (msgCode === 0) {
				return "";
			}
			if (!msgMap.has(msgCode)) {
				return "Unmapped status code";
			}
			let msgObj = msgMap.get(msgCode);
			let nMsg = msgObj.msg;
			let numArgs = msgObj.args;
			if (numArgs > 0) {
				let msgArgs = [];
				if ($.isArray(inArgs)) {
					msgArgs = inArgs;
				}
				else if (typeof inArgs === 'string') {
					msgArgs = Array.prototype.slice.call(arguments);
					msgArgs.shift();
				}
				// check arg list in entry against msg and replace
				let ndx = 0;
				for (; ndx < numArgs; ndx++) {
					let marker = "%%" + (ndx + 1) + "%%";
					nMsg = nMsg.replace(marker, msgArgs[ndx] ? msgArgs[ndx] : "");
				}
			}
			return nMsg;
		},
		getLang: function () {
			return langTag;
		},
		getLogLevel: function (msgCode) {
			// log consts must match those in sc.js
			const LOGERR = 3,
				LOGWARN = 4,
				LOGINFO = 6,
				LOGDEBUG = 7;
			let msgState = msgMap.has(msgCode) ? msgMap.get(msgCode).state : "";
			let logLevel;
			switch (msgState) {
				case "error":
					logLevel = LOGERR;
					break;
				case "warning":
					logLevel = LOGWARN;
					break;
				case "normal":
				case "connected":
					logLevel = LOGINFO;
					break;
				default:
					logLevel = LOGDEBUG;
					break;
			}
			return logLevel;
		},
		getState: function (msgCode) {
			return msgCode === 0 ? "normal" : msgMap.has(msgCode) ? msgMap.get(msgCode).state : "error";
        },
		getStatusDetails: function (msgCode, inArgs) {
			return "<span class='" + this.getState(msgCode) + "'>" + this.getMsg(msgCode, inArgs) + "</span>";
		},
		getTitle: function (msgCode) {
			return msgMap.has(msgCode) ? msgMap.get(msgCode).title : "";
		},
		hasMsg: function (msgCode) {
			return msgMap.has(msgCode);
		},
		has: function (msgCode) {
			return msgMap.has(msgCode);
		}
    };
})();

var NMap = StatusMsg;

