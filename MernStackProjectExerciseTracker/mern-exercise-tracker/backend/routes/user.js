const router = require("express").Router();
const User = require("../models/user-model");
const requireAuth = require("../middleware/require-auth");
const createRateLimiter = require("../middleware/rate-limit");
const { buildSessionResponse } = require("../utils/session-token");
const { buildAiQuotaPayload } = require("../utils/ai-quota");
const { buildFitnessProfilePayload, normalizeFitnessProfile } = require("../utils/fitness-profile");

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;
const USERNAME_MAX_LENGTH = 32;
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
const signupRateLimiter = createRateLimiter({
    max: 6,
    message: "Too many sign-up attempts. Please wait a few minutes and try again.",
    name: "signup",
    windowMs: 15 * 60 * 1000
});

function normalizeUsername(value) {
    return typeof value === "string" ? value.trim() : "";
}

function getPasswordByteLength(password) {
    return Buffer.byteLength(password, "utf8");
}

router.get("/", requireAuth, (req, res) => {
    const fitnessProfile = buildFitnessProfilePayload(req.userDoc);

    res.json({
        aiQuota: buildAiQuotaPayload(req.userDoc),
        fitnessProfile,
        profileComplete: fitnessProfile.profileComplete,
        role: req.user.role,
        userId: req.user.userId,
        username: req.user.username
    });
});

router.post("/profile", requireAuth, async (req, res) => {
    const profileResult = normalizeFitnessProfile(req.body);

    if (!profileResult.ok) {
        return res.status(400).json({ message: profileResult.message });
    }

    try {
        req.userDoc.fitnessProfile = profileResult.profile;
        await req.userDoc.save();

        return res.json(buildSessionResponse(req.userDoc, {
            message: "Fitness profile updated."
        }));
    } catch (error) {
        return res.status(400).json({ message: "Could not update your fitness profile right now." });
    }
});

router.post("/add", signupRateLimiter, async (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const profileResult = normalizeFitnessProfile(req.body);

    if (!username || username.length < 3 || username.length > USERNAME_MAX_LENGTH || !USERNAME_PATTERN.test(username)) {
        return res.status(400).json({ message: "Username must be 3 to 32 characters and can only use letters, numbers, dots, underscores, or hyphens." });
    }

    if (!password || password.length < PASSWORD_MIN_LENGTH || getPasswordByteLength(password) > PASSWORD_MAX_BYTES) {
        return res.status(400).json({ message: "Password must be at least 8 characters and no more than 72 bytes." });
    }

    if (!profileResult.ok) {
        return res.status(400).json({ message: profileResult.message });
    }

    try {
        const existingUser = await User.findOne({ username }).select("_id");

        if (existingUser) {
            return res.status(409).json({ message: "That username is already taken." });
        }

        const newUser = new User({
            fitnessProfile: profileResult.profile,
            username,
            password
        });

        const savedUser = await newUser.save();

        return res.status(201).json(buildSessionResponse(savedUser, {
            message: "User added!"
        }));
    } catch (error) {
        return res.status(400).json({ message: "Could not create this user right now." });
    }
});

module.exports = router;
