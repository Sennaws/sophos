
var Label = (function (langCode) {
	let lblMap = null;
	let labelArray = null;
	let lang = "en_us";
	return {
		init: function (langCode) {
			let arrayMap = null;
			if (langCode) {
				lang = langCode;
			}
			try {
				let langArrays = [
					["de_de", labelArray_de_de],
					["en_us", labelArray_en_us],
					["es_es", labelArray_es_es],
					["fr_fr", labelArray_fr_fr],
					["it_it", labelArray_it_it],
					["ja_jp", labelArray_ja_jp],
					["ko_kr", labelArray_ko_kr],
					["pt_br", labelArray_pt_br],
					["zh_cn", labelArray_zh_cn],
					["zh_tw", labelArray_zh_tw]
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
				labelArray = arrayMap.get(lang);
				if (typeof labelArray === "undefined") {
					lang = "en_us";
					labelArray = arrayMap.get(lang);
				}
			}
			catch (e) {
				labelArray = labelArray_en_us;
				lang = "en_us";
			}
			if (checkMapSupport()) {
				lblMap = new Map(labelArray);
			}
			else {
				lblMap = new Map();
				labelArray.forEach(function (item) {
					lblMap.set(item[0], item[1]);
				});
			}
		},
		get: function (mCode) {
			return lblMap.has(mCode) ? lblMap.get(mCode) : {};
		},
		getElemId: function (mCode) {
			let lbl = lblMap.has(mCode) ? lblMap.get(mCode) : {};
			return typeof lbl.elemId === "string" ? lbl.elemId : "";
		},
		getLang: function () {
			return lang;
		},
		getPlaceholder: function (mCode) {
			let lbl =  lblMap.has(mCode) ? lblMap.get(mCode) : {};
			return typeof lbl.placeholder === "string" ? lbl.placeholder : "";
		},
		getTitle: function (mCode) {
			let lbl =  lblMap.has(mCode) ? lblMap.get(mCode) : {};
			return typeof lbl.title === "string" ? lbl.title : "";
		},
		getSrcArray: function () { return labelArray; },
		getText: function (mCode) {
			let lbl = lblMap.has(mCode) ? lblMap.get(mCode) : {};
			return typeof lbl.text === "string" ? lbl.text : "";
		},
		getStatusDetails: function (msgCode) {
			return "<span class='normal'>" + this.getText(msgCode) + "</span>";
		},
		hasText: function (mCode) {
			let lbl =  lblMap.has(mCode) ? lblMap.get(mCode) : {};
			return typeof lbl.text === "string" ? true : false;
		},
		has: function (mCode) {
			return lblMap.has(mCode);
		},
		replaceAll: function () {
			labelArray.forEach(function (item) {
				let v = item[1];
				// console.log(v);
				if (typeof v.elemId === "string" && v.elemId.length) {
					let $elem = $("#" + v.elemId);
					if (typeof v.text === "string" && v.text.length) {
						$elem.text(v.text);
					}
					if (typeof v.title === "string" && v.title.length) {
						$elem.attr("title", v.title);
					}
					if (typeof v.placeholder === "string" && v.placeholder.length) {
						$elem.attr("placeholder", v.placeholder);
					}
				}
			});
			// ensure default settings of title and connect button
			document.title = this.getText(SC_TID_PRODUCT_NAME);
			$("#connectBtn").text(this.getText(SC_TID_STATUS_CONNECT_BTN)).attr("title", this.getTitle(SC_TID_STATUS_CONNECT_BTN));
			// update legal, import, and help links with current language
			if (this.getLang() !== "en_us") {
				let lCode = this.getLang().replace("_", "-");
				// let links = ["#legalLink", "#importDetailsLink"];
				let links = ["#legalLink", "#importDetailsLink", "#helpMILink"];
				// When the help menu item link is supported for languages other than en-us, use the three link array.
				links.forEach(function (link) {
					let new_href = $(link).attr("href");
					new_href = new_href.replace("en-us", lCode);
					$(link).attr("href", new_href);
				});
			}
			switch (this.getLang()) {
				case "de_de":
					$('ul#editMenu.dropMenu').css("width", "260px");
					$('div#connectionDetails li.editMenuItem div.editMenuText').width("230px");
					break;
				case "fr_fr":
				case "it_it":
					$('ul#appMenu.dropMenu').css("width", "180px");
					$('ul#appMenu.dropMenu').css("left", $('#statusArea').width() - 180);
					$('ul#editMenu.dropMenu').width("220px");
					$('div#connectionDetails li.editMenuItem div.editMenuText').width("190px");
					break;
				case "es_es":
					$('ul#appMenu.dropMenu').css("width", "180px");
					$('ul#appMenu.dropMenu').css("left", $('#statusArea').width() - 180);
					$('ul#editMenu.dropMenu').width("200px");
					$('div#connectionDetails li.editMenuItem div.editMenuText').width("170px");
					break;
				case "ja_jp":
					$('ul#appMenu.dropMenu').css("width", "160px");
					$('ul#appMenu.dropMenu').css("left", $('#statusArea').width() - 160);
					$('ul#editMenu.dropMenu').width("170px");
					$('div#connectionDetails li.editMenuItem div.editMenuText').width("140px");
					break;
				case "ko_kr":
					$('ul#appMenu.dropMenu').css("width", "150px");
					$('ul#appMenu.dropMenu').css("left", $('#statusArea').width() - 150);
					$('ul#editMenu.dropMenu').width("160px");
					$('div#connectionDetails li.editMenuItem div.editMenuText').width("130px");
					break;
				case "pt_br":
					$('ul#appMenu.dropMenu').css("width", "180px");
					$('ul#appMenu.dropMenu').css("left", $('#statusArea').width() - 180);
					$('ul#editMenu.dropMenu').width("190px");
					$('div#connectionDetails li.editMenuItem div.editMenuText').width("150px");
					break;
				case "zh_cn":
				case "zh_tw":
					$('ul#appMenu.dropMenu').css("width", "150px");
					$('ul#appMenu.dropMenu').css("left", $('#statusArea').width() - 150);
					$('ul#editMenu.dropMenu').width("150px");
					$('div#connectionDetails li.editMenuItem div.editMenuText').width("120px");
					break;
			}
			return true;
		}
    };
})();

