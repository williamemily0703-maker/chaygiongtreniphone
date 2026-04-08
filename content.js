let currentVoice = null;
let widget;
let mediaRecorder;
let audioChunks = [];
let repeatCounter = 0;
const maxRepeats = 10;
let textToSpeakGlobal = "";

// Khởi tạo Audio Objects trước
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
    
    // Tải sẵn âm thanh vào bộ nhớ
    correctAudioObj = new Audio(chrome.runtime.getURL('correct.mp3'));
    wrongAudioObj = new Audio(chrome.runtime.getURL('wrong.mp3'));
})();

function loadVoices() {
    const voices = speechSynthesis.getVoices();
    currentVoice = voices.find(v => v.name.includes("Ava") && (v.name.includes("Enhanced") || v.name.includes("Premium"))) ||
                   voices.find(v => v.name === "Ava") ||
                   voices.find(v => v.name.includes("Natural")) || 
                   voices.find(v => v.name === "Samantha") || 
                   voices.find(v => v.lang === "en-US");
}

function createWidget() {
    widget = document.createElement('div');
    widget.id = 'german-editor-widget';
    Object.assign(widget.style, {
        position: 'absolute',
        background: 'white',
        border: '1px solid #dbdbdb',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        padding: '12px',
        zIndex: '2147483647',
        display: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        minWidth: '200px',
        touchAction: 'manipulation'
    });

    widget.innerHTML = `
        <div style="display:flex; gap: 10px; justify-content: center;">
            <button id="extension-highlight-btn" title="Highlight" style="font-size: 24px; background:none; border:1px solid #eee; border-radius:8px; padding:10px; cursor:pointer;">🎨</button>
            <button id="extension-record-btn" title="Ghi âm & Chấm điểm" style="font-size: 24px; background:none; border:1px solid #eee; border-radius:8px; padding:10px; cursor:pointer;">🎤</button>
        </div>
        <div id="extension-score-display" style="font-size:14px; margin-top:10px; color:black; text-align:center;"></div>
        <div id="extension-hint" style="font-size:12px; margin-top:5px; color:#666; text-align:center;"></div>
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
    }, 100); 
}

function handleHighlightClick(event) {
    event.stopPropagation();
    document.execCommand('hiliteColor', false, '#ffff99');
    window.getSelection().removeAllRanges();
    widget.style.display = 'none';
}

function handleRecordClick(event) {
    event.stopPropagation();
    
    // TRICK CHO iOS: "Mở khóa" âm thanh ngay khi người dùng chạm tay vào màn hình
    if(correctAudioObj) correctAudioObj.play().then(() => correctAudioObj.pause()).catch(e => console.log("Unlock correct audio failed", e));
    if(wrongAudioObj) wrongAudioObj.play().then(() => wrongAudioObj.pause()).catch(e => console.log("Unlock wrong audio failed", e));

    const text = widget.dataset.originalText || '';
    if (!text) {
        alert("Hãy bôi đen một câu trước đã.");
        return;
    }
    startRecording(text);
}

function handlePopupCommands(request, sender, sendResponse) {
    if (request.action === "toggleEdit") {
        const isEditable = document.body.contentEditable === 'true';
        document.body.contentEditable = !isEditable;
    } else if (request.action === "getHTML") {
        const pageHTML = document.documentElement.outerHTML;
        chrome.runtime.sendMessage({action: "downloadHTML", content: pageHTML});
    }
    sendResponse({status: "completed"});
    return true;
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
        
        utterance.onend = () => { setTimeout(triggerSpeakLoop, 500); };
        utterance.onerror = (e) => { repeatCounter = maxRepeats; checkSelectionAndShowWidget(); };
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
    let top = window.scrollY + rect.bottom + 10;
    if (left + 250 > window.innerWidth) left = window.innerWidth - 260;

    Object.assign(widget.style, { left: `${left}px`, top: `${top}px`, display: 'block' });
    widget.querySelector('#extension-score-display').innerHTML = '';
    widget.querySelector('#extension-hint').textContent = '';
}

async function startRecording(originalText) {
    widget.querySelector('#extension-score-display').innerHTML = '';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audioPlayer = document.createElement('audio');
            audioPlayer.src = audioUrl;
            audioPlayer.controls = true;
            audioPlayer.style.width = '100%';
            audioPlayer.style.marginTop = '8px';
            widget.querySelector('#extension-score-display').appendChild(audioPlayer);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();

        const recordBtn = widget.querySelector('#extension-record-btn');
        const hint = widget.querySelector('#extension-hint');
        recordBtn.textContent = '⏳';
        hint.textContent = 'Đang ghi âm... Nhớ bấm nút Mic bên popup Google Dịch nhé!';
        
        const oneTimeHandler = (request, sender, sendResponse) => {
            if (request.action === "transcriptFromTranslate") {
                if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();

                const userAnswer = (request.transcript || "").trim();
                if (userAnswer) {
                    scoreAnswer(userAnswer, originalText);
                } else {
                    hint.textContent = 'Lỗi: Chưa nhận được chữ. Bạn đã bấm Mic bên trang Dịch chưa?';
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

    } catch (err) {
        alert("Không thể truy cập micro. Vui lòng cấp quyền.");
    }
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
            return `<span style="color:green; font-weight:bold;">${word}</span>`;
        } else {
            return `<span style="color:red; text-decoration: line-through;">${word}</span>`;
        }
    }).join(' ');

    const score = modelWords.length > 0 ? (correctWordCount / modelWords.length) * 100 : 0;
    const roundedScore = Math.round(score);

    const scoreDiv = document.createElement('div');
    scoreDiv.innerHTML = `
        Điểm: <b>${roundedScore}%</b><br>
        ${resultHTML}<br>
        <i>Bạn nói: ${userAnswer}</i>
    `;
    
    const hintDiv = widget.querySelector('#extension-hint');
    hintDiv.textContent = ''; // Xóa chữ đang ghi âm
    widget.querySelector('#extension-score-display').prepend(scoreDiv);

    // Kích hoạt âm thanh đánh giá (Đã được unlock từ lúc chạm tay)
    if (roundedScore >= 80) {
        if(correctAudioObj) {
            correctAudioObj.currentTime = 0;
            correctAudioObj.play().catch(e => console.log(e));
        }
    } else {
        if(wrongAudioObj) {
            wrongAudioObj.currentTime = 0;
            wrongAudioObj.play().catch(e => console.log(e));
        }
    }
}
