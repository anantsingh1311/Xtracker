const express = require("express");
const User = require("../models/user-model");
const createRateLimiter = require("../middleware/rate-limit");
const { promoteBootstrapAdminByUsername } = require("../utils/admin-bootstrap");
const { buildSessionResponse } = require("../utils/session-token");

const PASSWORD_MAX_BYTES = 72;
const LOGIN_IDENTIFIER_MAX_LENGTH = 32;
const router = express.Router();
const loginRateLimiter = createRateLimiter({
    max: 10,
    message: "Too many login attempts. Please wait a few minutes and try again.",
    name: "login",
    windowMs: 15 * 60 * 1000
});

router.post("/login", loginRateLimiter, async (req, res) => {
    const loginIdentifier = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!loginIdentifier || !password) {
        return res.status(400).json({ message: "Name or user ID and password are required." });
    }

    if (loginIdentifier.length > LOGIN_IDENTIFIER_MAX_LENGTH || Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    try {
        const possibleUsers = await User.find({
            $or: [
                { username: loginIdentifier },
                { name: loginIdentifier }
            ]
        }).collation({ locale: "en", strength: 2 }).select("+password username name role aiQuota fitnessProfile").limit(10);
        let user = null;

        for (const possibleUser of possibleUsers) {
            if (await possibleUser.matchPassword(password)) {
                user = possibleUser;
                break;
            }
        }

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        let sessionUser = user;
        const shouldRehashPassword = user.needsPasswordRehash();

        if (shouldRehashPassword) {
            user.password = password;
        }

        if (user.role !== "admin") {
            sessionUser = await promoteBootstrapAdminByUsername(user.username) || user;
        }

        if (shouldRehashPassword) {
            sessionUser.password = password;
            await sessionUser.save();
        }

        return res.json(buildSessionResponse(sessionUser, {
            message: "Login successful"
        }));
    } catch (error) {
        return res.status(500).json({ message: "Could not log in right now." });
    }
});

module.exports = router;
