(function() {
  console.log("[translate_capture] loaded on iOS/Mobile");

  let lastSentText = "";
  let debounceTimer = null;

  function normalize(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function findSourceTextarea() {
    // Thêm các selector dành riêng cho giao diện Mobile/Tablet
    const selectors = [
      'textarea[aria-label*="Source"]',
      'textarea[aria-label*="Nguồn"]',
      'textarea.er8xn',
      'textarea.vks', // Class mobile
      'textarea'      // Quét tất cả textarea nếu không tìm thấy class cụ thể
    ];
    
    for (const selector of selectors) {
      const els = document.querySelectorAll(selector);
      for (const el of els) {
          // Trả về phần tử có chứa chữ
          if (el && el.value !== undefined) return el;
      }
    }
    return null;
  }

  function readAndSendTranscript() {
    const textarea = findSourceTextarea();
    if (!textarea) return;

    const currentText = normalize(textarea.value);

    // Chỉ gửi khi có nội dung thực sự
    if (currentText && currentText.length > 0 && currentText !== lastSentText) {
      lastSentText = currentText;
      console.log("Sending transcript:", currentText);
      chrome.runtime.sendMessage({ action: "transcriptFromTranslate", transcript: currentText });
    }
  }

  function handleChanges() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(readAndSendTranscript, 1000); // Giảm độ trễ xuống 1 giây cho nhạy
  }

  const observer = new MutationObserver(handleChanges);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

})();
