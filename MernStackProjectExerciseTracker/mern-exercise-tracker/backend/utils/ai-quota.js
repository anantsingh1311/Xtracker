function readPositiveInteger(value, fallback) {
    const number = Number(value);

    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function getDefaultMonthlyTokenLimit() {
    return readPositiveInteger(process.env.DEFAULT_AI_MONTHLY_TOKEN_LIMIT, 0);
}

function getMaxMonthlyTokenLimit() {
    return readPositiveInteger(process.env.MAX_AI_MONTHLY_TOKEN_LIMIT, getDefaultMonthlyTokenLimit());
}

function getTokenLimitInputStep() {
    return Math.max(readPositiveInteger(process.env.AI_TOKEN_LIMIT_INPUT_STEP, Math.ceil(getDefaultMonthlyTokenLimit() / 10)), 1);
}

function getTokenCharsRatio() {
    return Math.max(readPositiveInteger(process.env.AI_TOKEN_CHARS_RATIO, 4), 1);
}

function clampMonthlyTokenLimit(value) {
    return Math.min(readPositiveInteger(value, getDefaultMonthlyTokenLimit()), getMaxMonthlyTokenLimit());
}

function buildAiQuotaConfigPayload() {
    return {
        defaultMonthlyTokenLimit: getDefaultMonthlyTokenLimit(),
        maxMonthlyTokenLimit: getMaxMonthlyTokenLimit(),
        tokenCharsRatio: getTokenCharsRatio(),
        tokenLimitInputStep: getTokenLimitInputStep()
    };
}

function getCurrentPeriodStart(now = new Date()) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function isCurrentPeriod(date, now = new Date()) {
    const periodStart = getCurrentPeriodStart(now);
    const value = date ? new Date(date) : null;

    return value instanceof Date && !Number.isNaN(value.getTime()) && value >= periodStart;
}

function ensureAiQuota(userDoc) {
    const currentPeriodStart = getCurrentPeriodStart();
    const quota = userDoc.aiQuota || {};
    const monthlyTokenLimit = clampMonthlyTokenLimit(quota.monthlyTokenLimit);
    const shouldResetPeriod = !isCurrentPeriod(quota.periodStartedAt);

    userDoc.aiQuota = {
        monthlyTokenLimit,
        tokensUsedThisPeriod: shouldResetPeriod ? 0 : readPositiveInteger(quota.tokensUsedThisPeriod, 0),
        periodStartedAt: shouldResetPeriod ? currentPeriodStart : quota.periodStartedAt,
        updatedAt: quota.updatedAt || null
    };

    return userDoc.aiQuota;
}

function estimateTokensFromText(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value || "");

    return Math.max(1, Math.ceil(text.length / getTokenCharsRatio()));
}

function estimateChatRequestTokens(message, history = []) {
    const historyText = Array.isArray(history)
        ? history.map((entry) => `${entry.role || "user"}:${entry.text || ""}`).join("\n")
        : "";

    return estimateTokensFromText(`${historyText}\n${message || ""}`);
}

function buildAiQuotaPayload(userDoc) {
    const quota = ensureAiQuota(userDoc);
    const remainingTokens = Math.max(quota.monthlyTokenLimit - quota.tokensUsedThisPeriod, 0);

    return {
        monthlyTokenLimit: quota.monthlyTokenLimit,
        tokensUsedThisPeriod: quota.tokensUsedThisPeriod,
        remainingTokens,
        periodStartedAt: quota.periodStartedAt,
        updatedAt: quota.updatedAt || null
    };
}

function hasAvailableAiTokens(userDoc, estimatedTokens) {
    const quota = ensureAiQuota(userDoc);

    return quota.tokensUsedThisPeriod + Math.max(Number(estimatedTokens) || 0, 0) <= quota.monthlyTokenLimit;
}

async function recordAiTokenUsage(userDoc, tokensUsed) {
    const quota = ensureAiQuota(userDoc);
    quota.tokensUsedThisPeriod += Math.max(Math.ceil(Number(tokensUsed) || 0), 0);
    quota.updatedAt = new Date();
    userDoc.markModified("aiQuota");
    await userDoc.constructor.updateOne(
        { _id: userDoc._id },
        { $set: { aiQuota: quota } }
    );

    return buildAiQuotaPayload(userDoc);
}

function applyAiQuotaUpdate(userDoc, input = {}) {
    const quota = ensureAiQuota(userDoc);

    if (Object.prototype.hasOwnProperty.call(input, "monthlyTokenLimit")) {
        quota.monthlyTokenLimit = clampMonthlyTokenLimit(input.monthlyTokenLimit);
    }

    if (input.resetUsage) {
        quota.tokensUsedThisPeriod = 0;
        quota.periodStartedAt = getCurrentPeriodStart();
    }

    quota.updatedAt = new Date();
    userDoc.markModified("aiQuota");

    return quota;
}

module.exports = {
    applyAiQuotaUpdate,
    buildAiQuotaConfigPayload,
    buildAiQuotaPayload,
    clampMonthlyTokenLimit,
    estimateChatRequestTokens,
    estimateTokensFromText,
    getDefaultMonthlyTokenLimit,
    getMaxMonthlyTokenLimit,
    getTokenCharsRatio,
    getTokenLimitInputStep,
    hasAvailableAiTokens,
    recordAiTokenUsage
};
