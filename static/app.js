const displayState = {
    IDLE: 'Idle',
    NUMBER_ENTERED: 'Number entered',
    CONNECTING: 'Connecting',
    READY_TO_LISTEN: 'Ready to listen',
    LISTENING: 'Listening',
    PROCESSING: 'Processing',
    RESPONDING: 'Responding',
    ERROR: 'Error'
};

let currentState = displayState.IDLE;
let inputDigits = "";
let mediaRecorder;
let audioChunks = [];

const displayText = document.getElementById("display-text");
const debugState = document.getElementById("debug-state");
const aiIndicator = document.getElementById("ai-indicator");
const transcriptArea = document.getElementById("transcript-area");
const responseArea = document.getElementById("response-area");
const btnSoftLeft = document.getElementById("btn-soft-left");

// Helper structure to map the text to UI based on states
function updateState(newState, message = "") {
    currentState = newState;
    debugState.innerText = newState;
    
    // Clear display if idle
    if (newState === displayState.IDLE) {
        inputDigits = "";
        displayText.innerText = "Enter number...";
        aiIndicator.style.display = "none";
        transcriptArea.style.display = "none";
        responseArea.style.display = "none";
        transcriptArea.innerText = "";
        responseArea.innerText = "";
        btnSoftLeft.onclick = null;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
    } else if (newState === displayState.NUMBER_ENTERED) {
        displayText.innerText = inputDigits;
    } else if (message) {
        displayText.innerText = message;
    }
}

// Keypad logic for dialing
document.querySelectorAll(".keypad-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        if (currentState === displayState.IDLE || currentState === displayState.NUMBER_ENTERED || currentState === displayState.ERROR) {
            inputDigits += btn.getAttribute("data-key");
            updateState(displayState.NUMBER_ENTERED);
        }
    });
});

const endCall = () => {
    updateState(displayState.IDLE);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    fetch('/api/reset', { method: 'POST' }).catch(console.error);
};

document.getElementById("btn-end").addEventListener("click", endCall);
document.getElementById("btn-soft-right").addEventListener("click", endCall); // typical Back/Clear usage

document.getElementById("btn-call").addEventListener("click", async () => {
    if (currentState === displayState.NUMBER_ENTERED) {
        updateState(displayState.CONNECTING, "Calling...");
        try {
            const res = await fetch("/api/dial", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ digits: inputDigits })
            });
            const data = await res.json();
            
            if (res.ok && data.status === "success") {
                aiIndicator.style.display = "inline";
                updateState(displayState.READY_TO_LISTEN, "Connected!\nPress Soft Left to speak.");
                // Change soft left button to act as push to talk triggering listening state
                btnSoftLeft.onclick = startListening;
            } else {
                updateState(displayState.ERROR, data.message || "Invalid code");
                setTimeout(() => updateState(displayState.IDLE), 3000);
            }
        } catch (error) {
            updateState(displayState.ERROR, "Network error");
            setTimeout(() => updateState(displayState.IDLE), 3000);
        }
    }
});

async function startListening() {
    transcriptArea.style.display = "none";
    responseArea.style.display = "none";
    updateState(displayState.LISTENING, "Listening...\nSpeak now.\nPress Soft Left again to stop.");
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.addEventListener('dataavailable', event => {
            audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener('stop', async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            stream.getTracks().forEach(track => track.stop());
            await sendAudioToBackend(audioBlob);
        });

        mediaRecorder.start();
        
        // Let Soft Left stop listening when pressed again
        btnSoftLeft.onclick = stopListening;
    } catch (err) {
        console.error(err);
        updateState(displayState.ERROR, "Mic access denied");
        setTimeout(() => updateState(displayState.READY_TO_LISTEN, "Press Soft Left to speak."), 3000);
    }
}

function stopListening() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        btnSoftLeft.onclick = null; // Prevent multi-clicks until processed
    }
}

async function sendAudioToBackend(audioBlob) {
    updateState(displayState.PROCESSING, "Processing...");
    
    const formData = new FormData();
    formData.append('audio', audioBlob, 'record.webm');
    
    try {
        const res = await fetch("/api/ask", {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        
        if (res.ok) {
            updateState(displayState.RESPONDING, "");
            displayText.innerText = "";
            
            transcriptArea.style.display = "block";
            transcriptArea.innerText = `You: ${data.transcript}`;
            
            responseArea.style.display = "block";
            responseArea.innerText = `AI: ${data.response}`;
            
            // Speak fallback if no audio_url was provided by the backend from Sarvam
            if (data.audio_url) {
                const audio = new Audio(data.audio_url);
                try {
                    await audio.play();
                    audio.onended = () => {
                        updateState(displayState.READY_TO_LISTEN, "Press soft left to reply");
                        btnSoftLeft.onclick = startListening;
                    };
                } catch(e) {
                    console.error("Audio block playback failed", e);
                    readTextWithBrowser(data.response);
                }
            } else {
                readTextWithBrowser(data.response);
            }
        } else {
            updateState(displayState.ERROR, data.message || "Failed");
            setTimeout(() => updateState(displayState.READY_TO_LISTEN, "Press Soft Left to try again."), 4000);
        }
    } catch (error) {
        console.error(error);
        updateState(displayState.ERROR, "Error contacting AI Server");
        setTimeout(() => updateState(displayState.READY_TO_LISTEN, "Press Soft Left to try again."), 4000);
    }
}

function readTextWithBrowser(text) {
    if (!window.speechSynthesis) {
        console.warn("speechSynthesis not supported on this browser context");
        updateState(displayState.READY_TO_LISTEN, "Press Soft Left to reply.");
        btnSoftLeft.onclick = startListening;
        return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => {
        updateState(displayState.READY_TO_LISTEN, "Done.\nPress Soft Left to reply.");
        btnSoftLeft.onclick = startListening;
    };
    utterance.onerror = () => {
        updateState(displayState.READY_TO_LISTEN, "Done.\nPress Soft Left to reply.");
        btnSoftLeft.onclick = startListening;
    };
    window.speechSynthesis.speak(utterance);
}
