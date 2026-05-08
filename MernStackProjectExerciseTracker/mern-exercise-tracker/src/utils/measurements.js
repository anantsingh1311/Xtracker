const IN_TO_CM = 2.54;
const KG_TO_LB = 2.2046226218;

function roundTo(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

function numericOrEmpty(value) {
  return value === null || value === undefined || value === "" ? "" : String(value);
}

export function createEmptyFitnessForm(unitSystem = "metric") {
  return {
    bodyWeightKg: "",
    bodyWeightLb: "",
    heightCm: "",
    heightFt: "",
    heightIn: "",
    neckCm: "",
    neckIn: "",
    unitSystem,
    waistCm: "",
    waistIn: ""
  };
}

export function hydrateFitnessForm(profile = {}) {
  const unitSystem = profile.preferredUnitSystem === "imperial" ? "imperial" : "metric";

  return {
    ...createEmptyFitnessForm(unitSystem),
    bodyWeightKg: numericOrEmpty(profile.bodyWeightKg),
    bodyWeightLb: numericOrEmpty(profile.bodyWeightLb),
    heightCm: numericOrEmpty(profile.heightCm),
    heightFt: numericOrEmpty(profile.heightFt),
    heightIn: numericOrEmpty(profile.heightIn),
    neckCm: numericOrEmpty(profile.neckCm),
    neckIn: numericOrEmpty(profile.neckIn),
    waistCm: numericOrEmpty(profile.waistCm),
    waistIn: numericOrEmpty(profile.waistIn)
  };
}

export function buildFitnessProfilePayload(form) {
  if (form.unitSystem === "imperial") {
    return {
      unitSystem: "imperial",
      bodyWeightLb: Number(form.bodyWeightLb),
      heightFt: Number(form.heightFt),
      heightIn: Number(form.heightIn || 0),
      neckIn: Number(form.neckIn),
      waistIn: Number(form.waistIn)
    };
  }

  return {
    unitSystem: "metric",
    bodyWeightKg: Number(form.bodyWeightKg),
    heightCm: Number(form.heightCm),
    neckCm: Number(form.neckCm),
    waistCm: Number(form.waistCm)
  };
}

export function calculateBmiFromForm(form) {
  const bodyWeightKg = form.unitSystem === "imperial"
    ? Number(form.bodyWeightLb) / KG_TO_LB
    : Number(form.bodyWeightKg);
  const heightCm = form.unitSystem === "imperial"
    ? ((Number(form.heightFt) * 12) + Number(form.heightIn || 0)) * IN_TO_CM
    : Number(form.heightCm);
  const heightM = heightCm / 100;

  if (!Number.isFinite(bodyWeightKg) || !Number.isFinite(heightM) || bodyWeightKg <= 0 || heightM <= 0) {
    return null;
  }

  return roundTo(bodyWeightKg / (heightM ** 2), 1);
}

export function calculateWaistToHeightFromForm(form) {
  const waistCm = form.unitSystem === "imperial"
    ? Number(form.waistIn) * IN_TO_CM
    : Number(form.waistCm);
  const heightCm = form.unitSystem === "imperial"
    ? ((Number(form.heightFt) * 12) + Number(form.heightIn || 0)) * IN_TO_CM
    : Number(form.heightCm);

  if (!Number.isFinite(waistCm) || !Number.isFinite(heightCm) || waistCm <= 0 || heightCm <= 0) {
    return null;
  }

  return roundTo(waistCm / heightCm, 2);
}
