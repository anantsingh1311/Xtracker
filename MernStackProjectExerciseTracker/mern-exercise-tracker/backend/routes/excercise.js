const router = require("express").Router();
const mongoose = require("mongoose");
const Excercise = require("../models/excercise-model");
const requireAuth = require("../middleware/require-auth");
const { estimateCaloriesBurned, INTENSITIES, LOAD_UNITS, WORKOUT_TYPES } = require("../utils/calorie-calculator");

const EXERCISE_DESCRIPTION_MAX_LENGTH = 160;
const MAX_FUTURE_WORKOUT_DAYS = 7;
const MIN_WORKOUT_DATE = new Date("2000-01-01T00:00:00.000Z");

function sanitizeDescription(value) {
    return typeof value === "string"
        ? value
            .normalize("NFKC")
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
        : "";
}

function parseIsoDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const latestAllowedDate = new Date(Date.now() + MAX_FUTURE_WORKOUT_DAYS * 24 * 60 * 60 * 1000);

    if (date < MIN_WORKOUT_DATE || date > latestAllowedDate) {
        return null;
    }

    return date;
}

function isValidObjectId(id) {
    return mongoose.isValidObjectId(id);
}

function buildEstimateInput(body = {}) {
    const description = sanitizeDescription(body.description);
    const duration = Number(body.duration);
    const sets = Number(body.sets ?? body.setCount);
    const reps = Number(body.reps ?? body.repsPerSet);
    const loadWeight = Number(body.loadWeight ?? 0);
    const weight = Number(body.weight);
    const weightUnit = body.weightUnit === "lb" || body.weightUnit === "kg" ? body.weightUnit : "";
    const intensity = typeof body.intensity === "string" ? body.intensity.trim().toLowerCase() : "";
    const workoutType = WORKOUT_TYPES.includes(body.workoutType)
        ? body.workoutType
        : Number.isFinite(sets) && sets > 0 && Number.isFinite(reps) && reps > 0
            ? "strength"
            : "cardio";
    const loadUnit = LOAD_UNITS.includes(body.loadUnit) ? body.loadUnit : weightUnit || "kg";

    if (!description) {
        return { ok: false, status: 400, message: "Exercise description is required." };
    }

    if (description.length > EXERCISE_DESCRIPTION_MAX_LENGTH) {
        return { ok: false, status: 400, message: "Exercise description is too long." };
    }

    if (!weightUnit) {
        return { ok: false, status: 400, message: "Weight unit must be kg or lb." };
    }

    if (!INTENSITIES.includes(intensity)) {
        return { ok: false, status: 400, message: "Select a light, moderate, or vigorous intensity." };
    }

    const estimate = estimateCaloriesBurned({
        description,
        durationMinutes: duration,
        intensity,
        loadUnit,
        loadWeight,
        reps,
        sets,
        weight,
        weightUnit,
        workoutType
    });

    if (!estimate.ok) {
        return { ok: false, status: 400, message: estimate.message };
    }

    return {
        ok: true,
        description,
        duration: estimate.durationMinutes,
        estimate,
        intensity,
        loadUnit,
        loadWeight,
        reps,
        sets,
        weight,
        weightUnit,
        workoutType: estimate.workoutType
    };
}

function applyExerciseEstimateFields(excercise, estimateInput, username, date) {
    const estimate = estimateInput.estimate;

    excercise.username = username;
    excercise.description = estimateInput.description;
    excercise.workoutType = estimate.workoutType;
    excercise.duration = estimate.durationMinutes;
    excercise.calories = estimate.calories;
    excercise.bodyWeightKg = estimate.bodyWeightKg;
    excercise.weightUnit = estimateInput.weightUnit;
    excercise.intensity = estimateInput.intensity;
    excercise.setCount = estimate.workoutType === "strength" ? estimate.setCount : null;
    excercise.repsPerSet = estimate.workoutType === "strength" ? estimate.repsPerSet : null;
    excercise.totalReps = estimate.workoutType === "strength" ? estimate.totalReps : null;
    excercise.loadWeight = estimate.workoutType === "strength" ? estimate.loadWeight : null;
    excercise.loadUnit = estimate.workoutType === "strength" ? estimate.loadUnit : estimateInput.weightUnit;
    excercise.loadWeightKg = estimate.workoutType === "strength" ? estimate.loadWeightKg : null;
    excercise.volumeLoadKg = estimate.workoutType === "strength" ? estimate.volumeLoadKg : null;
    excercise.metValue = estimate.metValue;
    excercise.activityCategory = estimate.activityCategory;
    excercise.calorieMethod = estimate.calorieMethod;
    excercise.date = date;
}

router.post("/estimate", requireAuth, (req, res) => {
    const estimateInput = buildEstimateInput(req.body);

    if (!estimateInput.ok) {
        return res.status(estimateInput.status).json({ message: estimateInput.message });
    }

    return res.json(estimateInput.estimate);
});

router.get("/id/:id", requireAuth, async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid exercise log id." });
    }

    try {
        const excercise = await Excercise.findById(req.params.id);

        if (!excercise) {
            return res.status(404).json({ message: "Exercise log not found" });
        }

        if (excercise.username !== req.user.username) {
            return res.status(403).json({ message: "Not allowed to view this exercise log" });
        }

        return res.json(excercise);
    } catch (error) {
        return res.status(400).json({ message: "Could not load this exercise log." });
    }
});

router.get("/:username", requireAuth, async (req, res) => {
    if (req.params.username !== req.user.username) {
        return res.status(403).json({ message: "Not allowed to view these exercise logs" });
    }

    try {
        const excerciseFound = await Excercise.find({ username: req.user.username }).sort({ date: -1, createdAt: -1 });
        return res.json(excerciseFound);
    } catch (error) {
        return res.status(400).json({ message: "Could not load exercises" });
    }
});

router.post("/add", requireAuth, async (req, res) => {
    const estimateInput = buildEstimateInput(req.body);
    const date = parseIsoDate(req.body?.date);

    if (!estimateInput.ok) {
        return res.status(estimateInput.status).json({ message: estimateInput.message });
    }

    if (!date) {
        return res.status(400).json({ message: "A valid workout date from 2000 through the next 7 days is required." });
    }

    try {
        const newExercise = new Excercise();
        applyExerciseEstimateFields(newExercise, estimateInput, req.user.username, date);

        await newExercise.save();

        return res.status(201).json({
            message: "Excercise added!",
            calories: estimateInput.estimate.calories,
            workoutType: estimateInput.estimate.workoutType
        });
    } catch (error) {
        return res.status(400).json({ message: "Could not save this exercise log." });
    }
});

router.delete("/:id", requireAuth, async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid exercise log id." });
    }

    try {
        const excercise = await Excercise.findById(req.params.id);

        if (!excercise) {
            return res.status(404).json({ message: "Exercise log not found" });
        }

        if (excercise.username !== req.user.username) {
            return res.status(403).json({ message: "Not allowed to delete this exercise log" });
        }

        await Excercise.findByIdAndDelete(req.params.id);
        return res.json({ message: "Excercise data deleted!" });
    } catch (error) {
        return res.status(400).json({ message: "Could not delete this exercise log." });
    }
});

router.post("/update/:id", requireAuth, async (req, res) => {
    const estimateInput = buildEstimateInput(req.body);
    const date = parseIsoDate(req.body?.date);

    if (!estimateInput.ok) {
        return res.status(estimateInput.status).json({ message: estimateInput.message });
    }

    if (!date) {
        return res.status(400).json({ message: "A valid workout date from 2000 through the next 7 days is required." });
    }

    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid exercise log id." });
    }

    try {
        const excercise = await Excercise.findById(req.params.id);

        if (!excercise) {
            return res.status(404).json({ message: "Exercise log not found" });
        }

        if (excercise.username !== req.user.username) {
            return res.status(403).json({ message: "Not allowed to update this exercise log" });
        }

        applyExerciseEstimateFields(excercise, estimateInput, req.user.username, date);

        await excercise.save();

        return res.json({
            message: "Excercise updated!",
            calories: estimateInput.estimate.calories,
            workoutType: estimateInput.estimate.workoutType
        });
    } catch (error) {
        return res.status(400).json({ message: "Could not update this exercise log." });
    }
});

module.exports = router;
