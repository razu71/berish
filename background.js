let isActive = false;
let minInterval = 30; // default minimum seconds
let maxInterval = 120; // default maximum seconds

// Create a random interval between min and max
function getRandomInterval() {
  return (
    Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval
  );
}

// Reload the current tab
function reloadCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.reload(tabs[0].id);
    }
    if (isActive) {
      scheduleNextReload();
    }
  });
}

// Schedule the next reload
function scheduleNextReload() {
  const interval = getRandomInterval();
  chrome.alarms.create("reloadAlarm", { delayInMinutes: interval / 60 });
}

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "reloadAlarm") {
    reloadCurrentTab();
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggle") {
    isActive = request.value;
    if (isActive) {
      scheduleNextReload();
    } else {
      chrome.alarms.clear("reloadAlarm");
    }
  } else if (request.action === "updateIntervals") {
    minInterval = request.min;
    maxInterval = request.max;
    if (isActive) {
      chrome.alarms.clear("reloadAlarm");
      scheduleNextReload();
    }
  } else if (request.action === "getStatus") {
    sendResponse({ isActive, minInterval, maxInterval });
  }
  return true;
});
