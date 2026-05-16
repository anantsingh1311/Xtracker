import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchChatStatus, sendChatMessage } from "../services/api";
import { clearStoredUser, getAuthChangeEventName, getStoredUser, mergeStoredUser } from "../utils/auth";
import BodyMusclePicker from "./BodyMusclePicker";

const CHATBOT_MINIMIZED_KEY = "xt_chatbot_minimized";
const CHATBOT_STORAGE_PREFIX = "xt_chatbot_messages_v1:";
const CHATBOT_LAST_USER_KEY = "xt_chatbot_last_user_id";
const CHATBOT_MESSAGE_MAX_LENGTH = Number(process.env.REACT_APP_CHATBOT_MESSAGE_MAX_LENGTH) || 1800;
const CHATBOT_IMAGE_MAX_BYTES = Number(process.env.REACT_APP_CHATBOT_IMAGE_MAX_BYTES) || 4 * 1024 * 1024;
const CHATBOT_PERSISTED_MESSAGE_LIMIT = 50;
const SHAKY_LOGO_SRC = `${process.env.PUBLIC_URL || ""}/shaky-logo.png`;
const QUICK_PROMPTS = [
  "Build me a workout plan",
  "Create a simple diet plan",
  "Help me recover better",
  "How do I use XTracker?"
];
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BODY_IMAGE_ANALYSIS_PROMPT = "Analyze the uploaded body photo for visible fitness context only. Give me a cautious body-composition summary, posture or muscle-balance observations, a practical workout plan, a diet plan, a recovery plan, and any XTracker profile updates I should consider. Do not diagnose medical conditions or claim exact body-fat percentage.";
// const MUSCLE_PROMPTS =[
//   ["chest", "Chest"],
//   ["back", "Back"],
//   ["shoulders", "Shoulders"],
//   ["biceps", "Biceps"],
//   ["triceps", "Triceps"],
//   ["legs", "Legs"],
//   ["abs", "Abs"],
//   ["glutes", "Glutes"]

// ]

function readInitialMinimizedState() {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const savedPreference = window.localStorage.getItem(CHATBOT_MINIMIZED_KEY);
    return savedPreference === null ? true : savedPreference === "true";
  } catch (error) {
    return true;
  }
}

function getChatStorageKey(userId) {
  return userId ? `${CHATBOT_STORAGE_PREFIX}${userId}` : "";
}

function readStoredChatMessages(userId) {
  if (typeof window === "undefined" || !userId) {
    return [];
  }

  try {
    const rawMessages = window.localStorage.getItem(getChatStorageKey(userId));
    const parsedMessages = rawMessages ? JSON.parse(rawMessages) : [];

    return Array.isArray(parsedMessages)
      ? parsedMessages
          .filter((message) => ["assistant", "user"].includes(message?.role) && typeof message?.text === "string" && message.text.trim())
          .map((message) => ({
            role: message.role,
            text: message.text.trim().slice(0, 6000)
          }))
          .slice(-CHATBOT_PERSISTED_MESSAGE_LIMIT)
      : [];
  } catch (error) {
    return [];
  }
}

function writeStoredChatMessages(userId, messages) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  try {
    const safeMessages = Array.isArray(messages)
      ? messages
          .filter((message) => ["assistant", "user"].includes(message?.role) && typeof message?.text === "string" && message.text.trim())
          .map((message) => ({
            role: message.role,
            text: message.text.trim().slice(0, 6000)
          }))
          .slice(-CHATBOT_PERSISTED_MESSAGE_LIMIT)
      : [];

    window.localStorage.setItem(getChatStorageKey(userId), JSON.stringify(safeMessages));
  } catch (error) {
    // Ignore storage failures; chat still works without persistence.
  }
}

function rememberLastChatUser(userId) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  try {
    window.localStorage.setItem(CHATBOT_LAST_USER_KEY, userId);
  } catch (error) {
    // Ignore storage failures.
  }
}

function clearLastStoredChat() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const lastUserId = window.localStorage.getItem(CHATBOT_LAST_USER_KEY);

    if (lastUserId) {
      window.localStorage.removeItem(getChatStorageKey(lastUserId));
    }

    window.localStorage.removeItem(CHATBOT_LAST_USER_KEY);
  } catch (error) {
    // Ignore storage failures.
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read that image. Please try another photo."));
    reader.readAsDataURL(file);
  });
}

async function buildChatImagePayload(file) {
  if (!file) {
    throw new Error("Choose a photo first.");
  }

  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Please upload a JPG, PNG, or WebP photo.");
  }

  if (file.size > CHATBOT_IMAGE_MAX_BYTES) {
    const maxMb = Math.max(1, Math.floor(CHATBOT_IMAGE_MAX_BYTES / (1024 * 1024)));
    throw new Error(`Please upload a photo smaller than ${maxMb} MB.`);
  }

  const dataUrl = await readFileAsDataUrl(file);
  const base64Data = dataUrl.includes(",") ? dataUrl.split(",").pop() : "";

  if (!base64Data) {
    throw new Error("Unable to prepare that image. Please try another photo.");
  }

  return {
    data: base64Data,
    mimeType: file.type
  };
}

function ShakyLogo({ className = "h-full w-full", isThinking = false, size = "standard" }) {
  return (
    <span className={`shaky-avatar shaky-avatar--${size} ${isThinking ? "shaky-avatar--thinking" : "shaky-avatar--idle"}`}>
      <img
        alt="Shaky chatbot logo"
        className={`${className} shaky-avatar__image object-contain`}
        src={SHAKY_LOGO_SRC}
      />
      <span className="shaky-avatar__shine" />
      <span className="shaky-avatar__bubble shaky-avatar__bubble--one" />
      <span className="shaky-avatar__bubble shaky-avatar__bubble--two" />
    </span>
  );
}

function Chatbot() {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [messages, setMessages] = useState(() => readStoredChatMessages(getStoredUser()?.userId));
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [assistantMode, setAssistantMode] = useState("online");
  const [authNotice, setAuthNotice] = useState("");
  const [aiQuota, setAiQuota] = useState(() => currentUser?.aiQuota || null);
  const [fitnessProfile, setFitnessProfile] = useState(() => currentUser?.fitnessProfile || null);
  const [isMinimized, setIsMinimized] = useState(readInitialMinimizedState);
  const [selectedMuscle, setSelectedMuscle] = useState("");
  const [isMusclePickerOpen, setIsMusclePickerOpen] = useState(true);
  const [imageNotice, setImageNotice] = useState("");
  const scrollAnchorRef = useRef(null);
  const imageInputRef = useRef(null);
  const messagesUserIdRef = useRef(currentUser?.userId || "");
  const skipNextChatPersistRef = useRef(false);
  const currentUserId = currentUser?.userId;

  const handleMuscleSelect = async (muscle) => {
    setSelectedMuscle(muscle);

    await submitMessage(
      `I selected ${muscle} from the body map. Create a personalized workout for this muscle using my XTracker profile, fitness goal, body measurements, and recent workout history.`
    );
  };

  const applyChatStatus = useCallback((statusData) => {
    if (statusData?.model) {
      setAssistantMode(statusData.model);
    }

    if (statusData?.profile) {
      setFitnessProfile(statusData.profile);
    }

    if (statusData?.aiQuota) {
      setAiQuota(statusData.aiQuota);
      const storedQuota = getStoredUser()?.aiQuota;

      if (
        storedQuota?.monthlyTokenLimit !== statusData.aiQuota.monthlyTokenLimit ||
        storedQuota?.tokensUsedThisPeriod !== statusData.aiQuota.tokensUsedThisPeriod ||
        storedQuota?.remainingTokens !== statusData.aiQuota.remainingTokens
      ) {
        mergeStoredUser({ aiQuota: statusData.aiQuota });
      }
    }
  }, []);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(CHATBOT_MINIMIZED_KEY, String(isMinimized));
      } catch (error) {
        // Ignore storage failures; the chatbot still works without remembering this preference.
      }
    }
  }, [isMinimized]);

  useEffect(() => {
    if (!currentUserId) {
      clearLastStoredChat();
      messagesUserIdRef.current = "";
      skipNextChatPersistRef.current = true;
      setMessages([]);
      setSelectedMuscle("");
      setImageNotice("");
      return;
    }

    rememberLastChatUser(currentUserId);

    if (messagesUserIdRef.current !== currentUserId) {
      messagesUserIdRef.current = currentUserId;
      skipNextChatPersistRef.current = true;
      setMessages(readStoredChatMessages(currentUserId));
      setSelectedMuscle("");
      setImageNotice("");
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || messagesUserIdRef.current !== currentUserId) {
      return;
    }

    if (skipNextChatPersistRef.current) {
      skipNextChatPersistRef.current = false;
      return;
    }

    writeStoredChatMessages(currentUserId, messages);
  }, [currentUserId, messages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncCurrentUser = () => {
      const nextUser = getStoredUser();
      setCurrentUser(nextUser);
      setAiQuota(nextUser?.aiQuota || null);
      setFitnessProfile(nextUser?.fitnessProfile || null);

      if (nextUser) {
        setAuthNotice("");
      }
    };

    window.addEventListener("storage", syncCurrentUser);
    window.addEventListener(getAuthChangeEventName(), syncCurrentUser);

    return () => {
      window.removeEventListener("storage", syncCurrentUser);
      window.removeEventListener(getAuthChangeEventName(), syncCurrentUser);
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setMessages([]);
      setError("");
      setAssistantMode("online");
      setAiQuota(null);
      setFitnessProfile(null);
      return undefined;
    }

    let isCurrent = true;

    fetchChatStatus()
      .then((statusData) => {
        if (isCurrent) {
          applyChatStatus(statusData);
        }
      })
      .catch((requestError) => {
        if (!isCurrent) {
          return;
        }

        if (requestError?.response?.status === 401) {
          clearStoredUser();
          setCurrentUser(null);
          setAuthNotice("Your session expired. Log in again to use Shaky.");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [applyChatStatus, currentUserId]);

  if (!currentUser) {
    if (isMinimized) {
      return (
        <button
          aria-label="Open Shaky chatbot"
          type="button"
          onClick={() => setIsMinimized(false)}
          className="chatbot-launcher fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-3xl border border-slate-200 bg-slate-950 px-4 py-3 text-left text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-300/40"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg">
            <ShakyLogo size="launcher" />
          </span>
          <span className="chatbot-launcher__text">
            <span className="block text-sm font-black uppercase tracking-[0.15em]">Shaky</span>
            <span className="block text-xs text-slate-300">Log in for chat</span>
          </span>
        </button>
      );
    }

    return (
      <aside className="chatbot-panel fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="rounded-t-3xl bg-slate-950 px-4 py-3 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg">
                <ShakyLogo size="launcher" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">Shaky</p>
                <h3 className="mt-1 text-lg font-black leading-tight">Workout help on demand</h3>
              </div>
            </div>
            <button
              aria-label="Minimize Shaky chatbot"
              type="button"
              onClick={() => setIsMinimized(true)}
              className="rounded-2xl border border-white/15 px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              Minimize
            </button>
          </div>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="text-sm leading-6 text-slate-600">
            {authNotice || "Log in to chat with Shaky and get member workout help."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/login-user"
              className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.16em] text-white no-underline transition hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200"
            >
              Log In
            </Link>
            <Link
              to="/user"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-center text-xs font-black uppercase tracking-[0.16em] text-slate-950 no-underline transition hover:border-rose-300 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-100"
            >
              Create User
            </Link>
          </div>
        </div>
      </aside>
    );
  }

  const submitMessage = async (messageText, options = {}) => {
    const trimmedInput = typeof messageText === "string" ? messageText.trim() : "";
    const imagePayload = options.image || null;

    if (!trimmedInput || isSending) {
      return false;
    }

    const userMessage = { role: "user", text: options.displayText || trimmedInput };
    const historyForRequest = messages;

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError("");
    setIsSending(true);
    setIsMinimized(false);

    try {
      const response = await sendChatMessage(trimmedInput, historyForRequest, imagePayload);
      const reply = response?.reply?.trim() || "I couldn't generate a response just now. Please try again.";
      setAssistantMode(response?.model || "online");
      applyChatStatus(response);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: reply }
      ]);

      return true;
    } catch (requestError) {
      if (requestError?.response?.status === 401) {
        clearStoredUser();
        window.location = "/login-user";
        return false;
      }

      const message =
        requestError?.response?.data?.reply ||
        requestError?.response?.data?.message ||
        requestError?.message ||
        "Unable to reach Shaky right now.";

      if (process.env.NODE_ENV !== "production") {
        console.error(requestError);
      }
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: message
        }
      ]);

      return false;
    } finally {
      if (imagePayload) {
        imagePayload.data = "";
      }
      setIsSending(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await submitMessage(input);
  };

  const handleQuickPrompt = async (prompt) => {
    await submitMessage(prompt);
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file || isSending) {
      return;
    }

    let imagePayload = null;

    try {
      setError("");
      setImageNotice("Analyzing photo. XTracker sends it once and does not store it.");
      imagePayload = await buildChatImagePayload(file);
      const sent = await submitMessage(BODY_IMAGE_ANALYSIS_PROMPT, {
        displayText: "Uploaded a body photo for analysis. XTracker does not store uploaded photos.",
        image: imagePayload
      });

      setImageNotice(sent
        ? "Photo analysis complete. The uploaded image was not saved."
        : "Photo analysis did not finish. The uploaded image was not saved.");
    } catch (uploadError) {
      setImageNotice("");
      setError(uploadError?.message || "Unable to analyze that image.");
    } finally {
      if (imagePayload) {
        imagePayload.data = "";
      }

      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const statusLabel = assistantMode === "local-fallback"
    ? "Test mode"
    : assistantMode.startsWith("gemini:")
      ? "Gemini live"
      : assistantMode.startsWith("gemini-")
        ? "Model unavailable"
      : "AI live";
  const profileLabel = fitnessProfile?.profileComplete && fitnessProfile?.bmi
    ? `Profile ready | BMI ${fitnessProfile.bmi}`
    : "Complete profile for personalized coaching";
  const quotaLabel = aiQuota
    ? `${Number(aiQuota.remainingTokens || 0).toLocaleString()} AI tokens left`
    : "AI token budget loading";

  if (isMinimized) {
    return (
      <button
        aria-label="Open Shaky chatbot"
        type="button"
        onClick={() => setIsMinimized(false)}
        className="chatbot-launcher fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-950 px-4 py-3 text-left text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-300/40"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg">
          <ShakyLogo isThinking={isSending} size="launcher" />
        </span>
        <span className="chatbot-launcher__text">
          <span className="block text-sm font-black uppercase tracking-[0.15em]">Shaky</span>
          <span className="block text-xs text-slate-300">{statusLabel} coach</span>
        </span>
      </button>
    );
  }

  return (
    <aside className="chatbot-panel fixed bottom-4 right-4 z-50 flex max-h-[calc(100vh-2rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <div className="rounded-t-3xl bg-slate-950 px-4 py-3 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg shadow-cyan-950/20">
              <ShakyLogo isThinking={isSending} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">Shaky</p>
              <h3 className="mt-1 text-lg font-black leading-tight">Workout help on demand</h3>
            </div>
          </div>
          <button
            aria-label="Minimize Shaky chatbot"
            type="button"
            onClick={() => setIsMinimized(true)}
            className="rounded-2xl border border-white/15 px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-slate-200 transition hover:bg-white/10 hover:text-white"
          >
            Minimize
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-300">Signed in as {currentUser.username}. Ask Shaky about workouts, diet plans, recovery, routines, measurements, or how to use XTracker.</p>
        <p className="mt-2 inline-flex rounded-2xl bg-cyan-300 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-950">
          {quotaLabel} | {profileLabel}
        </p>
        {assistantMode.startsWith("gemini:") && (
          <p className="mt-2 inline-flex rounded-2xl bg-emerald-300 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">
            Gemini active
          </p>
        )}
        {assistantMode.startsWith("gemini-") && (
          <p className="mt-2 inline-flex rounded-2xl bg-amber-300 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">
            Gemini unavailable
          </p>
        )}
      </div>

      <div aria-live="polite" className="chatbot-panel__messages min-h-44 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-sm text-slate-700 shadow-sm">
            Hi, I am Shaky. I can coach you on training, diet plans, recovery, exercise choices, and XTracker features using your saved measurements.
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === "user";

          return (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-line break-words rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  isUser
                    ? "rounded-br-md bg-cyan-600 text-white"
                    : "rounded-bl-md bg-slate-100 text-slate-800"
                }`}
              >
                {message.text}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-sm text-slate-500 shadow-sm">
              <span>Shaky is thinking</span>
              <span className="shaky-typing-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        )}

        <div ref={scrollAnchorRef} />
      </div>

      <div className="max-h-96 overflow-y-auto border-t border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleQuickPrompt(prompt)}
              disabled={isSending}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {prompt}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsMusclePickerOpen((isOpen) => !isOpen)}
            disabled={isSending}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isMusclePickerOpen ? "Hide body map" : "Show body map"}
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleImageUpload}
            disabled={isSending}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isSending}
            className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-800 transition hover:border-cyan-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Analyze photo
          </button>
        </div>

        <p className="mt-2 text-xs leading-5 text-slate-500">
          Photo policy: XTracker sends uploaded body photos only for this one analysis, never stores them, and clears them when the request finishes.
        </p>

        {imageNotice && (
          <p className="mt-2 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-cyan-800">
            {imageNotice}
          </p>
        )}

        {isMusclePickerOpen && (
          <BodyMusclePicker
            selectedMuscle={selectedMuscle}
            onSelectMuscle={handleMuscleSelect}
            disabled={isSending}
          />
        )}
      </div>

      {error && (
        <p className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 p-3">
        <input
          className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          disabled={isSending}
          maxLength={CHATBOT_MESSAGE_MAX_LENGTH}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask Shaky..."
          value={input}
        />
        <button
          className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black uppercase tracking-[0.15em] text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={!input.trim() || isSending}
          type="submit"
        >
          {isSending ? "..." : "Send"}
        </button>
      </form>
    </aside>
  );
}

export default Chatbot;
