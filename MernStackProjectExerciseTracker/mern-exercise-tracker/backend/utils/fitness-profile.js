const IN_TO_CM = 2.54;
const KG_TO_LB = 2.2046226218;
const LB_TO_KG = 0.45359237;
const PROFILE_FIELDS = {
    bodyWeightKg: { label: "Body weight", min: 25, max: 350 },
    heightCm: { label: "Height", min: 100, max: 250 },
    neckCm: { label: "Neck circumference" },
    waistCm: { label: "Waist circumference" }
};

function roundTo(value, decimals = 1) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function readNumber(value) {
    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}

function calculateBmi(bodyWeightKg, heightCm) {
    const heightM = Number(heightCm) / 100;

    if (!Number.isFinite(heightM) || heightM <= 0) {
        return null;
    }

    return roundTo(Number(bodyWeightKg) / (heightM ** 2), 1);
}

function calculateWaistToHeightRatio(waistCm, heightCm) {
    if (!Number.isFinite(Number(waistCm)) || !Number.isFinite(Number(heightCm)) || Number(heightCm) <= 0) {
        return null;
    }

    return roundTo(Number(waistCm) / Number(heightCm), 2);
}

function getBmiCategory(bmi) {
    if (!Number.isFinite(Number(bmi))) {
        return "";
    }

    if (bmi < 18.5) {
        return "underweight";
    }

    if (bmi < 25) {
        return "healthy";
    }

    if (bmi < 30) {
        return "overweight";
    }

    return "obese";
}

function normalizeFitnessProfile(input = {}) {
    const source = input.fitnessProfile && typeof input.fitnessProfile === "object"
        ? input.fitnessProfile
        : input;
    const unitSystem = source.unitSystem === "imperial" ? "imperial" : "metric";
    const profile = {};

    if (unitSystem === "imperial") {
        const bodyWeightLb = readNumber(source.bodyWeightLb);
        const heightFt = readNumber(source.heightFt);
        const heightIn = readNumber(source.heightIn) || 0;
        const neckIn = readNumber(source.neckIn);
        const waistIn = readNumber(source.waistIn);

        profile.bodyWeightKg = bodyWeightLb === null ? null : bodyWeightLb * LB_TO_KG;
        profile.heightCm = heightFt === null ? null : ((heightFt * 12) + heightIn) * IN_TO_CM;
        profile.neckCm = neckIn === null ? null : neckIn * IN_TO_CM;
        profile.waistCm = waistIn === null ? null : waistIn * IN_TO_CM;
    } else {
        for (const field of Object.keys(PROFILE_FIELDS)) {
            profile[field] = readNumber(source[field]);
        }
    }

    for (const [field, rules] of Object.entries(PROFILE_FIELDS)) {
        const value = profile[field];

        if (value === null) {
            return {
                ok: false,
                message: `${rules.label} must be a number.`
            };
        }

        const isBelowMinimum = rules.min !== undefined && value < rules.min;
        const isAboveMaximum = rules.max !== undefined && value > rules.max;

        if (isBelowMinimum || isAboveMaximum) {
            return {
                ok: false,
                message: `${rules.label} must be between ${rules.min} and ${rules.max}.`
            };
        }

        profile[field] = roundTo(value, 1);
    }

    const bmi = calculateBmi(profile.bodyWeightKg, profile.heightCm);
    const waistToHeightRatio = calculateWaistToHeightRatio(profile.waistCm, profile.heightCm);

    return {
        ok: true,
        profile: {
            ...profile,
            bmi,
            bmiCategory: getBmiCategory(bmi),
            preferredUnitSystem: unitSystem,
            waistToHeightRatio,
            updatedAt: new Date()
        }
    };
}

function buildFitnessProfilePayload(user) {
    const profile = user?.fitnessProfile || {};
    const bodyWeightKg = readNumber(profile.bodyWeightKg);
    const heightCm = readNumber(profile.heightCm);
    const neckCm = readNumber(profile.neckCm);
    const waistCm = readNumber(profile.waistCm);
    const profileComplete = bodyWeightKg !== null && heightCm !== null && neckCm !== null && waistCm !== null;
    const bmi = profileComplete ? calculateBmi(bodyWeightKg, heightCm) : null;
    const waistToHeightRatio = profileComplete ? calculateWaistToHeightRatio(waistCm, heightCm) : null;
    const preferredUnitSystem = profile.preferredUnitSystem === "imperial" ? "imperial" : "metric";
    const heightTotalIn = profileComplete ? heightCm / IN_TO_CM : null;
    const heightFt = heightTotalIn === null ? null : Math.floor(heightTotalIn / 12);
    const heightIn = heightTotalIn === null ? null : roundTo(heightTotalIn - (heightFt * 12), 1);

    return {
        bodyWeightKg: profileComplete ? roundTo(bodyWeightKg, 1) : null,
        bodyWeightLb: profileComplete ? roundTo(bodyWeightKg * KG_TO_LB, 1) : null,
        heightCm: profileComplete ? roundTo(heightCm, 1) : null,
        heightFt,
        heightIn,
        heightTotalIn: heightTotalIn === null ? null : roundTo(heightTotalIn, 1),
        neckCm: profileComplete ? roundTo(neckCm, 1) : null,
        neckIn: profileComplete ? roundTo(neckCm / IN_TO_CM, 1) : null,
        preferredUnitSystem,
        waistCm: profileComplete ? roundTo(waistCm, 1) : null,
        waistIn: profileComplete ? roundTo(waistCm / IN_TO_CM, 1) : null,
        waistToHeightRatio,
        bmi,
        bmiCategory: bmi ? getBmiCategory(bmi) : "",
        profileComplete,
        updatedAt: profile.updatedAt || null
    };
}

module.exports = {
    buildFitnessProfilePayload,
    calculateBmi,
    calculateWaistToHeightRatio,
    getBmiCategory,
    normalizeFitnessProfile,
    PROFILE_LIMITS: PROFILE_FIELDS
};
