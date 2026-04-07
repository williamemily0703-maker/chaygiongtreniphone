const translateMap = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadHTML") {
    const htmlContent = request.content;
    const url = 'data:text/html;charset=UTF-8,' + encodeURIComponent(htmlContent);
    chrome.downloads.download({ url, filename: 'edited-page.html' });
    sendResponse({status: "ok"});
    return true;
  }

  if (request.action === "openTranslatePopup") {
    const openerTabId = sender?.tab?.id;
    const popupUrl = "https://translate.google.com/?sl=en&tl=vi&op=translate";

    chrome.system.display.getInfo((displays) => {
      const screen = displays[0].workArea; 
      
      // Tối ưu kích thước popup cho màn hình di động/tablet
      const popupWidth = Math.min(screen.width, 400); 
      const popupHeight = Math.min(screen.height * 0.5, 350); 

      chrome.windows.create({
          url: popupUrl,
          type: "popup",
          width: popupWidth,
          height: popupHeight,
          left: Math.round(screen.width - popupWidth),
          top: Math.round(screen.height - popupHeight),
          focused: true
        },
        (win) => {
          if (chrome.runtime.lastError) {
            sendResponse({ status: "error", message: chrome.runtime.lastError.message });
            return;
          }
          chrome.tabs.query({ windowId: win.id }, (tabs) => {
            const translateTab = tabs && tabs[0];
            if (translateTab && openerTabId) {
              translateMap.set(translateTab.id, openerTabId);
              sendResponse({ status: "opened", tabId: translateTab.id });
            } else {
              sendResponse({ status: "opened" });
            }
          });
        }
      );
    });
    return true; 
  }

  if (request.action === "transcriptFromTranslate") {
    const translateTabId = sender?.tab?.id;
    const openerTabId = translateMap.get(translateTabId);
    if (openerTabId) {
      chrome.tabs.sendMessage(openerTabId, {
        action: "transcriptFromTranslate",
        transcript: request.transcript || ""
      });
    }
    sendResponse({ status: "forwarded", to: openerTabId || null });
    return true;
  }

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