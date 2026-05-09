const LB_TO_KG = 0.45359237;
const INTENSITIES = ["light", "moderate", "vigorous"];
const WORKOUT_TYPES = ["cardio", "strength"];
const LOAD_UNITS = ["kg", "lb"];
const DEFAULT_ACTIVITY_PROFILE = {
    category: "general fitness",
    workoutType: "cardio",
    mets: {
        light: 3.0,
        moderate: 4.5,
        vigorous: 6.0
    }
};

const activityProfiles = [
    {
        category: "running",
        workoutType: "cardio",
        pattern: /\b(run|running|jog|jogging|sprint|treadmill)\b/,
        mets: {
            light: 6.5,
            moderate: 8.5,
            vigorous: 11.0
        }
    },
    {
        category: "walking",
        workoutType: "cardio",
        pattern: /\b(walk|walking|hike|hiking)\b/,
        mets: {
            light: 2.8,
            moderate: 3.8,
            vigorous: 5.0
        }
    },
    {
        category: "cycling",
        workoutType: "cardio",
        pattern: /\b(cycle|cycling|bike|biking|spin|spinning)\b/,
        mets: {
            light: 4.3,
            moderate: 7.0,
            vigorous: 10.0
        }
    },
    {
        category: "rowing cardio",
        workoutType: "cardio",
        pattern: /\b(rower|rowing machine|erg)\b/,
        mets: {
            light: 4.8,
            moderate: 7.0,
            vigorous: 8.5
        }
    },
    {
        category: "swimming",
        workoutType: "cardio",
        pattern: /\b(swim|swimming)\b/,
        mets: {
            light: 6.0,
            moderate: 8.3,
            vigorous: 10.0
        }
    },
    {
        category: "elliptical",
        workoutType: "cardio",
        pattern: /\b(elliptical|cross trainer)\b/,
        mets: {
            light: 4.5,
            moderate: 5.8,
            vigorous: 7.0
        }
    },
    {
        category: "stairs",
        workoutType: "cardio",
        pattern: /\b(stair|stairs|stepper|step mill)\b/,
        mets: {
            light: 4.0,
            moderate: 6.8,
            vigorous: 9.0
        }
    },
    {
        category: "jump rope",
        workoutType: "cardio",
        pattern: /\b(jump rope|skipping)\b/,
        mets: {
            light: 8.8,
            moderate: 10.8,
            vigorous: 12.3
        }
    },
    {
        category: "high intensity intervals",
        workoutType: "cardio",
        pattern: /\b(hiit|burpee|burpees|crossfit|circuit training)\b/,
        mets: {
            light: 7.0,
            moderate: 9.0,
            vigorous: 11.5
        }
    },
    {
        category: "yoga or mobility",
        workoutType: "cardio",
        pattern: /\b(yoga|mobility|stretch|stretching)\b/,
        mets: {
            light: 2.3,
            moderate: 3.0,
            vigorous: 4.0
        }
    },
    {
        category: "pilates",
        workoutType: "strength",
        pattern: /\b(pilates)\b/,
        mets: {
            light: 3.0,
            moderate: 3.5,
            vigorous: 4.0
        }
    },
    {
        category: "core training",
        workoutType: "strength",
        pattern: /\b(plank|planks|crunch|crunches|sit-up|sit ups|core)\b/,
        mets: {
            light: 3.0,
            moderate: 4.0,
            vigorous: 5.0
        }
    },
    {
        category: "strength training",
        workoutType: "strength",
        pattern: /\b(bench press|squat|deadlift|overhead press|shoulder press|dumbbell|barbell|kettlebell|push-up|push up|pull-up|pull up|chin-up|chin up|lunge|curl|lat pulldown|leg press|weight training|strength|resistance|pushup|pullup|row|press|fly|raise|extension)\b/,
        mets: {
            light: 3.5,
            moderate: 5.0,
            vigorous: 6.0
        }
    }
];

function roundTo(value, decimals = 1) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function normalizeIntensity(value) {
    const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";
    return INTENSITIES.includes(normalizedValue) ? normalizedValue : null;
}

function normalizeWorkoutType(value, description) {
    const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";

    if (WORKOUT_TYPES.includes(normalizedValue)) {
        return normalizedValue;
    }

    return getActivityProfile(description).workoutType;
}

function normalizeWeight(weight, unit) {
    const numericWeight = Number(weight);

    if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
        return null;
    }

    if (unit === "lb") {
        return numericWeight * LB_TO_KG;
    }

    return numericWeight;
}

function normalizeLoadUnit(unit, fallbackUnit = "kg") {
    return LOAD_UNITS.includes(unit) ? unit : fallbackUnit === "lb" ? "lb" : "kg";
}

function normalizeLoadWeight(weight, unit) {
    const numericWeight = Number(weight || 0);

    if (!Number.isFinite(numericWeight) || numericWeight < 0) {
        return null;
    }

    if (unit === "lb") {
        return numericWeight * LB_TO_KG;
    }

    return numericWeight;
}

function getActivityProfile(description) {
    const normalizedDescription = typeof description === "string"
        ? description.toLowerCase()
        : "";

    return activityProfiles.find((profile) => profile.pattern.test(normalizedDescription))
        || DEFAULT_ACTIVITY_PROFILE;
}

function estimateStrengthDurationMinutes(setCount, repsPerSet, intensity) {
    const totalReps = setCount * repsPerSet;
    const secondsPerRep = {
        light: 3.2,
        moderate: 3.8,
        vigorous: 4.5
    }[intensity] || 3.8;
    const restSeconds = {
        light: 35,
        moderate: 60,
        vigorous: 90
    }[intensity] || 60;
    const minimumMinutesPerSet = {
        light: 1.5,
        moderate: 2.25,
        vigorous: 2.75
    }[intensity] || 2.25;
    const activeSeconds = totalReps * secondsPerRep;
    const restTotalSeconds = Math.max(setCount - 1, 0) * restSeconds;

    return roundTo(Math.max((activeSeconds + restTotalSeconds) / 60, setCount * minimumMinutesPerSet, 1), 1);
}

function estimateStrengthCalories({ bodyWeightKg, description, intensity, loadWeight, loadUnit, reps, sets, weightUnit }) {
    const setCount = Number(sets);
    const repsPerSet = Number(reps);
    const normalizedLoadUnit = normalizeLoadUnit(loadUnit, weightUnit);
    const loadWeightKg = normalizeLoadWeight(loadWeight, normalizedLoadUnit);

    if (!Number.isInteger(setCount) || setCount < 1 || setCount > 50) {
        return {
            ok: false,
            message: "Strength logs need between 1 and 50 sets."
        };
    }

    if (!Number.isInteger(repsPerSet) || repsPerSet < 1 || repsPerSet > 200) {
        return {
            ok: false,
            message: "Strength logs need between 1 and 200 repetitions per set."
        };
    }

    if (loadWeightKg === null || loadWeightKg > 1000) {
        return {
            ok: false,
            message: "Lifted weight must be between 0 and 1000 kg."
        };
    }

    const profile = getActivityProfile(description);
    const metValue = profile.workoutType === "strength"
        ? profile.mets[intensity]
        : activityProfiles.find((item) => item.category === "strength training").mets[intensity];
    const durationMinutes = estimateStrengthDurationMinutes(setCount, repsPerSet, intensity);
    const totalReps = setCount * repsPerSet;
    const volumeLoadKg = loadWeightKg * totalReps;
    const caloriesPerMinute = (metValue * 3.5 * bodyWeightKg) / 200;
    const relativeLoad = bodyWeightKg > 0 ? loadWeightKg / bodyWeightKg : 0;
    const volumeMultiplier = 1 + Math.min(relativeLoad * 0.22, 0.4) + Math.min(totalReps / 600, 0.18);
    const calories = Math.round(caloriesPerMinute * durationMinutes * volumeMultiplier);

    return {
        ok: true,
        activityCategory: profile.workoutType === "strength" ? profile.category : "strength training",
        bodyWeightKg: roundTo(bodyWeightKg, 1),
        calorieMethod: "strength-volume-load-v1",
        calories,
        caloriesPerMinute: roundTo(calories / durationMinutes, 1),
        durationMinutes,
        intensity,
        loadUnit: normalizedLoadUnit,
        loadWeight: roundTo(Number(loadWeight || 0), 1),
        loadWeightKg: roundTo(loadWeightKg, 1),
        metValue: roundTo(metValue, 1),
        repsPerSet,
        setCount,
        totalReps,
        volumeLoadKg: roundTo(volumeLoadKg, 1),
        workoutType: "strength"
    };
}

function estimateCardioCalories({ bodyWeightKg, description, durationMinutes, intensity }) {
    const normalizedDuration = Number(durationMinutes);

    if (!Number.isFinite(normalizedDuration) || normalizedDuration <= 0 || normalizedDuration > 600) {
        return {
            ok: false,
            message: "Cardio duration must be between 1 and 600 minutes."
        };
    }

    const profile = getActivityProfile(description);
    const metValue = profile.mets[intensity];
    const caloriesPerMinute = (metValue * 3.5 * bodyWeightKg) / 200;
    const calories = Math.round(caloriesPerMinute * normalizedDuration);

    return {
        ok: true,
        activityCategory: profile.category,
        bodyWeightKg: roundTo(bodyWeightKg, 1),
        calorieMethod: "met-compendium-standard-v1",
        calories,
        caloriesPerMinute: roundTo(caloriesPerMinute, 1),
        durationMinutes: normalizedDuration,
        intensity,
        metValue: roundTo(metValue, 1),
        workoutType: "cardio"
    };
}

function estimateCaloriesBurned({
    description,
    durationMinutes,
    intensity,
    loadUnit,
    loadWeight,
    reps,
    sets,
    weight,
    weightUnit = "kg",
    workoutType
}) {
    const normalizedIntensity = normalizeIntensity(intensity);
    const bodyWeightKg = normalizeWeight(weight, weightUnit);

    if (!description || typeof description !== "string" || !description.trim()) {
        return {
            ok: false,
            message: "Exercise description is required to estimate calories."
        };
    }

    if (!bodyWeightKg || bodyWeightKg < 25 || bodyWeightKg > 350) {
        return {
            ok: false,
            message: "Body weight must be between 25 kg and 350 kg."
        };
    }

    if (!normalizedIntensity) {
        return {
            ok: false,
            message: "Intensity must be light, moderate, or vigorous."
        };
    }

    const normalizedWorkoutType = normalizeWorkoutType(workoutType, description);

    if (normalizedWorkoutType === "strength") {
        return estimateStrengthCalories({
            bodyWeightKg,
            description,
            intensity: normalizedIntensity,
            loadUnit,
            loadWeight,
            reps,
            sets,
            weightUnit
        });
    }

    return estimateCardioCalories({
        bodyWeightKg,
        description,
        durationMinutes,
        intensity: normalizedIntensity
    });
}

module.exports = {
    estimateCaloriesBurned,
    INTENSITIES,
    LOAD_UNITS,
    WORKOUT_TYPES
};
