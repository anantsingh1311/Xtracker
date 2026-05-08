const router = require("express").Router();
const SiteSettings = require("../models/site-settings-model");

function buildPublicSettings(settings) {
    return {
        announcement: settings?.announcement || {
            enabled: false,
            message: "",
            title: ""
        },
        featuredExercise: settings?.featuredExercise || {
            description: "",
            resourceUrl: "",
            title: ""
        },
        updatedAt: settings?.updatedAt || null
    };
}

router.get("/", async (req, res) => {
    try {
        const settings = await SiteSettings.findOne({ key: "global" });

        return res.json(buildPublicSettings(settings));
    } catch (error) {
        return res.status(500).json({ message: "Could not load site settings." });
    }
});

module.exports = router;
