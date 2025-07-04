let isActive = false;
let minInterval = 30; // default minimum seconds
let maxInterval = 120; // default maximum seconds
let targetTabId = null; // Store the specific tab ID to refresh

// Create a random interval between min and max
function getRandomInterval() {
    return (
        Math.floor(Math.random() * (maxInterval - minInterval + 1)) +
        minInterval
    );
}

// Reload the target tab
function reloadTargetTab() {
  if (targetTabId) {
    // Check if the target tab still exists
    chrome.tabs.get(targetTabId, (tab) => {
      if (chrome.runtime.lastError) {
        // Tab no longer exists, stop the auto-refresh
        isActive = false;
        targetTabId = null;
        chrome.alarms.clear("reloadAlarm");
        return;
      }
      
      // Tab exists, reload it
      chrome.tabs.reload(targetTabId);
      
      if (isActive) {
        scheduleNextReload();
      }
    });
  } else {
    // Fallback to current tab if no target tab set
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
      }
      if (isActive) {
        scheduleNextReload();
      }
    });
  }
}

// Schedule the next reload
function scheduleNextReload() {
    const interval = getRandomInterval();
    chrome.alarms.create("reloadAlarm", { delayInMinutes: interval / 60 });
}

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "reloadAlarm") {
    reloadTargetTab();
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggle") {
    isActive = request.value;
    if (isActive) {
      // Set the target tab to the current active tab when enabling
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          targetTabId = tabs[0].id;
          scheduleNextReload();
        }
      });
    } else {
      chrome.alarms.clear("reloadAlarm");
      targetTabId = null;
    }
  } else if (request.action === "updateIntervals") {
    minInterval = request.min;
    maxInterval = request.max;
    if (isActive) {
      chrome.alarms.clear("reloadAlarm");
      scheduleNextReload();
    }
  } else if (request.action === "getStatus") {
    // Get tab info if we have a target tab
    if (targetTabId) {
      chrome.tabs.get(targetTabId, (tab) => {
        if (chrome.runtime.lastError) {
          // Tab no longer exists
          sendResponse({ 
            isActive, 
            minInterval, 
            maxInterval, 
            targetTab: null 
          });
        } else {
          sendResponse({ 
            isActive, 
            minInterval, 
            maxInterval, 
            targetTab: { id: tab.id, title: tab.title, url: tab.url } 
          });
        }
      });
    } else {
      sendResponse({ isActive, minInterval, maxInterval, targetTab: null });
    }
  }
  return true;
});
