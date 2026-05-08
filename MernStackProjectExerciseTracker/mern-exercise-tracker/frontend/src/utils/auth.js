const AUTH_STORAGE_KEY = "user";
const AUTH_CHANGE_EVENT = "xtracker-auth-change";

function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
}

function isExpiredSession(sessionExpiresAt) {
  if (!sessionExpiresAt) {
    return false;
  }

  const expiresAt = Date.parse(sessionExpiresAt);

  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

export function getAuthChangeEventName() {
  return AUTH_CHANGE_EVENT;
}

export function getStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const parsedUser = rawUser ? JSON.parse(rawUser) : null;

    if (!parsedUser?.userId || !parsedUser?.username || !parsedUser?.token) {
      return null;
    }

    if (isExpiredSession(parsedUser.sessionExpiresAt)) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      notifyAuthChange();
      return null;
    }

    return parsedUser;
  } catch (error) {
    return null;
  }
}

export function saveStoredUser(user) {
  if (typeof window === "undefined" || !user?.userId || !user?.username || !user?.token) {
    return false;
  }

  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      aiQuota: user.aiQuota || null,
      fitnessProfile: user.fitnessProfile || null,
      profileComplete: Boolean(user.profileComplete || user.fitnessProfile?.profileComplete),
      role: user.role === "admin" ? "admin" : "user",
      sessionExpiresAt: user.sessionExpiresAt || null,
      token: user.token,
      userId: user.userId,
      username: user.username
    }));
    notifyAuthChange();
    return true;
  } catch (error) {
    return false;
  }
}

export function mergeStoredUser(updates = {}) {
  const currentUser = getStoredUser();

  if (typeof window === "undefined" || !currentUser) {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    ...currentUser,
    ...updates,
    aiQuota: updates.aiQuota || currentUser.aiQuota || null,
    fitnessProfile: updates.fitnessProfile || currentUser.fitnessProfile || null,
    profileComplete: Boolean(updates.profileComplete || updates.fitnessProfile?.profileComplete || currentUser.profileComplete),
    role: updates.role === "admin" ? "admin" : currentUser.role || "user"
  }));
  notifyAuthChange();
}

export function getStoredToken() {
  return getStoredUser()?.token || "";
}

export function isAuthenticated() {
  const user = getStoredUser();
  return Boolean(user?.userId && user?.username && user?.token);
}

export function hasCompletedFitnessProfile(user = getStoredUser()) {
  return Boolean(user?.profileComplete || user?.fitnessProfile?.profileComplete);
}

export function isAdmin(user = getStoredUser()) {
  return user?.role === "admin";
}

export function clearStoredUser() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    notifyAuthChange();
  }
}
