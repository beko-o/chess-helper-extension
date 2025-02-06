document.addEventListener("DOMContentLoaded", () => {
  let levelSlider = document.getElementById("skillLevel");
  let levelDisplay = document.getElementById("levelDisplay");
  let showArrowsCheckbox = document.getElementById("showArrows");

  chrome.storage.sync.get(["level", "showArrows"], (data) => {
      levelSlider.value = data.level || 10;
      levelDisplay.innerText = levelSlider.value;
      showArrowsCheckbox.checked = data.showArrows || false;
  });

  levelSlider.addEventListener("input", () => {
      let level = levelSlider.value;
      levelDisplay.innerText = level;
      chrome.storage.sync.set({ level: level });
  });

  showArrowsCheckbox.addEventListener("change", () => {
      chrome.storage.sync.set({ showArrows: showArrowsCheckbox.checked });
  });
});
