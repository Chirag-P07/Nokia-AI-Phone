from encodings.punycode import digits
import os
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
import requests
import json
from datetime import datetime

load_dotenv()

app = Flask(__name__)

USE_MOCK_SARVAM = os.getenv("USE_MOCK_SARVAM", "true").lower() == "true"
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_CHAT_ENDPOINT = os.getenv("SARVAM_CHAT_ENDPOINT", "https://api.sarvam.ai/chat/completions")
SARVAM_STT_ENDPOINT = os.getenv("SARVAM_STT_ENDPOINT", "https://api.sarvam.ai/speech-to-text")
SARVAM_TTS_ENDPOINT = os.getenv("SARVAM_TTS_ENDPOINT", "https://api.sarvam.ai/text-to-speech")
SARVAM_MODEL_NAME = os.getenv("SARVAM_MODEL_NAME", "sarvam-1")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/dial", methods=["POST"])
def dial():
    data = request.json
    digits = data.get("digits", "")
    # Accept any number and connect to AI
    return jsonify({
    "status": "success",
    "message": f"You entered: {digits}. Ready to talk to AI."
})

@app.route("/api/ask", methods=["POST"])
def ask():
    # Expecting audio file in the request
    if 'audio' not in request.files:
        return jsonify({"status": "error", "message": "No audio file provided"}), 400
    
    audio_file = request.files['audio']
    
    if USE_MOCK_SARVAM:
        return jsonify({
            "status": "success",
            "transcript": "Hello, this is a mock transcript demonstrating the POC.",
            "response": "This is a mock response from the Sarvam AI proxy running locally.",
            "audio_url": None # Optionally mock voice URL if available, falling back to browser TTS
        })
    else:
        # 1. Transcribe (STT)
        headers = {"Authorization": f"Bearer {SARVAM_API_KEY}"}
        # Be aware: this file key 'file' must match Sarvam's expected field name
        files = {"file": (audio_file.filename, audio_file.read(), audio_file.content_type)}
        try:
            stt_res = requests.post(SARVAM_STT_ENDPOINT, headers=headers, files=files)
            if not stt_res.ok:
                return jsonify({"status": "error", "message": "STT failed", "details": stt_res.text}), 500
            stt_data = stt_res.json()
            transcript = stt_data.get("transcript", "")
            
            # 2. Chat completion
            chat_payload = {
                "model": SARVAM_MODEL_NAME,
                "messages": [{"role": "user", "content": transcript}]
            }
            chat_res = requests.post(SARVAM_CHAT_ENDPOINT, headers=headers, json=chat_payload)
            if not chat_res.ok:
                return jsonify({"status": "error", "message": "Chat failed", "details": chat_res.text}), 500
            chat_data = chat_res.json()
            response_text = chat_data["choices"][0]["message"]["content"]
            
            # 3. TTS (Text to Speech) - Optional depending on Sarvam API implementation
            # Returning text, UI will use Browser Speech API as fallback if TTS fails or audio_url is None
            
            # Backend Storage: Save to a JSON file
            record = {
                "timestamp": datetime.now().isoformat(),
                "user_text": transcript,
                "ai_response": response_text
            }
            # Open history file normally, or create it if missing
            history_file = "conversation_history.json"
            try:
                with open(history_file, "r") as f:
                    history = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                history = []
                
            history.append(record)
            
            with open(history_file, "w") as f:
                json.dump(history, f, indent=4)
            
            return jsonify({
                "status": "success",
                "transcript": transcript,
                "response": response_text,
                "audio_url": None # Replace with actual logic to handle binary TTS blob and convert or hosted URL
            })
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/reset", methods=["POST"])
def reset():
    return jsonify({"status": "success"})

if __name__ == "__main__":
    # Binding to 0.0.0.0 allows LAN access (e.g., from mobile)
    app.run(host="0.0.0.0", port=5000, debug=True)
