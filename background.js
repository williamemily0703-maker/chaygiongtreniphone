const translateMap = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadHTML") {
    const htmlContent = request.content;
    const url = 'data:text/html;charset=UTF-8,' + encodeURIComponent(htmlContent);
    chrome.downloads.download({ url, filename: 'edited-page.html' });
    sendResponse({status: "ok"});
    return true;
  }

  // Thay đổi: Mở Tab thay vì Popup Window để tương thích iOS
  if (request.action === "openTranslatePopup") {
    const openerTabId = sender?.tab?.id;
    const popupUrl = "https://translate.google.com/?sl=en&tl=vi&op=translate";

    chrome.tabs.create({ url: popupUrl, active: true }, (tab) => {
      if (chrome.runtime.lastError) {
        sendResponse({ status: "error", message: chrome.runtime.lastError.message });
        return;
      }
      if (openerTabId) {
        translateMap.set(tab.id, openerTabId);
      }
      sendResponse({ status: "opened", tabId: tab.id });
    });
    return true; 
  }

  // Chuyển tiếp văn bản thu được về Tab gốc
  if (request.action === "transcriptFromTranslate") {
    const translateTabId = sender?.tab?.id;
    const openerTabId = translateMap.get(translateTabId);
    
    if (openerTabId) {
      chrome.tabs.sendMessage(openerTabId, {
        action: "transcriptFromTranslate",
        transcript: request.transcript || ""
      });
    }
    sendResponse({ status: "forwarded" });
    return true;
  }

  // Đóng tab Google Dịch khi hoàn thành
  if (request.action === "closeTranslatePopup") {
    for (const [tabId] of translateMap.entries()) {
      chrome.tabs.remove(tabId, () => {});
      translateMap.delete(tabId);
    }
    sendResponse({ status: "closed" });
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (translateMap.has(tabId)) {
    translateMap.delete(tabId);
  }
});
