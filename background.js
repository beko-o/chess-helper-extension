console.log("🎯 background.js загружен!");

chrome.runtime.onInstalled.addListener(() => {
    console.log("🔄 Chess Assistant установлен или обновлен.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("📩 Получено сообщение:", request);

    if (request.action === "ping") {
        sendResponse("pong");
    }

    return true; // Держит соединение открытым
});
