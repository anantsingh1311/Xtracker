const router = require("express").Router();
const axios = require("axios");
const createRateLimiter = require("../middleware/rate-limit");

let exerciseCache = {
    data: null,
    expiresAt: 0
};
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const externalExercisesRateLimiter = createRateLimiter({
    max: 60,
    message: "Too many exercise-library requests. Please try again shortly.",
    name: "external-exercises",
    windowMs: 10 * 60 * 1000
});

router.get("/", externalExercisesRateLimiter, async (req, res) => {
    if (exerciseCache.data && exerciseCache.expiresAt > Date.now()) {
        return res.json(exerciseCache.data);
    }

    try {
        const response = await axios.get("https://wger.de/api/v2/exerciseinfo/", {
            params: { limit: 1000 },
            timeout: 15000
        });

        if (!response.data) {
            return res.status(404).json({ message: "Exercise not found" });
        }

        exerciseCache = {
            data: response.data,
            expiresAt: Date.now() + CACHE_TTL_MS
        };

        res.json(response.data);
    } catch (error) {
        console.error("External exercise fetch failed:", {
            message: error?.message || "Unknown error"
        });
        res.status(500).json({ message: "Unable to fetch external exercises" });
    }
});

module.exports = router;
