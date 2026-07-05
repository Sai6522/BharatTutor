# 🎓 BharatTutor — AI Tutor for India

### 🌐 Live Demo: [https://bharat-tutor.onrender.com](https://bharat-tutor.onrender.com)

An AI-powered multilingual tutor that explains educational concepts in 11 Indian languages using **Sarvam AI**.

## ✨ Features

- **11 Indian languages** — Hindi, Bengali, Telugu, Tamil, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia + English
- **Voice answers** — Text-to-Speech using Sarvam AI's Bulbul model
- **Smart translation** — Answers translated via Sarvam Mayura model
- **Subject filters** — Maths, Science, History, Geography, CS, and more
- **Question history** — Recent questions saved locally
- **Indian context** — Tutor uses Indian examples and exam-style explanations

## 🛠 Tech Stack

- **Backend**: Node.js + Express
- **AI**: Sarvam AI (Chat Completion + Translation + TTS)
- **Frontend**: Vanilla HTML/CSS/JS (no framework needed)

## 🚀 Setup

### 1. Install dependencies
```bash
cd BharatTutor
npm install
```

### 2. Configure API key
```bash
cp .env.example .env
# Edit .env and add your Sarvam API key
```

Get your key at: https://dashboard.sarvam.ai/

### 3. Run
```bash
npm start
```

Open http://localhost:3000

## 🌐 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ask` | Ask a question, get answer + audio |
| POST | `/api/translate` | Translate text to target language |
| GET | `/api/health` | Health check |

### Example request
```json
POST /api/ask
{
  "question": "What is photosynthesis?",
  "language": "hi",
  "subject": "science"
}
```

### Example response
```json
{
  "question": "What is photosynthesis?",
  "answer": "प्रकाश संश्लेषण वह प्रक्रिया है...",
  "answerEnglish": "Photosynthesis is the process...",
  "language": "hi",
  "audio": "<base64-encoded-wav>"
}
```

## 🌍 Supported Languages

| Code | Language |
|------|----------|
| en | English |
| hi | Hindi |
| bn | Bengali |
| te | Telugu |
| ta | Tamil |
| mr | Marathi |
| gu | Gujarati |
| kn | Kannada |
| ml | Malayalam |
| pa | Punjabi |
| od | Odia |

## 🏆 Hackathon

Built for the **Sarvam Track** — "Build AI Applications with Sarvam AI"

Theme: **🎓 Learning & Knowledge Systems**
