# Nokia Retro Sarvam AI Integration (POC)

This is a complete proof-of-concept integrating a web-based retro Nokia-style UI with a Python Flask backend that connects to Sarvam AI.

## 1. Architecture Summary
A lightweight **Flask backend** serves static HTML/CSS/JS simulating a Nokia phone interface. The frontend captures audio via the `MediaRecorder` API and sends `multipart/form-data` containing the WebM blob to the backend. 
The backend handles routing securely, contacting Sarvam AI natively without exposing secrets to the frontend.

## 2. Chosen Technical Approach and why
**Hybrid mode with browser recording -> audio to Python Backend.**
- **Why**: Pure browser-based STT (SpeechRecognition) is inconsistent across mobile browsers (e.g. Safari does not fully support it). Capturing an audio blob via vanilla JS allows universal recording capabilities natively inside mobile browsers. This audio is transmitted to the Backend, which can securely access standard Sarvam Speech APIs (using API keys) bypassing frontend CORS problems.

## 3. Prerequisites
- Python 3.9+
- A modern mobile browser supporting Web Audio (Safari on iOS, Chrome on Android).
- A Sarvam AI Developer Core Key (Or use `USE_MOCK_SARVAM=true`).
- `pip` or virtualenv.

## 4. Project Folder Structure
```text
nokia-poc/
├── app.py                  # Main Flask app routing & Sarvam integrations
├── requirements.txt        # Backend dependencies
├── .env.example            # Environment variables placeholder
├── README.md               # Setup Guide
├── static/
│   ├── app.js              # Speech Recording & key logic
│   └── style.css           # Styling Nokia UI layout
└── templates/
    └── index.html          # Nokia DOM structure
```

## 5. Verify these against latest Sarvam documentation before running
If updating to actual Sarvam AI:
- [ ] **Exact Base URL**: Verify `https://api.sarvam.ai/` or specific versions.
- [ ] **Auth header**: Verify if it requires `Bearer <TOKEN>` or `x-api-key`.
- [ ] **Chat endpoint**: Ensure `https://api.sarvam.ai/chat/completions` exists.
- [ ] **STT endpoint**: Determine specific file upload structure `(files={"file": (name, bytes, type)})`.
- [ ] **Models**: Does `sarvam-1` exist? Check documentation.

### Where to update the code
- `.env` file - To override exact endpoints or keys.
- `app.py - ask()` Route - Modify `chat_payload` parameters depending on Sarvam Schema!
- `app.py - ask()` Route - Modify TTS/Audio fetching depending on URL retrieval method.

## 6. Step-by-step local setup on macOS
*These are bash environments suited generally across UNIX systems like macOS.*
```bash
# 1. Navigate to your project folder
cd krishimanthan/nokia-poc

# 2. Create the Python virtual environment
python3 -m venv venv

# 3. Activate the virtual environment
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Create your .env
cp .env.example .env
# Edit .env with your favorite editor natively (nano .env)
# 6. Run the App
python app.py
```

## 7. How to access from mobile on same network
The app automatically runs locally at `http://0.0.0.0:5000` (LAN visible).
1. **Find your Local Mac IPv4 Address**: 
   Open macOS Terminal -> run `ipconfig getifaddr en0`. (E.g. `192.168.1.13`).
   On Windows via WSL or Command Prompt -> `ipconfig`.
2. Connect your mobile phone to the **same Wi-Fi**.
3. In your mobile browser, open: `http://192.168.1.13:5000`
4. *Important limitations for Web Audio*: Modern Mobile browsers block `MediaRecorder` or microphone APIs on non-HTTPS origins unless it’s precisely `localhost`. You MUST whitelist your IPv4 internally, or temporarily tunnel using `ngrok http 5000` to get an HTTPS domain.

## 8. Sarvam API integration steps
To make it real, turn off MOCK mode in your `.env`. The backend uses standard Python `requests` modules to push the WebM blobs directly into the STT endpoint. It consumes the text into the ChatCompletion engine and proxies returning responses.

## 9. How the speech input flow works
1. **Dial `839`** -> Press Green Call Button
2. **Press Soft-Left to Speak**: Mobile queries microphone permission. JS records as WebM Blob.
3. **Press Soft-Left to Stop**: Sends Blob to Flask -> `POST /api/ask`.
4. Flask responds with text/audio -> Screen UI updates the DOM, native speech synthesis reads results aloud.

## 10. Troubleshooting
- **Mic Permission Denied**: Because you're accessing HTTP on IP, Mobile browser blocks it. Solution: Use `localhost` locally OR spin an `ngrok` tunnel for testing (`ngrok http 5000`).
- **Invalid Service Code**: Ensure you dialed exactly `839`.

## 11. Future enhancements
- Implement WebSocket streaming for low-latency Realtime audio streaming instead of HTTP batch polling.
- Custom Web Audio Oscillators mapping Keypad tones (DTMF).
