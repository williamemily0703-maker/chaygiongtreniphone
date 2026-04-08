let currentVoice = null;
let widget;
let repeatCounter = 0;
const maxRepeats = 10;
let textToSpeakGlobal = "";
let correctAudioObj = null;
let wrongAudioObj = null;

(function() {
    'use strict';
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }
    createWidget();
    addEventListeners();
    
    // Tải sẵn Audio để lách luật iOS
    correctAudioObj = new Audio(chrome.runtime.getURL('correct.mp3'));
    wrongAudioObj = new Audio(chrome.runtime.getURL('wrong.mp3'));
})();

function loadVoices() {
    const voices = speechSynthesis.getVoices();
    currentVoice = voices.find(v => v.name.includes("Ava") && (v.name.includes("Enhanced") || v.name.includes("Premium"))) ||
                   voices.find(v => v.name === "Ava") ||
                   voices.find(v => v.name === "Samantha") || 
                   voices.find(v => v.lang === "en-US");
}

function createWidget() {
    widget = document.createElement('div');
    widget.id = 'german-editor-widget';
    Object.assign(widget.style, {
        position: 'absolute',
        background: '#ffffff',
        border: '1px solid #e0e0e0',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
        padding: '16px',
        zIndex: '2147483647',
        display: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        minWidth: '220px',
        touchAction: 'manipulation'
    });

    widget.innerHTML = `
        <div style="display:flex; gap: 12px; justify-content: center;">
            <button id="extension-highlight-btn" style="font-size:24px; background:#f5f5f5; border:none; border-radius:12px; padding:12px 20px; cursor:pointer;">🎨</button>
            <button id="extension-record-btn" style="font-size:24px; background:#e8f0fe; border:none; border-radius:12px; padding:12px 20px; cursor:pointer; color:#1a73e8;">🎤</button>
        </div>
        <div id="extension-score-display" style="font-size:15px; margin-top:12px; color:#333; text-align:center; line-height:1.4;"></div>
        <div id="extension-hint" style="font-size:13px; margin-top:8px; color:#666; text-align:center;"></div>
    `;
    document.body.appendChild(widget);
}

function addEventListeners() {
    document.addEventListener('touchend', handleSelection);
    document.addEventListener('mouseup', handleSelection);
    widget.querySelector('#extension-record-btn').addEventListener('click', handleRecordClick);
    widget.querySelector('#extension-highlight-btn').addEventListener('click', handleHighlightClick);
    chrome.runtime.onMessage.addListener(handlePopupCommands);
}

function handleSelection(event) {
    if (widget.contains(event.target)) return;

    if (repeatCounter > 0 && repeatCounter < maxRepeats) {
        speechSynthesis.cancel();
        repeatCounter = maxRepeats;
    }
    
    widget.style.display = 'none';

    setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText.length > 0) {
            startRepeatingSpeak(selectedText);
        }
    }, 150); 
}

function handleHighlightClick(event) {
    event.stopPropagation();
    document.execCommand('hiliteColor', false, '#ffff99');
    window.getSelection().removeAllRanges();
    widget.style.display = 'none';
}

function handleRecordClick(event) {
    event.stopPropagation();
    
    // MỞ KHÓA ÂM THANH NGAY KHI CHẠM VÀO NÚT
    if(correctAudioObj) { correctAudioObj.play().then(() => correctAudioObj.pause()).catch(e=>{}); }
    if(wrongAudioObj) { wrongAudioObj.play().then(() => wrongAudioObj.pause()).catch(e=>{}); }

    const text = widget.dataset.originalText || '';
    if (!text) return;
    
    startRecordingFlow(text);
}

function startRepeatingSpeak(text) {
    textToSpeakGlobal = text;
    repeatCounter = 0;
    speechSynthesis.cancel();
    triggerSpeakLoop();
}

function triggerSpeakLoop() {
    if (repeatCounter < maxRepeats) {
        repeatCounter++;
        const utterance = new SpeechSynthesisUtterance(textToSpeakGlobal);
        utterance.lang = 'en-US';
        utterance.rate = 0.9; 
        if (currentVoice) utterance.voice = currentVoice;
        
        utterance.onend = () => { setTimeout(triggerSpeakLoop, 600); };
        utterance.onerror = () => { repeatCounter = maxRepeats; checkSelectionAndShowWidget(); };
        speechSynthesis.speak(utterance);
    } else {
        if (repeatCounter === maxRepeats) checkSelectionAndShowWidget();
    }
}

function checkSelectionAndShowWidget() {
    const currentSelection = window.getSelection().toString().trim();
    if (currentSelection === textToSpeakGlobal) showWidgetAfterSpeaking();
}

function showWidgetAfterSpeaking() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return; 

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    widget.dataset.originalText = textToSpeakGlobal; 
    
    let left = window.scrollX + rect.left;
    let top = window.scrollY + rect.bottom + 15;
    
    // Thuật toán chống tràn màn hình iPad
    if (left + 260 > window.innerWidth) left = window.innerWidth - 270;
    if (left < 10) left = 10;

    Object.assign(widget.style, { left: `${left}px`, top: `${top}px`, display: 'block' });
    widget.querySelector('#extension-score-display').innerHTML = '';
    widget.querySelector('#extension-hint').textContent = '';
}

function startRecordingFlow(originalText) {
    widget.querySelector('#extension-score-display').innerHTML = '';
    const recordBtn = widget.querySelector('#extension-record-btn');
    const hint = widget.querySelector('#extension-hint');
    
    recordBtn.textContent = '⏳';
    hint.innerHTML = 'Mở Google Dịch...<br><b>Hãy bấm Mic 🎤 trên Tab mới và đọc nhé!</b>';

    const oneTimeHandler = (request, sender, sendResponse) => {
        if (request.action === "transcriptFromTranslate") {
            const userAnswer = (request.transcript || "").trim();
            if (userAnswer) {
                scoreAnswer(userAnswer, originalText);
            } else {
                hint.textContent = 'Lỗi: Không nhận được giọng nói.';
            }
            
            recordBtn.textContent = '🎤';
            chrome.runtime.onMessage.removeListener(oneTimeHandler);
            chrome.runtime.sendMessage({ action: "closeTranslatePopup" });
        }
        sendResponse({status: "handled"});
        return true;
    };
    
    chrome.runtime.onMessage.addListener(oneTimeHandler);
    chrome.runtime.sendMessage({ action: "openTranslatePopup" });
}

function scoreAnswer(userAnswer, modelAnswer) {
    const cleanAndSplit = (str) => str.toLowerCase().replace(/[.,?!;:]/g, '').split(/\s+/).filter(Boolean);
    const modelWords = cleanAndSplit(modelAnswer);
    const userWords = cleanAndSplit(userAnswer);

    const userWordFreq = userWords.reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
    }, {});

    let correctWordCount = 0;
    const resultHTML = modelWords.map(word => {
        if (userWordFreq[word] && userWordFreq[word] > 0) {
            correctWordCount++;
            userWordFreq[word]--;
            return `<span style="color:#0f9d58; font-weight:bold;">${word}</span>`;
        } else {
            return `<span style="color:#db4437; text-decoration: line-through;">${word}</span>`;
        }
    }).join(' ');

    const score = modelWords.length > 0 ? (correctWordCount / modelWords.length) * 100 : 0;
    const roundedScore = Math.round(score);

    const scoreDiv = document.createElement('div');
    scoreDiv.innerHTML = `
        <div style="font-size:24px; font-weight:bold; margin-bottom:8px; color:${roundedScore >= 80 ? '#0f9d58' : '#db4437'}">
            ${roundedScore}%
        </div>
        <div>${resultHTML}</div>
        <div style="margin-top:8px; font-size:13px; color:#555;"><i>Bạn đọc: ${userAnswer}</i></div>
    `;
    
    const hintDiv = widget.querySelector('#extension-hint');
    hintDiv.textContent = ''; 
    widget.querySelector('#extension-score-display').prepend(scoreDiv);

    // Phát âm thanh an toàn
    if (roundedScore >= 80) {
        if(correctAudioObj) { correctAudioObj.currentTime = 0; correctAudioObj.play().catch(()=>{}); }
    } else {
        if(wrongAudioObj) { wrongAudioObj.currentTime = 0; wrongAudioObj.play().catch(()=>{}); }
    }
}

function handlePopupCommands(request, sender, sendResponse) {
    if (request.action === "toggleEdit") {
        document.body.contentEditable = (document.body.contentEditable === 'true') ? 'false' : 'true';
    } else if (request.action === "getHTML") {
        chrome.runtime.sendMessage({action: "downloadHTML", content: document.documentElement.outerHTML});
    }
    sendResponse({status: "completed"});
    return true;
}
