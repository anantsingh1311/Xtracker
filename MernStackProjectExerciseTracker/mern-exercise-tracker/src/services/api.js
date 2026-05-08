import axios from "axios";
import { clearStoredUser, getStoredToken } from "../utils/auth";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:5000");
const EXTERNAL_EXERCISES_CACHE_KEY = "xt_external_exercises_cache_v1";
const EXTERNAL_EXERCISES_CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const CHATBOT_HISTORY_LIMIT = 10;
const CHATBOT_TIMEOUT_MS = Number(process.env.REACT_APP_CHATBOT_TIMEOUT_MS) || 45000;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  config.xtrackerHadAuthToken = Boolean(token);
  config.xtrackerAuthToken = token;

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestToken = error?.config?.xtrackerAuthToken;

    if (error?.response?.status === 401 && requestToken && getStoredToken() === requestToken) {
      clearStoredUser();
    }

    return Promise.reject(error);
  }
);

let externalExercisesMemoryCache = null;
let externalExercisesPromise = null;

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function extractExerciseResults(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

function readExternalExercisesCache() {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(EXTERNAL_EXERCISES_CACHE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    const isExpired = !parsedValue.timestamp || (Date.now() - parsedValue.timestamp) > EXTERNAL_EXERCISES_CACHE_TTL_MS;

    if (isExpired || !Array.isArray(parsedValue.data)) {
      window.sessionStorage.removeItem(EXTERNAL_EXERCISES_CACHE_KEY);
      return null;
    }

    return parsedValue.data;
  } catch (error) {
    return null;
  }
}

function writeExternalExercisesCache(data) {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(EXTERNAL_EXERCISES_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (error) {
    // Ignore browser storage limits and keep using the in-memory cache.
  }
}

export async function get(path, config) {
  const response = await api.get(path, config);
  return response.data;
}

export async function post(path, payload, config) {
  const response = await api.post(path, payload, config);
  return response.data;
}

export async function remove(path, config) {
  const response = await api.delete(path, config);
  return response.data;
}

export async function sendChatMessage(message, history = []) {
  const trimmedMessage = typeof message === "string" ? message.trim() : "";

  if (!trimmedMessage) {
    throw new Error("Message is required");
  }

  const normalizedHistory = Array.isArray(history)
    ? history
        .filter((entry) => typeof entry?.text === "string" && entry.text.trim())
        .slice(-CHATBOT_HISTORY_LIMIT)
        .map((entry) => ({
          role: entry.role === "assistant" ? "assistant" : "user",
          text: entry.text.trim()
        }))
    : [];

  return post("/api/chat", {
    message: trimmedMessage,
    history: normalizedHistory
  }, {
    timeout: CHATBOT_TIMEOUT_MS
  });
}

export async function fetchChatStatus() {
  return get("/api/chat/usage", {
    timeout: 10000
  });
}

export async function fetchCurrentUser() {
  return get("/api/user");
}

export async function saveFitnessProfile(profile) {
  return post("/api/user/profile", profile);
}

export async function fetchAdminSummary() {
  return get("/api/admin/summary");
}

export async function fetchAdminUsers() {
  return get("/api/admin/users");
}

export async function updateAdminUserAiQuota(userId, payload) {
  return api.patch(`/api/admin/users/${userId}/ai-quota`, payload).then((response) => response.data);
}

export async function applyDefaultAdminAiQuota(payload = {}) {
  return api.patch("/api/admin/users/ai-quota/default", payload).then((response) => response.data);
}

export async function updateAdminUserRole(userId, payload) {
  return api.patch(`/api/admin/users/${userId}/role`, payload).then((response) => response.data);
}

export async function fetchAdminSettings() {
  return get("/api/admin/settings");
}

export async function updateAdminSettings(payload) {
  return api.patch("/api/admin/settings", payload).then((response) => response.data);
}

export async function fetchAdminContent() {
  return get("/api/admin/content");
}

export async function createAdminContent(payload) {
  return post("/api/admin/content", payload);
}

export async function updateAdminContent(contentId, payload) {
  return api.patch(`/api/admin/content/${contentId}`, payload).then((response) => response.data);
}

export async function fetchSiteSettings() {
  return get("/api/site-settings");
}

export async function fetchCustomExercises() {
  const response = await api.get("/api/custom-exercises/mine");
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchExternalExercises(options = {}) {
  const { forceRefresh = false } = options;

  if (!forceRefresh) {
    if (externalExercisesMemoryCache) {
      return externalExercisesMemoryCache;
    }

    const cachedExercises = readExternalExercisesCache();
    if (cachedExercises) {
      externalExercisesMemoryCache = cachedExercises;
      return cachedExercises;
    }

    if (externalExercisesPromise) {
      return externalExercisesPromise;
    }
  }

  externalExercisesPromise = api
    .get("/externalExercisesInfo")
    .then((response) => {
      const exercises = extractExerciseResults(response.data);
      externalExercisesMemoryCache = exercises;
      writeExternalExercisesCache(exercises);
      return exercises;
    })
    .finally(() => {
      externalExercisesPromise = null;
    });

  return externalExercisesPromise;
}
