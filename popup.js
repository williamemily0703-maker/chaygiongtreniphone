
document.getElementById('toggleEditBtn').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: "toggleEdit"});
  });
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: "getHTML"});
  });
});
