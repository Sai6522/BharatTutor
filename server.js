require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const SARVAM_BASE_URL = "https://api.sarvam.ai";

// Language code mapping for Sarvam AI
const LANGUAGE_CODES = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
  te: "te-IN",
  ta: "ta-IN",
  mr: "mr-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  od: "od-IN",
};

const LANGUAGE_NAMES = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  te: "Telugu",
  ta: "Tamil",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  od: "Odia",
};

// TTS voice mapping per language
const TTS_VOICES = {
  "en-IN": "meera",
  "hi-IN": "meera",
  "bn-IN": "meera",
  "te-IN": "meera",
  "ta-IN": "meera",
  "mr-IN": "meera",
  "gu-IN": "meera",
  "kn-IN": "meera",
  "ml-IN": "meera",
  "pa-IN": "meera",
  "od-IN": "meera",
};

/**
 * POST /api/ask
 * Main endpoint: takes a question + language, returns answer text + audio
 */
app.post("/api/ask", async (req, res) => {
  const { question, language = "hi", subject = "general" } = req.body;

  if (!question || question.trim() === "") {
    return res.status(400).json({ error: "Question is required" });
  }

  if (!SARVAM_API_KEY) {
    return res.status(500).json({ error: "Sarvam API key not configured. Please set SARVAM_API_KEY in .env" });
  }

  const langCode = LANGUAGE_CODES[language] || "hi-IN";
  const langName = LANGUAGE_NAMES[language] || "Hindi";

  try {
    // Step 1: Get AI answer using Sarvam Chat Completion
    const systemPrompt = buildSystemPrompt(langName, subject);

    const chatResponse = await axios.post(
      `${SARVAM_BASE_URL}/v1/chat/completions`,
      {
        model: "sarvam-m",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        max_tokens: 500,
        temperature: 0.7,
      },
      {
        headers: {
          "api-subscription-key": SARVAM_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    let answerText = chatResponse.data.choices[0].message.content;

    // Step 2: Translate answer if not English (Sarvam chat may respond in English)
    let translatedText = answerText;
    if (language !== "en") {
      try {
        const translateResponse = await axios.post(
          `${SARVAM_BASE_URL}/translate`,
          {
            input: answerText,
            source_language_code: "en-IN",
            target_language_code: langCode,
            speaker_gender: "Female",
            mode: "formal",
            model: "mayura:v1",
            enable_preprocessing: false,
          },
          {
            headers: {
              "api-subscription-key": SARVAM_API_KEY,
              "Content-Type": "application/json",
            },
          }
        );
        translatedText = translateResponse.data.translated_text || answerText;
      } catch (translateErr) {
        console.warn("Translation failed, using original:", translateErr.message);
        translatedText = answerText;
      }
    }

    // Step 3: Convert translated text to speech
    let audioBase64 = null;
    try {
      // Sarvam TTS has a 500 char limit per request; chunk if needed
      const textForTTS = translatedText.length > 500 ? translatedText.substring(0, 490) + "..." : translatedText;

      const ttsResponse = await axios.post(
        `${SARVAM_BASE_URL}/text-to-speech`,
        {
          inputs: [textForTTS],
          target_language_code: langCode,
          speaker: TTS_VOICES[langCode] || "meera",
          pitch: 0,
          pace: 1.0,
          loudness: 1.5,
          speech_sample_rate: 8000,
          enable_preprocessing: true,
          model: "bulbul:v1",
        },
        {
          headers: {
            "api-subscription-key": SARVAM_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      if (ttsResponse.data.audios && ttsResponse.data.audios.length > 0) {
        audioBase64 = ttsResponse.data.audios[0];
      }
    } catch (ttsErr) {
      console.warn("TTS failed:", ttsErr.message);
    }

    return res.json({
      question,
      answer: translatedText,
      answerEnglish: answerText,
      language,
      langCode,
      audio: audioBase64,
      subject,
    });
  } catch (err) {
    console.error("Error calling Sarvam API:", err.response?.data || err.message);
    return res.status(500).json({
      error: "Failed to get answer from Sarvam AI",
      details: err.response?.data?.message || err.message,
    });
  }
});

/**
 * POST /api/translate
 * Standalone translation endpoint
 */
app.post("/api/translate", async (req, res) => {
  const { text, targetLang } = req.body;

  if (!text || !targetLang) {
    return res.status(400).json({ error: "text and targetLang are required" });
  }

  if (!SARVAM_API_KEY) {
    return res.status(500).json({ error: "Sarvam API key not configured" });
  }

  const langCode = LANGUAGE_CODES[targetLang] || "hi-IN";

  try {
    const response = await axios.post(
      `${SARVAM_BASE_URL}/translate`,
      {
        input: text,
        source_language_code: "en-IN",
        target_language_code: langCode,
        speaker_gender: "Female",
        mode: "formal",
        model: "mayura:v1",
        enable_preprocessing: false,
      },
      {
        headers: {
          "api-subscription-key": SARVAM_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    return res.json({ translated: response.data.translated_text });
  } catch (err) {
    return res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    apiKeyConfigured: !!SARVAM_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function buildSystemPrompt(langName, subject) {
  return `You are BharatTutor, an expert AI tutor specializing in Indian education. 
You help students from Class 1 to Class 12 and beyond understand concepts clearly.

Your response language will be translated to ${langName}, so write clear, simple English that translates well.

Guidelines:
- Be encouraging, patient, and supportive like a good Indian teacher
- Break down complex concepts into simple steps
- Use Indian examples and contexts (Indian currency, festivals, geography, history)
- Keep answers concise but complete (3-6 sentences for simple questions, more for complex ones)
- If it's a math problem, show the steps clearly
- If it's science, use relatable Indian examples
- Always end with a motivating sentence
- Subject focus: ${subject !== "general" ? subject : "any subject the student needs help with"}

Remember: You are helping Indian students learn better in their own language. Be warm and encouraging!`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎓 BharatTutor running at http://localhost:${PORT}`);
  console.log(`🔑 API Key configured: ${!!SARVAM_API_KEY}`);
  console.log(`\nSupported languages: English, Hindi, Bengali, Telugu, Tamil, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia\n`);
});
