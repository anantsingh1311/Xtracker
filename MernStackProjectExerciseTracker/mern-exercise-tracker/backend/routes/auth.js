const express = require("express");
const User = require("../models/user-model");
const createRateLimiter = require("../middleware/rate-limit");
const { promoteBootstrapAdminByUsername } = require("../utils/admin-bootstrap");
const { buildSessionResponse } = require("../utils/session-token");

const PASSWORD_MAX_BYTES = 72;
const USERNAME_MAX_LENGTH = 32;
const router = express.Router();
const loginRateLimiter = createRateLimiter({
    max: 10,
    message: "Too many login attempts. Please wait a few minutes and try again.",
    name: "login",
    windowMs: 15 * 60 * 1000
});

router.post("/login", loginRateLimiter, async (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
    }

    if (username.length > USERNAME_MAX_LENGTH || Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    try {
        const user = await User.findOne({ username }).select("+password username role aiQuota fitnessProfile");

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
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
