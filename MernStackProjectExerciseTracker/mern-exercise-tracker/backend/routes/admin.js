const router = require("express").Router();
const mongoose = require("mongoose");
const AdminContent = require("../models/admin-content-model");
const CustomExercise = require("../models/custom-exercise-model");
const Excercise = require("../models/excercise-model");
const SiteSettings = require("../models/site-settings-model");
const User = require("../models/user-model");
const requireAuth = require("../middleware/require-auth");
const requireAdmin = require("../middleware/require-admin");
const {
    applyAiQuotaUpdate,
    buildAiQuotaConfigPayload,
    buildAiQuotaPayload,
    clampMonthlyTokenLimit,
    getDefaultMonthlyTokenLimit
} = require("../utils/ai-quota");

const CONTENT_BODY_MAX_LENGTH = 5000;
const CONTENT_SUMMARY_MAX_LENGTH = 500;
const CONTENT_TITLE_MAX_LENGTH = 120;
const LIST_ITEM_MAX_LENGTH = 40;
const LIST_MAX_ITEMS = 12;
const SITE_MESSAGE_MAX_LENGTH = 500;
const SITE_TITLE_MAX_LENGTH = 100;
const URL_MAX_LENGTH = 1000;
const allowedContentTypes = new Set(["exercise", "article", "image", "video", "document", "link", "note"]);
const allowedStatuses = new Set(["draft", "published", "archived"]);

function sanitizeText(value, maxLength) {
    const text = typeof value === "string"
        ? value
            .normalize("NFKC")
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
        : "";

    return text.slice(0, maxLength);
}

function parseList(input) {
    const source = Array.isArray(input)
        ? input
        : typeof input === "string"
            ? input.split(",")
            : [];

    return source
        .slice(0, LIST_MAX_ITEMS * 2)
        .filter((item) => typeof item === "string")
        .map((item) => sanitizeText(item, LIST_ITEM_MAX_LENGTH))
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
        .slice(0, LIST_MAX_ITEMS);
}

function sanitizeUrl(value) {
    const url = sanitizeText(value, URL_MAX_LENGTH);

    if (!url) {
        return "";
    }

    try {
        const parsedUrl = new URL(url);

        return ["http:", "https:"].includes(parsedUrl.protocol) ? parsedUrl.toString() : "";
    } catch (error) {
        return "";
    }
}

function isValidObjectId(id) {
    return mongoose.isValidObjectId(id);
}

function buildSafeUser(user) {
    const profile = user.fitnessProfile || {};

    return {
        aiQuota: buildAiQuotaPayload(user),
        createdAt: user.createdAt,
        profileComplete: profile.bodyWeightKg != null && profile.heightCm != null && profile.neckCm != null && profile.waistCm != null,
        role: user.role || "user",
        updatedAt: user.updatedAt,
        userId: user._id.toString(),
        username: user.username
    };
}

function normalizeContentPayload(body = {}) {
    const title = sanitizeText(body.title, CONTENT_TITLE_MAX_LENGTH);
    const contentType = allowedContentTypes.has(body.contentType) ? body.contentType : "exercise";
    const status = allowedStatuses.has(body.status) ? body.status : "draft";
    const resourceUrl = sanitizeUrl(body.resourceUrl);

    if (!title) {
        return { ok: false, message: "Content title is required." };
    }

    if (body.resourceUrl && !resourceUrl) {
        return { ok: false, message: "Resource URL must be a valid http or https URL." };
    }

    return {
        ok: true,
        content: {
            body: sanitizeText(body.body, CONTENT_BODY_MAX_LENGTH),
            contentType,
            resourceUrl,
            status,
            summary: sanitizeText(body.summary, CONTENT_SUMMARY_MAX_LENGTH),
            tags: parseList(body.tags),
            title
        }
    };
}

function normalizeSiteSettingsPayload(body = {}) {
    const announcement = body.announcement || {};
    const featuredExercise = body.featuredExercise || {};
    const resourceUrl = sanitizeUrl(featuredExercise.resourceUrl);

    if (featuredExercise.resourceUrl && !resourceUrl) {
        return { ok: false, message: "Featured resource URL must be a valid http or https URL." };
    }

    return {
        ok: true,
        settings: {
            announcement: {
                enabled: Boolean(announcement.enabled),
                message: sanitizeText(announcement.message, SITE_MESSAGE_MAX_LENGTH),
                title: sanitizeText(announcement.title, SITE_TITLE_MAX_LENGTH)
            },
            featuredExercise: {
                description: sanitizeText(featuredExercise.description, SITE_MESSAGE_MAX_LENGTH),
                resourceUrl,
                title: sanitizeText(featuredExercise.title, SITE_TITLE_MAX_LENGTH)
            }
        }
    };
}

async function getSiteSettingsDocument() {
    return SiteSettings.findOneAndUpdate(
        { key: "global" },
        { $setOnInsert: { key: "global" } },
        { new: true, upsert: true }
    );
}

router.use(requireAuth, requireAdmin);

router.get("/summary", async (req, res) => {
    try {
        const [
            totalUsers,
            adminUsers,
            customExerciseCount,
            contentCount,
            workoutLogCount,
            recentUsers,
            quotaUsers
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: "admin" }),
            CustomExercise.countDocuments(),
            AdminContent.countDocuments(),
            Excercise.countDocuments(),
            User.find().sort({ createdAt: -1 }).limit(5).select("username role aiQuota fitnessProfile createdAt updatedAt"),
            User.find().select("aiQuota")
        ]);

        const aiTokensAllocated = quotaUsers.reduce((sum, user) => sum + buildAiQuotaPayload(user).monthlyTokenLimit, 0);
        const aiTokensUsed = quotaUsers.reduce((sum, user) => sum + buildAiQuotaPayload(user).tokensUsedThisPeriod, 0);

        return res.json({
            adminUsers,
            aiTokensAllocated,
            aiTokensUsed,
            contentCount,
            customExerciseCount,
            aiQuotaConfig: buildAiQuotaConfigPayload(),
            defaultMonthlyTokenLimit: getDefaultMonthlyTokenLimit(),
            recentUsers: recentUsers.map(buildSafeUser),
            totalUsers,
            workoutLogCount
        });
    } catch (error) {
        return res.status(500).json({ message: "Could not load admin summary." });
    }
});

router.get("/users", async (req, res) => {
    try {
        const users = await User.find()
            .sort({ createdAt: -1 })
            .limit(200)
            .select("username role aiQuota fitnessProfile createdAt updatedAt");

        return res.json(users.map(buildSafeUser));
    } catch (error) {
        return res.status(500).json({ message: "Could not load users." });
    }
});

router.patch("/users/ai-quota/default", async (req, res) => {
    const monthlyTokenLimit = clampMonthlyTokenLimit(
        Object.prototype.hasOwnProperty.call(req.body || {}, "monthlyTokenLimit")
            ? req.body.monthlyTokenLimit
            : getDefaultMonthlyTokenLimit()
    );
    const quotaUpdate = {
        "aiQuota.monthlyTokenLimit": monthlyTokenLimit,
        "aiQuota.updatedAt": new Date()
    };

    if (req.body?.resetUsage) {
        quotaUpdate["aiQuota.tokensUsedThisPeriod"] = 0;
        quotaUpdate["aiQuota.periodStartedAt"] = new Date(Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            1
        ));
    }

    try {
        const result = await User.updateMany({}, { $set: quotaUpdate });

        return res.json({
            matchedCount: result.matchedCount || 0,
            modifiedCount: result.modifiedCount || 0,
            monthlyTokenLimit
        });
    } catch (error) {
        return res.status(400).json({ message: "Could not apply the default AI token allowance." });
    }
});

router.patch("/users/:id/ai-quota", async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid user id." });
    }

    try {
        const user = await User.findById(req.params.id).select("username role aiQuota fitnessProfile createdAt updatedAt");

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        applyAiQuotaUpdate(user, req.body);
        await User.updateOne({ _id: user._id }, { $set: { aiQuota: user.aiQuota } });

        return res.json(buildSafeUser(user));
    } catch (error) {
        return res.status(400).json({ message: "Could not update this user's AI token allowance." });
    }
});

router.patch("/users/:id/role", async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid user id." });
    }

    const nextRole = req.body?.role === "admin" ? "admin" : "user";

    try {
        const user = await User.findById(req.params.id).select("username role aiQuota fitnessProfile createdAt updatedAt");

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        if (user.role === "admin" && nextRole !== "admin") {
            const adminCount = await User.countDocuments({ role: "admin" });

            if (adminCount <= 1) {
                return res.status(400).json({ message: "At least one admin account must remain." });
            }
        }

        user.role = nextRole;
        await User.updateOne({ _id: user._id }, { $set: { role: nextRole } });

        return res.json(buildSafeUser(user));
    } catch (error) {
        return res.status(400).json({ message: "Could not update this user's role." });
    }
});

router.get("/settings", async (req, res) => {
    try {
        const settings = await getSiteSettingsDocument();

        return res.json(settings);
    } catch (error) {
        return res.status(500).json({ message: "Could not load site settings." });
    }
});

router.patch("/settings", async (req, res) => {
    const result = normalizeSiteSettingsPayload(req.body);

    if (!result.ok) {
        return res.status(400).json({ message: result.message });
    }

    try {
        const settings = await getSiteSettingsDocument();
        settings.announcement = result.settings.announcement;
        settings.featuredExercise = result.settings.featuredExercise;
        settings.updatedBy = req.user.userId;
        settings.updatedByUsername = req.user.username;
        await settings.save();

        return res.json(settings);
    } catch (error) {
        return res.status(400).json({ message: "Could not update site settings." });
    }
});

router.get("/content", async (req, res) => {
    try {
        const content = await AdminContent.find().sort({ updatedAt: -1, createdAt: -1 }).limit(100);

        return res.json(content);
    } catch (error) {
        return res.status(500).json({ message: "Could not load content." });
    }
});

router.post("/content", async (req, res) => {
    const result = normalizeContentPayload(req.body);

    if (!result.ok) {
        return res.status(400).json({ message: result.message });
    }

    try {
        const content = new AdminContent({
            ...result.content,
            createdBy: req.user.userId,
            createdByUsername: req.user.username,
            updatedBy: req.user.userId,
            updatedByUsername: req.user.username
        });
        const savedContent = await content.save();

        return res.status(201).json(savedContent);
    } catch (error) {
        return res.status(400).json({ message: "Could not save content." });
    }
});

router.patch("/content/:id", async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid content id." });
    }

    const result = normalizeContentPayload(req.body);

    if (!result.ok) {
        return res.status(400).json({ message: result.message });
    }

    try {
        const content = await AdminContent.findById(req.params.id);

        if (!content) {
            return res.status(404).json({ message: "Content not found." });
        }

        Object.assign(content, result.content, {
            updatedBy: req.user.userId,
            updatedByUsername: req.user.username
        });

        const savedContent = await content.save();

        return res.json(savedContent);
    } catch (error) {
        return res.status(400).json({ message: "Could not update content." });
    }
});

module.exports = router;
