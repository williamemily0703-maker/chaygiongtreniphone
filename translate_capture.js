(function() {
  console.log("[translate_capture] loaded");

  let lastSentText = "";
  let debounceTimer = null;

  function normalize(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function findSourceTextarea() {
    const selectors = [
      'textarea[aria-label*="Source"]',
      'textarea[aria-label*="Nguồn"]',
      'textarea.er8xn'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function readAndSendTranscript() {
    const textarea = findSourceTextarea();
    if (!textarea) return;

    const currentText = normalize(textarea.value);

    if (currentText && currentText !== lastSentText) {
      lastSentText = currentText;
      console.log("Sending transcript:", currentText);
      chrome.runtime.sendMessage({ action: "transcriptFromTranslate", transcript: currentText });
    }
  }

  function handleChanges() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(readAndSendTranscript, 1500);
  }

  // Sử dụng MutationObserver để theo dõi các thay đổi
  const observer = new MutationObserver(handleChanges);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // === THÊM MỚI: Tự động cuộn đến nút micro ===
  function scrollToMicrophone() {
      // Các selector có thể có cho nút micro trên Google Dịch
      const selectors = [
          'button[aria-label*="voice input"]', // Tiếng Anh
          'button[aria-label*="nhập liệu bằng giọng nói"]', // Tiếng Việt
          'button[jsname="a3F7od"]' // Một jsname ổn định
      ];

      let micButton = null;
      for (const selector of selectors) {
          micButton = document.querySelector(selector);
          if (micButton) break;
      }

      if (micButton) {
          micButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
          console.log("[translate_capture] Scrolled to microphone button.");
      } else {
          console.log("[translate_capture] Could not find microphone button.");
      }
  }

  // Chờ một chút để giao diện Google Dịch tải xong hoàn toàn rồi mới cuộn
  setTimeout(scrollToMicrophone, 500);

})();