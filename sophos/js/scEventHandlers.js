/*
 * scEventHandlers.js
 *
 * Created by James Knowles 13 June 2019
 * Copyright 2019 Sophos Inc. All rights reserved.
 *
 */

function aboutPageLinkKeydown(evt) {
	let $elem = $(evt.currentTarget);
	evt.stopImmediatePropagation();
	switch (evt.keyCode) {
		case 9:
			if (!evt.shiftKey && $elem.parent().attr('id') === "community") {
				evt.preventDefault();
				$("#connectionsTab").focus();
			}
			break;
		case 13:
			// Enter
			$elem.trigger("click");
			break;
		case 32:
			// Space Bar
			// $elem.trigger("click");
			// Although we get the space bar keydown and although we call the same trigger as the Enter case,
			// this does nothing and I have no idea why. jQuery issue? Accessability magic? Angered the web gods?
			// Also tried (among other chants and incantations) the following,
			// let jqEvt = jQuery.Event("keydown", { keyCode: 13 });
			// evt.preventDefault();
			// setTimeout(function () { $elem.trigger('keydown', jqEvt) }, 100);
			// which triggered a keydown and called this handler function and went to the case 13
			// above which works when an actual Enter key is pressed, still: no go joe code.
			// Space Bar has some strange magic - once pressed on a link, "Poof!", weirdness happens.
			// looking for a web wizard on google with no luck...
			break;
		default:
			break;
	}
}

function aboutMenuClickCb(evt) {
    $("#ConnectionsPage").hide();
    $("#EventsPage").hide();
    $(".header ul.tabs > li.tab").each(function () {
        $(this).removeClass("active");
    });
    $("#eventsTriangle").removeClass("triangle");
    $("#connectionsTriangle").removeClass("triangle");
    $("#AboutPage").show();
    $("#legal > a").focus();
}

function divMenuKeydownCb (evt) {
	if ($("#connectionDetails:visible").length > 0) {
        $("#importMenuItem").show();
    }
    else {
        $("#importMenuItem").hide();
    }
}

function divMenuClickCb (evt) {
    evt.stopPropagation();
    if ($("#divMenu[disabled]").length === 0) {
        $("ul#appMenu").toggleClass('active');
        if ($("#connectionDetails:visible").length > 0) {
            $("#importMenuItem").show();
        }
        else {
            $("#importMenuItem").hide();
        }
    }
}

function connectionIconKeydownCb (evt) {
	let $elem = $(evt.currentTarget);

    switch (evt.keyCode) {
        case 9:
            if (!evt.shiftKey) {
                evt.preventDefault();
                $("#networksIcon").click();
            }
            break;
        case 13:
        case 32:
            $("div.mConnection ul").each(function () {
                $(this).removeClass('active').hide();
            });
			$("div.mConnection ul.mConnList").addClass('active').show();
            connState.setMonitorView($elem.attr('id'));
            break;
        default:
            break;
    }
}

function networksIconKeydownCb(evt) {
	let $elem = $(evt.currentTarget);
    switch (evt.keyCode) {
        case 9:
            evt.preventDefault();
            if (evt.shiftKey) {
                $("#connectionIcon").click();
            }
			else {
				$("#securityIcon").trigger('click');
            }
            break;
        case 13:
		case 32:
            $("div.mConnection ul").each(function () {
                $(this).removeClass('active').hide();
            });
			$("div.mConnection ul.mNetworkList").addClass('active').show();
            connState.setMonitorView($elem.attr('id'));
            break;
        default:
            break;
    }
}

function securityIconKeydownCb(evt) {
	let $elem = $(evt.currentTarget);

	switch (evt.keyCode) {
        case 9:
            evt.preventDefault();
            if (evt.shiftKey) {
                $("#networksIcon").click();
            }
            else {
                setTimeout(function () { $("#connectionsTab").focus(); }, 50);
            }
            break;
        case 13:
        case 32:
            $("div.mConnection ul").each(function () {
                $(this).removeClass('active').hide();
            });
			$("div.mConnection ul.mSecurityList").addClass('active').show();
            connState.setMonitorView($elem.attr('id'));
            break;
        default:
            break;
    }
}

function monitorPageIconClickCb(evt) {
	let $elem = $(evt.currentTarget);
	let iconId = $elem.attr('id');
	if ($elem.parent().attr('id') === "monitorPageTitle") {
		$("div.mConnection ul").each(function () {
			$(this).removeClass('active').hide();
		});
	}
	function setActive(iconId) {
		$elem.focus();
		evt.stopPropagation();
		if (connState.isAppMenuActive()) {
			$("#appMenu").toggleClass('active');
		}
		connState.setMonitorView(iconId);
	}
	switch (iconId) {
		case "connectionIcon":
			$("div.mConnection ul.mConnList").addClass('active').show();
			setActive(iconId);
			break;
		case "networksIcon":
			$("div.mConnection ul.mNetworkList").addClass('active').show();
			setActive(iconId);
			break;
		case "securityIcon":
			$("div.mConnection ul.mSecurityList").addClass('active').show();
			setActive(iconId);
			break;
		default:
			break;
	}
}

function monitorPageIconFocusCb(evt) {
    let $elem = $(evt.currentTarget);
    connState.setMonitorView($elem.attr('id'));
}

function clearEventsBtnClickCb(evt) {
    $("#logarea").empty();
}

function clearEventsBtnKeydownCb(evt) {
    if (evt.keyCode === 9 && !evt.shiftKey) {
        evt.preventDefault();
        setTimeout(function () { $("#connectionsTab").focus(); }, 50);
    }
}

function generateTSRServiceToggleCb(evt) {
    let $elem = $(evt.currentTarget);
	if (connState.getState() === NOSERVICE) {
        $elem.attr("disabled", "disabled");
    }
    else {
        $elem.removeAttr("disabled");
    }
}

function generateTSRClickCb(evt) {
	if (connState.getState() === NOSERVICE) {
		evt.stopImmediatePropagation();
		evt.preventDefault();
	}
}

function bodyClickCb(evt) {
	if (connState.isEditing() || connState.isConfig()) {
		let $elem = $(evt.currentTarget);
		if ($elem.attr("id") !== "editIcon") {
			evt.stopImmediatePropagation();
			evt.preventDefault();
			if (connState.isConfig()) {
				$("#editMenu").removeClass('active');
				if (evt.currentTarget.tagName.toLowerCase() === 'body') {
					setTimeout(function () { $("#editIcon").focus(); }, 50);
				}
				else {
					$(evt.currentTarget).focus();
				}
			}
			else {
				if (!saveConnectionName($('li.connListItem.selected div.listText.editable'))) {
					onChangeConnectionsList($("li.connListItem.selected"));
				}
			}
		}
	}
	else if (connState.isAppMenuActive()) {
		let targetId = $(evt.target).attr('id');
		evt.preventDefault();
		$("#appMenu").toggleClass('active');
		if (targetId === "user" || targetId === "pass" || targetId === "otp" || targetId === "send") {
			setTimeout(function () { $(evt.target).focus(); }, 50);
		}
		else if (evt.target.htmlFor === "saveCredentials") {
			$('#saveCredentials').click();
		}
		else {
			$("#divMenu").focus();
		}
	}
}

function inputPKCSFileChangeCb(evt) {
    if (this.files.length > 0) {
        let fileInfo = this.files[0];
        if (!fileInfo.size) {
			let logMsg = StatusMsg.getMsg(SC_SID_IMPORT_FILE_EMPTY_ERR, fileInfo.name);
            log(logMsg, LOGERR);
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
            connState.setCertificateFile(fileInfo.name);
            importCertificateFile(fileInfo);
        }
    }
    // clear the filename so sequential selection of the same file will fire the change event
    evt.currentTarget.value = "";
}

function pkcs12FileLoadCb(evt) {
    let fileContent = evt.srcElement.result.replace(/^.*,/, '');    // strip prefix
    if (fileContent && fileContent.length) {
        uploadCert(fileContent);
    }
}

function connectionFileLoadCb(evt) {
	let fileContent = evt.srcElement.result;
	let scx = null;
	let connName = "";
	if (fileContent && fileContent.length) {
		let fType = "scx";
		let addConnection = function () {
			//console.log(connName);
			sc_add(fileContent, fType, false, importCb);
		};
		connState.setFileInfo(fileContent);
		try {
			scx = JSON.parse(fileContent);
			if (!scx.local_auth && !scx.remote_auth) {
				// This cannot be a valid scx file - check for required provisioning file members
				if ($.isArray(scx) && scx.length > 0) {
					fType = "pro";
				}
				else if (scx.gateway && scx.display_name) {
					fType = "pro";
					connName = scx.display_name;
				}
				else {
					if (scx.gateway || scx.display_name) {
						fType = "pro";
					}
				}
			}
			connState.setFileType(fType);
			if (fType === "pro") {
				addConnection();
			}
			else {
				if (scx.name && scx.local_auth.pubkey && (!scx.local_auth.pubkey.cert || scx.local_auth.pubkey.cert.length === 0)) {
					importCert(fileContent, scx.name);
				}
				else {
					if (scx.name.length) {
						connName = scx.name;
					}
					addConnection();
				}
			}
		}
		catch (e) {
			// An exception is thrown when JSON parse fails - check other file formats
			connName = fileContent.match(/.*remote\s+.*/);
			if (connName && connName[0] && connName[0].length) {
				if (fileContent.match(/.*Certificate:.*/)) {
					fType = "utm-ssl";
				}
				else {
					fType = "xg-ssl";
				}
				connState.setFileType(fType);
				connName = connName[0].substring(7);
				connName = connName.substring(0, connName.indexOf(" "));
				addConnection();
			}
			else if (fileContent.indexOf("PROFILE1") !== -1) {
				let ndx1 = fileContent.indexOf("Name=") + 5;
				let ndx2 = fileContent.indexOf("ConnType") - 2;
				connName = connState.getFileInfo().substring(ndx1, ndx2);
				fType = "ini";
				connState.setFileType(fType);
				if (fileContent.indexOf("IkeAuth=3") !== -1) {
					// Assume this is an INI file from UTM requiring certificate import
					importCert(fileContent, connName);
				}
				else {
					addConnection();
				}
			}
			else {
				let mArr = fileContent.match(/.*Remote-ID\ = (.*)-REMOTEID.*/);
				if ($.isArray(mArr) && mArr.length === 2) {
					connName = mArr[1];
					fType = "tgb";
				}
				else {
					connName = "";
					fType = "";
				}
				connState.setFileType(fType);
				addConnection();
			}
		}
		//console.log("File type is " + connState.getFileType());
	}
	return true;
}