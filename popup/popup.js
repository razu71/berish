document.addEventListener("DOMContentLoaded", function () {
  const toggleSwitch = document.getElementById("toggleSwitch");
  const statusText = document.getElementById("statusText");
  const minIntervalInput = document.getElementById("minInterval");
  const maxIntervalInput = document.getElementById("maxInterval");
  const saveIntervalsBtn = document.getElementById("saveIntervals");
  const nextReloadInfo = document.getElementById("nextReloadInfo");

  // Get current status from background script
  chrome.runtime.sendMessage({ action: "getStatus" }, function (response) {
    toggleSwitch.checked = response.isActive;
    statusText.textContent = response.isActive ? "Enabled" : "Disabled";
    minIntervalInput.value = response.minInterval;
    maxIntervalInput.value = response.maxInterval;
  });

  // Toggle switch handler
  toggleSwitch.addEventListener("change", function () {
    const isActive = this.checked;
    statusText.textContent = isActive ? "Enabled" : "Disabled";
    chrome.runtime.sendMessage({ action: "toggle", value: isActive });
  });

  // Save intervals handler
  saveIntervalsBtn.addEventListener("click", function () {
    const min = parseInt(minIntervalInput.value);
    const max = parseInt(maxIntervalInput.value);

    if (min > max) {
      alert("Minimum interval must be less than or equal to maximum interval");
      return;
    }

    if (min < 5 || max < 5) {
      alert("Interval must be at least 5 seconds");
      return;
    }

    chrome.runtime.sendMessage({
      action: "updateIntervals",
      min: min,
      max: max,
    });

    // Close the popup after saving intervals
    window.close();
  });

  // Optional: Update next reload time display
  setInterval(() => {
    chrome.alarms.get("reloadAlarm", (alarm) => {
      if (alarm) {
        const timeLeft = Math.round((alarm.scheduledTime - Date.now()) / 1000);
        nextReloadInfo.textContent = `Next reload in ~${timeLeft} seconds`;
      } else {
        nextReloadInfo.textContent = toggleSwitch.checked
          ? "Calculating next reload..."
          : "Auto-reload disabled";
      }
    });
  }, 1000);
});
