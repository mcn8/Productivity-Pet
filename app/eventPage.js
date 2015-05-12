var siteList = [];
var attemptedURL;
var lastBlockedTabId;
var allowedToViewBlockedSites = true;

var minuteInMilliseconds = 1000 * 60; //1 Minute in milliseconds
var isBreakTime = true;
var timerId;

/**
* Tab listener to check if site is on block list
**/
chrome.tabs.onUpdated.addListener(function(tabId, changedInfo, tab) {
  chrome.storage.sync.get('siteList', function(result){
    if(!(result === undefined)){
      siteList = result.siteList;
    }

    if(!allowedToViewBlockedSites){
      for (site in siteList) {
          if (tab.url.match(siteList[site])) {
            attemptedURL = tab.url;
            lastBlockedTabId = tabId;
            chrome.tabs.update(tabId, {"url" : chrome.extension.getURL("app/blocked.html")},
              function () {});
          }
      }
    }
  });
});

/**
* Start Work / Break Timers
**/
function timerRequest(workTime, breakTime){
  isBreakTime = !isBreakTime;
  if(!isBreakTime){
    chrome.browserAction.setBadgeText({"text" : "work"});
    chrome.browserAction.setBadgeBackgroundColor({"color" : "#FF0000"}); //Red
    allowedToViewBlockedSites = false;
    timerId = window.setTimeout(timerRequest, workTime * minuteInMilliseconds, workTime, breakTime);
  } else {
    chrome.browserAction.setBadgeText({"text" : "brk"});
    chrome.browserAction.setBadgeBackgroundColor({"color" : "#00FF00"}); //Green
    allowedToViewBlockedSites = true;
    timerId = window.setTimeout(timerRequest, breakTime * minuteInMilliseconds, workTime,breakTime);
  }
}

/**
* Stop Work / Break Timers
**/
function timerStop(){
  if(timerId){
    chrome.browserAction.setBadgeText({"text" : ""});
    isBreakTime = true;
    window.clearTimeout(timerId);
    timerId = undefined;
    allowedToViewBlockedSites = true;
  }
}
