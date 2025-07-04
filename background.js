let isActive = false;
let minInterval = 30; // default minimum seconds
let maxInterval = 120; // default maximum seconds
let targetTabId = null; // Store the specific tab ID to refresh

// Load saved state from storage
chrome.storage.local.get(
    ["isActive", "minInterval", "maxInterval", "targetTabId"],
    (result) => {
        if (result.isActive !== undefined) {
            isActive = result.isActive;
            minInterval = result.minInterval || 30;
            maxInterval = result.maxInterval || 120;
            targetTabId = result.targetTabId || null;

            // Resume auto-refresh if it was active
            if (isActive && targetTabId) {
                scheduleNextReload();
            }
        }
    }
);

// Save state to storage
function saveState() {
    chrome.storage.local.set({
        isActive: isActive,
        minInterval: minInterval,
        maxInterval: maxInterval,
        targetTabId: targetTabId,
    });
}

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
                saveState();
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

// Listen for tab updates to close popup when target tab reloads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // If the target tab is reloading, close any open popup
    if (tabId === targetTabId && changeInfo.status === "loading") {
        // Send message to popup to close itself if it's open
        chrome.runtime.sendMessage({ action: "closePopup" }).catch(() => {
            // Ignore errors if popup is not open
        });
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
                    saveState();
                }
            });
        } else {
            chrome.alarms.clear("reloadAlarm");
            targetTabId = null;
            saveState();
        }
    } else if (request.action === "updateIntervals") {
        minInterval = request.min;
        maxInterval = request.max;
        saveState();
        if (isActive) {
            chrome.alarms.clear("reloadAlarm");
            scheduleNextReload();
        }
    } else if (request.action === "getStatus") {
        // Get the current tab ID to check if it's the target tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTabId = tabs[0] ? tabs[0].id : null;
            const isCurrentTabTarget = targetTabId === currentTabId;

            // Get tab info if we have a target tab and popup is opened on target tab
            if (targetTabId && isCurrentTabTarget) {
                chrome.tabs.get(targetTabId, (tab) => {
                    if (chrome.runtime.lastError) {
                        // Tab no longer exists
                        sendResponse({
                            isActive: false,
                            minInterval: 30,
                            maxInterval: 120,
                            targetTab: null,
                            isCurrentTabTarget: false,
                        });
                    } else {
                        sendResponse({
                            isActive,
                            minInterval,
                            maxInterval,
                            targetTab: {
                                id: tab.id,
                                title: tab.title,
                                url: tab.url,
                            },
                            isCurrentTabTarget: true,
                        });
                    }
                });
            } else {
                // Return default values if not on target tab
                sendResponse({
                    isActive: false,
                    minInterval: 30,
                    maxInterval: 120,
                    targetTab: targetTabId ? { id: targetTabId } : null,
                    isCurrentTabTarget: false,
                });
            }
        });
    }
    return true;
});
