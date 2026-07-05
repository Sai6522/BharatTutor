/* ─── BharatTutor Frontend App ───────────────────────────── */

const LANG_NAMES = {
  en: "English", hi: "Hindi", bn: "Bengali", te: "Telugu",
  ta: "Tamil",  mr: "Marathi", gu: "Gujarati", kn: "Kannada",
  ml: "Malayalam", pa: "Punjabi", od: "Odia",
};

let selectedLang = "hi";
let history = JSON.parse(localStorage.getItem("bt_history") || "[]");
let currentAudio = null;
let isPlaying = false;

// ─── DOM refs ───────────────────────────────────────────────
const langGrid       = document.getElementById("langGrid");
const langNameDisplay= document.getElementById("langNameDisplay");
const subjectSelect  = document.getElementById("subjectSelect");
const questionInput  = document.getElementById("questionInput");
const charCount      = document.getElementById("charCount");
const askBtn         = document.getElementById("askBtn");
const loadingCard    = document.getElementById("loadingCard");
const loadingSubtext = document.getElementById("loadingSubtext");
const answerCard     = document.getElementById("answerCard");
const answerMeta     = document.getElementById("answerMeta");
const answerText     = document.getElementById("answerText");
const answerEnglish  = document.getElementById("answerEnglish");
const englishToggle  = document.getElementById("englishToggle");
const englishText    = document.getElementById("englishText");
const audioBtn       = document.getElementById("audioBtn");
const audioBtnIcon   = document.getElementById("audioBtnIcon");
const audioBtnText   = document.getElementById("audioBtnText");
const copyBtn        = document.getElementById("copyBtn");
const audioPlayer    = document.getElementById("audioPlayer");
const historySection = document.getElementById("historySection");
const historyList    = document.getElementById("historyList");
const clearBtn       = document.getElementById("clearBtn");

// ─── Language selection ──────────────────────────────────────
langGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".lang-btn");
  if (!btn) return;
  selectedLang = btn.dataset.lang;
  document.querySelectorAll(".lang-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  langNameDisplay.textContent = LANG_NAMES[selectedLang] || selectedLang;
});

// ─── Character counter ───────────────────────────────────────
questionInput.addEventListener("input", () => {
  const len = questionInput.value.length;
  charCount.textContent = `${len} / 500`;
  charCount.style.color = len > 450 ? "#E53E3E" : "";
  if (len > 500) questionInput.value = questionInput.value.substring(0, 500);
});

// ─── Quick questions ─────────────────────────────────────────
document.querySelectorAll(".quick-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    questionInput.value = btn.dataset.q;
    charCount.textContent = `${btn.dataset.q.length} / 500`;
    questionInput.focus();
  });
});

// ─── Ask button ──────────────────────────────────────────────
askBtn.addEventListener("click", askQuestion);

questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) askQuestion();
});

async function askQuestion() {
  const question = questionInput.value.trim();
  if (!question) {
    questionInput.focus();
    questionInput.style.outline = "2px solid #E53E3E";
    setTimeout(() => { questionInput.style.outline = ""; }, 1500);
    return;
  }

  const subject = subjectSelect.value;

  // Show loading, hide previous answer
  setLoading(true);
  answerCard.style.display = "none";
  stopAudio();

  const loadingMessages = [
    "Getting the best answer for you 🙏",
    "Searching through knowledge 📚",
    "Preparing your personalized answer ✨",
    "Almost there! Translating for you 🌐",
  ];
  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    loadingSubtext.textContent = loadingMessages[++msgIdx % loadingMessages.length];
  }, 1800);

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, language: selectedLang, subject }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.details || "Server error");
    }

    displayAnswer(data);
    addToHistory(question, selectedLang, subject);

  } catch (err) {
    showError(err.message);
  } finally {
    clearInterval(msgInterval);
    setLoading(false);
  }
}

// ─── Display answer ──────────────────────────────────────────
function displayAnswer(data) {
  const { answer, answerEnglish: engText, language, langCode, audio, subject } = data;

  answerMeta.textContent = `${LANG_NAMES[language] || language} · ${capitalise(subject || "General")}`;
  answerText.textContent = answer;

  // English version toggle (only if not English)
  if (language !== "en" && engText && engText !== answer) {
    answerEnglish.style.display = "block";
    englishText.textContent = engText;
    englishText.style.display = "none";
    englishToggle.textContent = "Show English version ▾";
  } else {
    answerEnglish.style.display = "none";
  }

  // Audio
  if (audio) {
    setupAudio(audio);
    audioBtn.style.display = "flex";
  } else {
    audioBtn.style.display = "none";
  }

  answerCard.style.display = "block";
  answerCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ─── Audio playback ──────────────────────────────────────────
function setupAudio(base64Audio) {
  stopAudio();
  const blob = base64ToBlob(base64Audio, "audio/wav");
  const url = URL.createObjectURL(blob);
  audioPlayer.src = url;
  currentAudio = url;

  audioPlayer.onended = () => setAudioState(false);
  audioPlayer.onerror = () => {
    setAudioState(false);
    audioBtn.style.display = "none";
  };
}

audioBtn.addEventListener("click", () => {
  if (isPlaying) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    setAudioState(false);
  } else {
    audioPlayer.play();
    setAudioState(true);
  }
});

function setAudioState(playing) {
  isPlaying = playing;
  audioBtnIcon.textContent = playing ? "⏹" : "🔊";
  audioBtnText.textContent = playing ? "Stop" : "Listen";
  audioBtn.classList.toggle("playing", playing);
}

function stopAudio() {
  if (audioPlayer.src) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  }
  setAudioState(false);
  if (currentAudio) { URL.revokeObjectURL(currentAudio); currentAudio = null; }
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

// ─── English toggle ──────────────────────────────────────────
englishToggle.addEventListener("click", () => {
  const isOpen = englishText.style.display !== "none";
  englishText.style.display = isOpen ? "none" : "block";
  englishToggle.textContent = isOpen ? "Show English version ▾" : "Hide English version ▴";
});

// ─── Copy answer ─────────────────────────────────────────────
copyBtn.addEventListener("click", async () => {
  const text = answerText.textContent;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "✅ Copied!";
    setTimeout(() => { copyBtn.innerHTML = "📋 Copy"; }, 2000);
  } catch {
    copyBtn.textContent = "❌ Failed";
    setTimeout(() => { copyBtn.innerHTML = "📋 Copy"; }, 2000);
  }
});

// ─── History ─────────────────────────────────────────────────
function addToHistory(question, lang, subject) {
  history.unshift({ question, lang, subject, ts: Date.now() });
  if (history.length > 10) history = history.slice(0, 10);
  localStorage.setItem("bt_history", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  if (history.length === 0) {
    historySection.style.display = "none";
    return;
  }
  historySection.style.display = "block";
  historyList.innerHTML = "";
  history.forEach(item => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <span class="history-q">${escapeHtml(item.question)}</span>
      <span class="history-lang">${(LANG_NAMES[item.lang] || item.lang).substring(0, 3)}</span>
    `;
    div.addEventListener("click", () => {
      questionInput.value = item.question;
      charCount.textContent = `${item.question.length} / 500`;
      // Set language
      selectedLang = item.lang;
      document.querySelectorAll(".lang-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.lang === item.lang);
      });
      langNameDisplay.textContent = LANG_NAMES[item.lang] || item.lang;
      // Set subject
      subjectSelect.value = item.subject || "general";
      questionInput.scrollIntoView({ behavior: "smooth" });
    });
    historyList.appendChild(div);
  });
}

clearBtn.addEventListener("click", () => {
  history = [];
  localStorage.removeItem("bt_history");
  renderHistory();
});

// ─── Loading state ────────────────────────────────────────────
function setLoading(on) {
  loadingCard.style.display = on ? "flex" : "none";
  askBtn.disabled = on;
  if (on) {
    loadingSubtext.textContent = "Getting the best answer for you 🙏";
    loadingCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// ─── Error display ────────────────────────────────────────────
function showError(message) {
  answerMeta.textContent = "Error";
  answerText.textContent = `⚠️ ${message}\n\nPlease check your API key in the .env file and try again.`;
  answerEnglish.style.display = "none";
  audioBtn.style.display = "none";
  answerCard.style.display = "block";
  answerCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ─── Helpers ──────────────────────────────────────────────────
function capitalise(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ""; }

function escapeHtml(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

// ─── Init ─────────────────────────────────────────────────────
renderHistory();
