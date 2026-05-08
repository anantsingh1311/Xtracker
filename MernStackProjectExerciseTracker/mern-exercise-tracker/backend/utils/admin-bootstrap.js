const User = require("../models/user-model");

const BOOTSTRAP_USERNAME_MAX_LENGTH = 32;

function normalizeBootstrapUsername(value) {
    return typeof value === "string"
        ? value.trim().slice(0, BOOTSTRAP_USERNAME_MAX_LENGTH)
        : "";
}

function getBootstrapAdminUsername() {
    return normalizeBootstrapUsername(process.env.ADMIN_BOOTSTRAP_USERNAME);
}

async function promoteBootstrapAdminByUsername(username) {
    const bootstrapUsername = getBootstrapAdminUsername();

    if (!bootstrapUsername || username !== bootstrapUsername) {
        return null;
    }

    const user = await User.findOne({ username: bootstrapUsername }).select("_id username role aiQuota fitnessProfile");

    if (!user) {
        return null;
    }

    if (user.role !== "admin") {
        user.role = "admin";
        await User.updateOne({ _id: user._id }, { $set: { role: "admin" } });
    }

    return user;
}

async function ensureBootstrapAdmin() {
    const bootstrapUsername = getBootstrapAdminUsername();

    if (!bootstrapUsername) {
        return;
    }

    try {
        const user = await promoteBootstrapAdminByUsername(bootstrapUsername);

        if (user) {
            console.log(`Admin bootstrap verified for ${bootstrapUsername}.`);
        } else {
            console.warn(`ADMIN_BOOTSTRAP_USERNAME is set to ${bootstrapUsername}, but that user does not exist yet.`);
        }
    } catch (error) {
        console.error("Admin bootstrap failed:", error.message);
    }
}

module.exports = {
    ensureBootstrapAdmin,
    getBootstrapAdminUsername,
    promoteBootstrapAdminByUsername
};
