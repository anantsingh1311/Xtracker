const express = require("express");
const axios = require("axios");
const requireAuth = require("../middleware/require-auth");
const createRateLimiter = require("../middleware/rate-limit");
const {
    buildAiQuotaPayload,
    estimateChatRequestTokens,
    estimateTokensFromText,
    hasAvailableAiTokens,
    recordAiTokenUsage
} = require("../utils/ai-quota");
const { buildFitnessProfilePayload } = require("../utils/fitness-profile");
const { xtrackerAiBotInstructions } = require("../utils/xtrackerChatbotInstructions");

const router = express.Router();
const defaultGeminiApiBaseUrl = "https://generativelanguage.googleapis.com/v1beta";
const geminiApiBaseUrl = normalizeGeminiApiBaseUrl(process.env.GEMINI_API_BASE_URL);
const geminiModel = normalizeGeminiModelName(process.env.GEMINI_MODEL) || "gemini-2.5-flash";
const geminiFallbackModels = (process.env.GEMINI_MODEL_FALLBACKS || "gemini-2.5-flash-lite")
    .split(",")
    .map(normalizeGeminiModelName)
    .filter(Boolean);
const geminiEnableGoogleSearch = process.env.GEMINI_ENABLE_GOOGLE_SEARCH !== "false";
const geminiTimeoutMs = readPositiveNumber(process.env.GEMINI_TIMEOUT_MS, 30000);
const maxMessageLength = Math.floor(readPositiveNumber(process.env.CHATBOT_MESSAGE_MAX_LENGTH, 1800));
const maxMessageBytes = Math.floor(readPositiveNumber(process.env.CHATBOT_MESSAGE_MAX_BYTES, 6000));
const maxHistoryEntryLength = Math.floor(readPositiveNumber(process.env.CHATBOT_HISTORY_ENTRY_MAX_LENGTH, 1400));
const maxHistoryMessages = Math.floor(readPositiveNumber(process.env.CHATBOT_HISTORY_MESSAGES, 16));
const maxChatOutputTokens = Math.floor(readPositiveNumber(process.env.CHATBOT_MAX_OUTPUT_TOKENS, 1300));
const planRepairOutputTokens = Math.floor(readPositiveNumber(process.env.CHATBOT_PLAN_REPAIR_OUTPUT_TOKENS, 1500));
const chatRouteRateLimiter = createRateLimiter({
    max: 120,
    message: "Shaky is receiving too many messages from this connection. Please pause for a minute and try again.",
    name: "chat",
    windowMs: 10 * 60 * 1000
});
const spellingAliases = {
    begginer: "beginner",
    beginer: "beginner",
    bodywieght: "bodyweight",
    bodyweigth: "bodyweight",
    calcuated: "calculated",
    calcuate: "calculate",
    calroies: "calories",
    calroie: "calorie",
    carido: "cardio",
    dumbells: "dumbbells",
    dumbell: "dumbbell",
    excerise: "exercise",
    excerises: "exercises",
    excercise: "exercise",
    excercises: "exercises",
    fetures: "features",
    fitnes: "fitness",
    gymm: "gym",
    libary: "library",
    mobilty: "mobility",
    muscel: "muscle",
    mussle: "muscle",
    nutriton: "nutrition",
    protien: "protein",
    recoery: "recovery",
    recovry: "recovery",
    routin: "routine",
    rutine: "routine",
    scedule: "schedule",
    strenght: "strength",
    strenth: "strength",
    strech: "stretch",
    weigth: "weight",
    wieght: "weight",
    workot: "workout",
    workuot: "workout",
    workuots: "workouts",
    xtraker: "xtracker",
    xtrakcer: "xtracker"
};
const fuzzyVocabulary = [
    "app", "barbell", "bands", "beginner", "bodyweight", "bmi", "calorie", "calories", "cardio",
    "coach", "cutting", "diet", "dumbbell", "dumbbells", "endurance", "equipment", "exercise",
    "exercises", "fat", "features", "fitness", "gain", "gym", "height", "history", "hypertrophy",
    "library", "log", "meal", "mobility", "muscle", "neck", "nutrition", "plan", "program",
    "protein", "recovery", "routine", "schedule", "strength", "stretch", "training", "weight",
    "workout", "workouts", "xtracker"
];

function readPositiveNumber(value, fallback) {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function normalizeGeminiApiBaseUrl(value) {
    if (!value) {
        return defaultGeminiApiBaseUrl;
    }

    try {
        const parsedUrl = new URL(value);

        if (parsedUrl.protocol !== "https:") {
            return defaultGeminiApiBaseUrl;
        }

        return parsedUrl.toString().replace(/\/$/, "");
    } catch (error) {
        return defaultGeminiApiBaseUrl;
    }
}

function normalizeGeminiModelName(value) {
    const model = typeof value === "string" ? value.trim() : "";

    return /^[A-Za-z0-9._:-]+$/.test(model) ? model : "";
}

function getCandidateModels() {
    return [...new Set([geminiModel, ...geminiFallbackModels])];
}

function normalizeChatText(value) {
    return String(value || "")
        .normalize("NFKC")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function calculateEditDistance(left, right, maxDistance) {
    if (left === right) {
        return 0;
    }

    if (Math.abs(left.length - right.length) > maxDistance) {
        return maxDistance + 1;
    }

    const previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        let bestInRow = leftIndex;
        const currentRow = [leftIndex];

        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
            const value = Math.min(
                currentRow[rightIndex - 1] + 1,
                previousRow[rightIndex] + 1,
                previousRow[rightIndex - 1] + substitutionCost
            );

            currentRow[rightIndex] = value;
            bestInRow = Math.min(bestInRow, value);
        }

        if (bestInRow > maxDistance) {
            return maxDistance + 1;
        }

        for (let index = 0; index < currentRow.length; index += 1) {
            previousRow[index] = currentRow[index];
        }
    }

    return previousRow[right.length];
}

function repairToken(token) {
    if (!token) {
        return token;
    }

    if (spellingAliases[token]) {
        return spellingAliases[token];
    }

    if (token.length < 5 || fuzzyVocabulary.includes(token)) {
        return token;
    }

    let bestMatch = token;
    let bestDistance = token.length > 7 ? 2 : 1;

    for (const candidate of fuzzyVocabulary) {
        if (candidate.length < 5 || candidate[0] !== token[0]) {
            continue;
        }

        const distance = calculateEditDistance(token, candidate, bestDistance);

        if (distance > 0 && distance <= bestDistance) {
            bestMatch = candidate;
            bestDistance = distance;
        }
    }

    return bestMatch;
}

function normalizeSearchText(value) {
    const normalizedText = normalizeChatText(value)
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!normalizedText) {
        return "";
    }

    return normalizedText
        .split(" ")
        .flatMap((token) => repairToken(token).split(" "))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeHistory(history) {
    if (!Array.isArray(history)) {
        return [];
    }

    return history
        .slice(-Math.max(maxHistoryMessages * 2, maxHistoryMessages))
        .map((entry) => ({
            role: entry?.role === "assistant" ? "assistant" : "user",
            text: normalizeChatText(entry?.text).slice(0, maxHistoryEntryLength)
        }))
        .filter((entry) => entry.text)
        .slice(-maxHistoryMessages);
}

function buildUserMessagePart(message) {
    const normalizedIntent = normalizeSearchText(message);
    const normalizedRaw = normalizeChatText(message).toLowerCase();

    if (normalizedIntent && normalizedIntent !== normalizedRaw) {
        return `User message:\n${message}\n\nTypo-normalized intent hints:\n${normalizedIntent}`;
    }

    return message;
}

function buildGeminiContents(history, message) {
    return [
        ...normalizeHistory(history).map((entry) => ({
            role: entry.role === "assistant" ? "model" : "user",
            parts: [{ text: entry.text }]
        })),
        {
            role: "user",
            parts: [{ text: buildUserMessagePart(message) }]
        }
    ];
}

function buildCoachSystemInstruction(userDoc) {
    const profile = buildFitnessProfilePayload(userDoc);
    const profileContext = profile.profileComplete
        ? [
            `Current member: ${userDoc.username}`,
            `Body weight: ${profile.bodyWeightKg} kg`,
            `Height: ${profile.heightCm} cm`,
            `Neck circumference: ${profile.neckCm} cm`,
            `Waist circumference: ${profile.waistCm} cm`,
            `Estimated BMI: ${profile.bmi} (${profile.bmiCategory})`,
            `Waist-to-height ratio: ${profile.waistToHeightRatio}`
        ].join("\n")
        : `Current member: ${userDoc.username}\nFitness measurements are incomplete. Ask them to complete body weight, height, neck circumference, and waist circumference before giving personalized plans.`;

    return `
${xtrackerAiBotInstructions.trim()}

You are Shaky, a reasoning-first AI fitness coach inside XTracker.

Current member profile:
${profileContext}

How to coach:
- Use the member profile when building workout routines, diet guidance, calorie guidance, and recovery suggestions.
- BMI is only a rough screening estimate; never diagnose health conditions from BMI or neck circumference.
- Give practical, personalized guidance for workouts, diet plans, meal structure, recovery, exercise selection, progress tracking, and XTracker app usage.
- Users may have spelling mistakes. Infer intent from the raw text and the typo-normalized hints.
- Do not force a rigid intake script. If enough information exists, make reasonable assumptions, state them briefly, and provide a useful answer.
- Ask concise follow-up questions only when the missing detail materially changes the answer.
- Stay within fitness, nutrition, recovery, and XTracker app guidance. If a request is unrelated, steer back politely.
- For pain, illness, injuries, eating disorders, pregnancy, or medical conditions, give conservative general safety advice and recommend a qualified professional.
- AI usage is controlled by the member's monthly token allowance. Do not mention internal token counts unless the user asks about app limits.
- Keep responses clear, specific, and actionable. Use short sections or bullets when helpful.
- For workout, diet, split, routine, or schedule requests, finish the complete plan in one message with concrete days, exercises or meals, sets/reps or minutes, progression, rest/recovery, and assumptions.
`;
}

function extractGeminiReplyText(responseData) {
    const parts = responseData?.candidates?.[0]?.content?.parts;

    if (!Array.isArray(parts)) {
        return "";
    }

    return parts
        .map((part) => (typeof part?.text === "string" ? part.text : ""))
        .join("")
        .trim();
}

function shouldUseGoogleSearch(message) {
    if (!geminiEnableGoogleSearch) {
        return false;
    }

    return /(latest|today|recent|current|newest|research|study|studies|evidence|news|trend|guidelines)/i.test(normalizeSearchText(message));
}

function isPlanRequest(message) {
    const normalizedMessage = normalizeSearchText(message);

    return /\b(workout|training|exercise|strength|cardio|diet|meal|nutrition|recovery)\b/.test(normalizedMessage)
        && /\b(plan|program|routine|split|schedule|create|build|make|generate)\b/.test(normalizedMessage);
}

function assessPlanReplyCompleteness(reply) {
    const normalizedReply = normalizeChatText(reply).toLowerCase();
    const wordCount = normalizedReply.split(/\s+/).filter(Boolean).length;
    const completionSignals = [
        /\b(day|week|schedule|session)\b/.test(normalizedReply),
        /\b(set|sets|rep|reps|minute|minutes|min)\b/.test(normalizedReply),
        /\b(rest|recovery|sleep|warm up|warm-up|cooldown|cool down)\b/.test(normalizedReply),
        /\bprogress|progression|increase|adjust|scale\b/.test(normalizedReply),
        /\bassumption|assuming|based on\b/.test(normalizedReply)
    ].filter(Boolean).length;
    const hasUnfinishedEnding = /(continue|and so on|etc\.?|more later|next response|part 2)$/i.test(normalizedReply)
        || /(\.\.\.|,$|:$)/.test(normalizedReply);

    return wordCount >= 180 && completionSignals >= 4 && !hasUnfinishedEnding;
}

function buildPlanRepairPrompt(originalMessage, incompleteReply) {
    return `
The previous answer to this user request was too incomplete for production use.

Original user request:
${originalMessage}

Incomplete draft summary:
${normalizeChatText(incompleteReply).slice(0, 1200)}

Now provide one complete, concise plan. Include assumptions, the schedule, exact exercises or meals, sets/reps or minutes, intensity/rest guidance, progression, recovery, and how to adjust if the user is a beginner. Do not mention that you are repairing a draft.
`;
}

function shouldTryNextGeminiModel(error) {
    const statusCode = Number(error?.response?.status || 0);

    return statusCode === 404 || statusCode === 429 || statusCode === 500 || statusCode === 503;
}

async function createGeminiChatCompletion(history, message, userDoc, options = {}) {
    if (!process.env.GEMINI_API_KEY) {
        return null;
    }

    const models = getCandidateModels();
    let lastError = null;

    for (const model of models) {
        try {
            const response = await axios.post(
                `${geminiApiBaseUrl}/models/${model}:generateContent`,
                {
                    system_instruction: {
                        parts: [{ text: buildCoachSystemInstruction(userDoc) }]
                    },
                    contents: buildGeminiContents(history, message),
                    generationConfig: {
                        maxOutputTokens: options.maxOutputTokens || maxChatOutputTokens,
                        temperature: 0.72
                    },
                    ...(shouldUseGoogleSearch(message)
                        ? {
                            tools: [{ google_search: {} }]
                        }
                        : {})
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": process.env.GEMINI_API_KEY
                    },
                    timeout: geminiTimeoutMs
                }
            );

            return {
                data: response.data,
                model
            };
        } catch (error) {
            lastError = error;

            if (!shouldTryNextGeminiModel(error)) {
                throw error;
            }
        }
    }

    throw lastError;
}

function buildModelUnavailableReply(userDoc) {
    const profile = buildFitnessProfilePayload(userDoc);
    const profileLine = profile.profileComplete
        ? `I still have your profile saved: ${profile.bodyWeightKg} kg, ${profile.heightCm} cm, BMI ${profile.bmi}.`
        : "Complete your body weight, height, neck circumference, and waist circumference so I can personalize coaching when the model is reachable.";

    return `I cannot reach Gemini right now, so I do not want to pretend I can reason through a full coaching answer. ${profileLine} Please try again in a moment.`;
}

router.get("/usage", requireAuth, (req, res) => {
    return res.json({
        aiQuota: buildAiQuotaPayload(req.userDoc),
        aiTokenLimitEnabled: true,
        dailyLimitEnabled: false,
        model: process.env.GEMINI_API_KEY ? `gemini:${geminiModel}` : "gemini-not-configured",
        profile: buildFitnessProfilePayload(req.userDoc),
        unlimited: false
    });
});

router.post("/", requireAuth, chatRouteRateLimiter, async (req, res) => {
    const message = normalizeChatText(req.body?.message);
    const history = normalizeHistory(req.body?.history);

    if (!message) {
        return res.status(400).json({ message: "Message is required." });
    }

    if (message.length > maxMessageLength || Buffer.byteLength(message, "utf8") > maxMessageBytes) {
        return res.status(400).json({ message: `Message must be ${maxMessageLength} characters or less.` });
    }

    const estimatedRequestTokens = estimateChatRequestTokens(message, history);

    if (!hasAvailableAiTokens(req.userDoc, estimatedRequestTokens)) {
        return res.status(429).json({
            aiQuota: buildAiQuotaPayload(req.userDoc),
            message: "Your AI token allowance for this month has been used. Ask an admin for more tokens.",
            profile: buildFitnessProfilePayload(req.userDoc)
        });
    }

    try {
        const geminiResult = await createGeminiChatCompletion(history, message, req.userDoc);
        let reply = extractGeminiReplyText(geminiResult?.data);
        let responseModel = geminiResult?.model;
        let extraTokenEstimate = 0;

        if (!reply) {
            return res.status(503).json({
                fallback: true,
                message: "Shaky could not generate a response right now.",
                model: "gemini-empty-response",
                aiQuota: buildAiQuotaPayload(req.userDoc),
                profile: buildFitnessProfilePayload(req.userDoc),
                reply: buildModelUnavailableReply(req.userDoc),
                unlimited: false
            });
        }

        if (isPlanRequest(message) && !assessPlanReplyCompleteness(reply)) {
            try {
                const repairPrompt = buildPlanRepairPrompt(message, reply);
                const repairResult = await createGeminiChatCompletion(
                    [...history, { role: "assistant", text: reply }],
                    repairPrompt,
                    req.userDoc,
                    { maxOutputTokens: planRepairOutputTokens }
                );
                const repairedReply = extractGeminiReplyText(repairResult?.data);

                if (repairedReply && (assessPlanReplyCompleteness(repairedReply) || repairedReply.length > reply.length)) {
                    extraTokenEstimate = estimateTokensFromText(repairPrompt) + estimateTokensFromText(repairedReply);
                    reply = repairedReply;
                    responseModel = repairResult.model;
                }
            } catch (repairError) {
                console.warn("Gemini plan quality retry failed:", {
                    message: repairError?.message || "Unknown error"
                });
            }
        }

        const aiQuota = await recordAiTokenUsage(
            req.userDoc,
            estimatedRequestTokens + estimateTokensFromText(reply) + extraTokenEstimate
        );

        return res.json({
            aiQuota,
            aiTokenLimitEnabled: true,
            dailyLimitEnabled: false,
            fallback: false,
            model: `gemini:${responseModel}`,
            profile: buildFitnessProfilePayload(req.userDoc),
            reply,
            unlimited: false
        });
    } catch (error) {
        const statusCode = Number(error?.response?.status || 0);

        console.error("Gemini chatbot request failed:", {
            message: error?.message || "Unknown error",
            statusCode: statusCode || null
        });

        return res.status(503).json({
            fallback: true,
            message: "Shaky cannot reach the AI coach right now.",
            model: "gemini-unavailable",
            aiQuota: buildAiQuotaPayload(req.userDoc),
            profile: buildFitnessProfilePayload(req.userDoc),
            reply: buildModelUnavailableReply(req.userDoc),
            unlimited: false
        });
    }
});

module.exports = router;
module.exports._test = {
    assessPlanReplyCompleteness,
    buildCoachSystemInstruction,
    buildUserMessagePart,
    isPlanRequest,
    normalizeChatText,
    normalizeHistory,
    normalizeSearchText
};
