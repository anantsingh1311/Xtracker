const router = require("express").Router();
const CustomExercise = require("../models/custom-exercise-model");
const requireAuth = require("../middleware/require-auth");

const LIST_ITEM_MAX_LENGTH = 40;
const LIST_MAX_ITEMS = 12;
const SHORT_TEXT_MAX_LENGTH = 80;
const INSTRUCTIONS_MAX_LENGTH = 1000;
const WORKOUT_TYPES = ["cardio", "strength"];

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
    const normalizeItems = (items) => items
        .slice(0, LIST_MAX_ITEMS * 2)
        .filter((item) => typeof item === "string")
        .map((item) => sanitizeText(item, LIST_ITEM_MAX_LENGTH))
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
        .slice(0, LIST_MAX_ITEMS);

    if (Array.isArray(input)) {
        return normalizeItems(input);
    }

    if (typeof input === "string") {
        return normalizeItems(input.split(","));
    }

    return [];
}

router.use(requireAuth);

router.get("/mine", async (req, res) => {
    try {
        const exercises = await CustomExercise.find({ createdBy: req.user.userId }).sort({ createdAt: -1 });
        res.json(exercises);
    } catch (error) {
        res.status(400).json({ message: "Could not load custom exercises" });
    }
});

router.post("/", async (req, res) => {
    try {
        const name = sanitizeText(req.body?.name, SHORT_TEXT_MAX_LENGTH);
        const category = sanitizeText(req.body?.category, SHORT_TEXT_MAX_LENGTH);
        const workoutType = WORKOUT_TYPES.includes(req.body?.workoutType) ? req.body.workoutType : "strength";

        if (!name || !category) {
            return res.status(400).json({ message: "Exercise name and category are required." });
        }

        const customExercise = new CustomExercise({
            name,
            category,
            workoutType,
            instructions: sanitizeText(req.body?.instructions, INSTRUCTIONS_MAX_LENGTH),
            primaryMuscles: parseList(req.body.primaryMuscles),
            secondaryMuscles: parseList(req.body.secondaryMuscles),
            equipment: parseList(req.body.equipment),
            createdBy: req.user.userId,
            createdByUsername: req.user.username
        });

        const savedExercise = await customExercise.save();
        res.status(201).json(savedExercise);
    } catch (error) {
        res.status(400).json({ message: "Could not save custom exercise" });
    }
});

module.exports = router;
