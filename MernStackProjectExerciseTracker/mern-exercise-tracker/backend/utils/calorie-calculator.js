const LB_TO_KG = 0.45359237;
const INTENSITIES = ["light", "moderate", "vigorous"];
const DEFAULT_ACTIVITY_PROFILE = {
    category: "general fitness",
    mets: {
        light: 3.0,
        moderate: 4.5,
        vigorous: 6.0
    }
};

const activityProfiles = [
    {
        category: "running",
        pattern: /\b(run|running|jog|jogging|sprint|treadmill)\b/,
        mets: {
            light: 6.5,
            moderate: 8.5,
            vigorous: 11.0
        }
    },
    {
        category: "walking",
        pattern: /\b(walk|walking|hike|hiking)\b/,
        mets: {
            light: 2.8,
            moderate: 3.8,
            vigorous: 5.0
        }
    },
    {
        category: "cycling",
        pattern: /\b(cycle|cycling|bike|biking|spin|spinning)\b/,
        mets: {
            light: 4.3,
            moderate: 7.0,
            vigorous: 10.0
        }
    },
    {
        category: "rowing cardio",
        pattern: /\b(rower|rowing machine|erg)\b/,
        mets: {
            light: 4.8,
            moderate: 7.0,
            vigorous: 8.5
        }
    },
    {
        category: "swimming",
        pattern: /\b(swim|swimming)\b/,
        mets: {
            light: 6.0,
            moderate: 8.3,
            vigorous: 10.0
        }
    },
    {
        category: "elliptical",
        pattern: /\b(elliptical|cross trainer)\b/,
        mets: {
            light: 4.5,
            moderate: 5.8,
            vigorous: 7.0
        }
    },
    {
        category: "stairs",
        pattern: /\b(stair|stairs|stepper|step mill)\b/,
        mets: {
            light: 4.0,
            moderate: 6.8,
            vigorous: 9.0
        }
    },
    {
        category: "jump rope",
        pattern: /\b(jump rope|skipping)\b/,
        mets: {
            light: 8.8,
            moderate: 10.8,
            vigorous: 12.3
        }
    },
    {
        category: "high intensity intervals",
        pattern: /\b(hiit|burpee|burpees|crossfit|circuit training)\b/,
        mets: {
            light: 7.0,
            moderate: 9.0,
            vigorous: 11.5
        }
    },
    {
        category: "yoga or mobility",
        pattern: /\b(yoga|mobility|stretch|stretching)\b/,
        mets: {
            light: 2.3,
            moderate: 3.0,
            vigorous: 4.0
        }
    },
    {
        category: "pilates",
        pattern: /\b(pilates)\b/,
        mets: {
            light: 3.0,
            moderate: 3.5,
            vigorous: 4.0
        }
    },
    {
        category: "core training",
        pattern: /\b(plank|planks|crunch|crunches|sit-up|sit ups|core)\b/,
        mets: {
            light: 3.0,
            moderate: 4.0,
            vigorous: 5.0
        }
    },
    {
        category: "strength training",
        pattern: /\b(bench press|squat|deadlift|overhead press|shoulder press|dumbbell|barbell|kettlebell|push-up|push up|pull-up|pull up|chin-up|chin up|lunge|curl|lat pulldown|leg press|weight training|strength|resistance)\b/,
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

function getActivityProfile(description) {
    const normalizedDescription = typeof description === "string"
        ? description.toLowerCase()
        : "";

    return activityProfiles.find((profile) => profile.pattern.test(normalizedDescription))
        || DEFAULT_ACTIVITY_PROFILE;
}

function estimateCaloriesBurned({ description, durationMinutes, intensity, weight, weightUnit = "kg" }) {
    const normalizedIntensity = normalizeIntensity(intensity);
    const normalizedDuration = Number(durationMinutes);
    const bodyWeightKg = normalizeWeight(weight, weightUnit);

    if (!description || typeof description !== "string" || !description.trim()) {
        return {
            ok: false,
            message: "Exercise description is required to estimate calories."
        };
    }

    if (!Number.isFinite(normalizedDuration) || normalizedDuration <= 0) {
        return {
            ok: false,
            message: "Duration must be greater than zero."
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

    const profile = getActivityProfile(description);
    const metValue = profile.mets[normalizedIntensity];
    const caloriesPerMinute = (metValue * 3.5 * bodyWeightKg) / 200;
    const calories = Math.round(caloriesPerMinute * normalizedDuration);

    return {
        ok: true,
        activityCategory: profile.category,
        bodyWeightKg: roundTo(bodyWeightKg, 1),
        calorieMethod: "met-compendium-standard-v1",
        calories,
        caloriesPerMinute: roundTo(caloriesPerMinute, 1),
        intensity: normalizedIntensity,
        metValue: roundTo(metValue, 1)
    };
}

module.exports = {
    estimateCaloriesBurned,
    INTENSITIES
};
