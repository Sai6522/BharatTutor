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

// TTS voice mapping per language (updated speaker names)
const TTS_VOICES = {
  "en-IN": "anushka",
  "hi-IN": "anushka",
  "bn-IN": "anushka",
  "te-IN": "anushka",
  "ta-IN": "anushka",
  "mr-IN": "anushka",
  "gu-IN": "anushka",
  "kn-IN": "anushka",
  "ml-IN": "anushka",
  "pa-IN": "anushka",
  "od-IN": "anushka",
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
        model: "sarvam-30b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        max_tokens: 600,
        temperature: 0.7,
      },
      {
        headers: {
          "api-subscription-key": SARVAM_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const msg = chatResponse.data.choices[0].message;
    // sarvam-30b is a reasoning model — answer is in content or reasoning_content
    let rawText = msg.content || msg.reasoning_content || "";
    let answerText = extractAnswer(rawText);

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
          model: "bulbul:v2",
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

/**
 * Reasoning models return step-by-step thinking. Extract just the final answer.
 * We look for a "Final Answer" / "Answer:" section, or fall back to the last
 * non-empty paragraph that doesn't look like a reasoning step header.
 */
function extractAnswer(text) {
  if (!text) return "";

  // Try to find an explicit final answer section
  const finalMatch = text.match(/(?:final answer|answer|conclusion)[:\s*\n]+(.+)/is);
  if (finalMatch) {
    return finalMatch[1].trim().split("\n\n")[0].trim();
  }

  // Split into paragraphs, skip bullet-point reasoning steps, take last good paragraph
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const p = paragraphs[i];
    // Skip meta-reasoning lines like "* **Analyze...**"
    if (/^\s*[\*\-]\s*\*\*/.test(p)) continue;
    if (p.length > 30) return p;
  }

  // Last resort: return the whole text trimmed
  return text.trim();
}

function buildSystemPrompt(langName, subject) {
  return `You are BharatTutor, an expert AI tutor for Indian students (Class 1–12 and beyond).

IMPORTANT: Give ONLY the final answer. Do NOT show reasoning steps or analysis. Just the explanation.

Your answer will be translated to ${langName}, so write clear simple English.

Rules:
- 3 to 6 sentences max for simple questions
- Use Indian examples (rupees, festivals, Indian geography/history)
- For math: show numbered steps clearly
- End with one encouraging sentence
- Subject: ${subject !== "general" ? subject : "any subject"}`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎓 BharatTutor running at http://localhost:${PORT}`);
  console.log(`🔑 API Key configured: ${!!SARVAM_API_KEY}`);
  console.log(`\nSupported languages: English, Hindi, Bengali, Telugu, Tamil, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia\n`);
});
