const User = require("../models/user-model");
const { verifySessionToken } = require("../utils/session-token");

function extractBearerToken(req) {
    const authorizationHeader = req.header("authorization");

    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
        return null;
    }

    return authorizationHeader.slice("Bearer ".length).trim();
}

async function requireAuth(req, res, next) {
    try {
        const token = extractBearerToken(req);

        if (!token) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const payload = verifySessionToken(token);
        if (!payload) {
            return res.status(401).json({ message: "Invalid session" });
        }

        const user = await User.findById(payload.sub).select("username role aiQuota fitnessProfile");

        if (!user || user.username !== payload.username) {
            return res.status(401).json({ message: "Invalid session" });
        }

        req.user = {
            aiQuota: user.aiQuota || {},
            fitnessProfile: user.fitnessProfile || {},
            role: user.role || "user",
            userId: user._id.toString(),
            username: user.username
        };
        req.userDoc = user;

        return next();
    } catch (error) {
        return res.status(401).json({ message: "Authentication failed" });
    }
}

module.exports = requireAuth;
