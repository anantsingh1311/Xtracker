const crypto = require("crypto");
const { buildAiQuotaPayload } = require("./ai-quota");
const { buildFitnessProfilePayload } = require("./fitness-profile");

const DEFAULT_TOKEN_MAX_AGE_DAYS = 7;
const MIN_SESSION_SECRET_LENGTH = 32;
const DEV_SESSION_SECRET = "xtracker-dev-auth-secret-change-me";

function base64UrlEncode(value) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function base64UrlDecode(value) {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function getSessionSecret() {
    const configuredSecret = process.env.AUTH_TOKEN_SECRET;

    if (configuredSecret && configuredSecret.length >= MIN_SESSION_SECRET_LENGTH) {
        return configuredSecret;
    }

    if (process.env.NODE_ENV === "production") {
        throw new Error(`AUTH_TOKEN_SECRET must be set to at least ${MIN_SESSION_SECRET_LENGTH} characters in production.`);
    }

    return configuredSecret || DEV_SESSION_SECRET;
}

function assertProductionSessionSecret() {
    if (process.env.NODE_ENV !== "production") {
        return;
    }

    getSessionSecret();
}

function getTokenMaxAgeMs() {
    const configuredDays = Number(process.env.AUTH_TOKEN_MAX_AGE_DAYS);
    const safeDays = Number.isFinite(configuredDays) && configuredDays > 0
        ? configuredDays
        : DEFAULT_TOKEN_MAX_AGE_DAYS;

    return safeDays * 24 * 60 * 60 * 1000;
}

function signTokenPart(part) {
    return crypto
        .createHmac("sha256", getSessionSecret())
        .update(part)
        .digest("base64url");
}

function timingSafeEqual(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createSessionToken(user) {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + getTokenMaxAgeMs();
    const header = base64UrlEncode({ alg: "HS256", typ: "JWT" });
    const payload = base64UrlEncode({
        sub: String(user._id || user.userId),
        username: user.username,
        iat: issuedAt,
        exp: expiresAt
    });
    const signature = signTokenPart(`${header}.${payload}`);

    return {
        token: `${header}.${payload}.${signature}`,
        expiresAt
    };
}

function verifySessionToken(token) {
    if (typeof token !== "string" || !token.trim()) {
        return null;
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
        return null;
    }

    const [header, payload, signature] = parts;
    const expectedSignature = signTokenPart(`${header}.${payload}`);

    if (!timingSafeEqual(signature, expectedSignature)) {
        return null;
    }

    try {
        const parsedPayload = base64UrlDecode(payload);

        if (!parsedPayload?.sub || !parsedPayload?.username) {
            return null;
        }

        if (!parsedPayload.exp || Number(parsedPayload.exp) <= Date.now()) {
            return null;
        }

        return parsedPayload;
    } catch (error) {
        return null;
    }
}

function buildSessionResponse(user, extras = {}) {
    const { token, expiresAt } = createSessionToken(user);
    const fitnessProfile = buildFitnessProfilePayload(user);

    return {
        aiQuota: buildAiQuotaPayload(user),
        fitnessProfile,
        profileComplete: fitnessProfile.profileComplete,
        role: user.role || "user",
        userId: String(user._id || user.userId),
        username: user.username,
        token,
        sessionExpiresAt: new Date(expiresAt).toISOString(),
        ...extras
    };
}

module.exports = {
    assertProductionSessionSecret,
    buildSessionResponse,
    verifySessionToken
};
