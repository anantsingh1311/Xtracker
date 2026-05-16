import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchCurrentUser, saveFitnessProfile } from "../services/api";
import { getStoredUser, mergeStoredUser, saveStoredUser } from "../utils/auth";
import { buildFitnessProfilePayload, calculateBmiFromForm, calculateWaistToHeightFromForm, createEmptyFitnessForm, hydrateFitnessForm } from "../utils/measurements";
import { showToast } from "../utils/toast";

const IN_TO_CM = 2.54;
const KG_TO_LB = 2.2046226218;
const KG_ENERGY_ESTIMATE = 7700;
const BMI_HEALTHY_MAX = 24.9;
const CALORIE_DEFICIT_PLANS = [
  ["Gentle", 250],
  ["Steady", 500],
  ["Higher", 750]
];
const METRIC_SLIDER_LIMITS = {
  height: ["100", "250"],
  neck: ["20", "70"],
  waist: ["45", "200"]
};
const IMPERIAL_SLIDER_LIMITS = {
  height: ["39.4", "98.4"],
  neck: ["8", "27.6"],
  waist: ["17.7", "78.7"]
};

function numberFrom(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundedString(value) {
  return String(Math.round(value * 10) / 10);
}

function convertMeasurement(value, convert) {
  const number = numberFrom(value);
  return number === null ? "" : roundedString(convert(number));
}

function getBodyWeightKg(form) {
  const weight = form.unitSystem === "imperial"
    ? numberFrom(form.bodyWeightLb) / KG_TO_LB
    : numberFrom(form.bodyWeightKg);

  return Number.isFinite(weight) && weight > 0 ? weight : null;
}

function getHeightCm(form) {
  const height = form.unitSystem === "imperial"
    ? (((numberFrom(form.heightFt) || 0) * 12) + (numberFrom(form.heightIn) || 0)) * IN_TO_CM
    : numberFrom(form.heightCm);

  return Number.isFinite(height) && height > 0 ? height : null;
}

function getWaistCm(form) {
  const waist = form.unitSystem === "imperial"
    ? numberFrom(form.waistIn) * IN_TO_CM
    : numberFrom(form.waistCm);

  return Number.isFinite(waist) && waist > 0 ? waist : null;
}

function getBmiSummary(bmi) {
  if (!bmi) {
    return ["Add weight", "Enter body weight to see the BMI screening summary."];
  }

  if (bmi < 18.5) {
    return ["Underweight", "Below the adult healthy range; focus on fueling, strength, and professional guidance before cutting calories."];
  }

  if (bmi < 25) {
    return ["Healthy range", "Inside the adult healthy BMI range; keep training consistency and watch waist-to-height trends."];
  }

  if (bmi < 30) {
    return ["Overweight", "Above the adult healthy BMI range; a modest calorie deficit can support gradual fat loss."];
  }

  if (bmi < 35) {
    return ["Obesity class 1", "A structured plan may help; BMI is a screening tool, so pair this with how you feel and clinician guidance."];
  }

  if (bmi < 40) {
    return ["Obesity class 2", "A higher-risk screening range; a slower, consistent plan is usually safer than aggressive restriction."];
  }

  return ["Obesity class 3", "A higher-risk screening range; consider medical guidance before starting a large calorie deficit."];
}

function getBodyFatRange(form) {
  const heightCm = getHeightCm(form);
  const waistCm = getWaistCm(form);

  if (!heightCm || !waistCm) {
    return "--";
  }

  const lower = Math.max(2, Math.min(75, 64 - (20 * (heightCm / waistCm))));
  const upper = Math.max(2, Math.min(75, 76 - (20 * (heightCm / waistCm))));

  return `${roundedString(lower)}-${roundedString(upper)}%`;
}

function formatPlanTime(days) {
  if (!Number.isFinite(days) || days <= 0) {
    return "--";
  }

  const weeks = days / 7;
  return weeks < 52 ? `${Math.ceil(weeks)} weeks` : `${(weeks / 52).toFixed(1)} years`;
}

function getCaloriePlanTimes(form, bmi) {
  const weightKg = getBodyWeightKg(form);
  const heightCm = getHeightCm(form);

  if (!bmi || bmi <= BMI_HEALTHY_MAX || !weightKg || !heightCm) {
    return [];
  }

  const targetWeightKg = BMI_HEALTHY_MAX * ((heightCm / 100) ** 2);
  const weightToLoseKg = weightKg - targetWeightKg;

  if (weightToLoseKg <= 0) {
    return [];
  }

  return CALORIE_DEFICIT_PLANS.map(([label, deficit]) => ({
    deficit,
    label,
    time: formatPlanTime((weightToLoseKg * KG_ENERGY_ESTIMATE) / deficit)
  }));
}

function withSliderDefaults(form) {
  if (form.unitSystem === "imperial") {
    return {
      ...form,
      heightFt: form.heightFt || "5",
      heightIn: form.heightIn || "9",
      neckIn: form.neckIn || "15",
      waistIn: form.waistIn || "34"
    };
  }

  return {
    ...form,
    heightCm: form.heightCm || "175",
    neckCm: form.neckCm || "38",
    waistCm: form.waistCm || "86"
  };
}

function readInitialProfile() {
  const profile = getStoredUser()?.fitnessProfile || {};
  return withSliderDefaults(profile.profileComplete ? hydrateFitnessForm(profile) : createEmptyFitnessForm(profile.preferredUnitSystem || "metric"));
}

export default function FitnessProfile() {
  const [form, setForm] = useState(readInitialProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const nextPath = location.state?.from && location.state.from !== "/profile"
    ? location.state.from
    : "/create";
  const bmi = calculateBmiFromForm(form);
  const waistToHeightRatio = calculateWaistToHeightFromForm(form);
  const isImperial = form.unitSystem === "imperial";
  const totalHeightIn = ((Number(form.heightFt) || 0) * 12) + (Number(form.heightIn) || 0);
  const heightSliderValue = isImperial ? totalHeightIn || 69 : form.heightCm;
  const heightLabel = isImperial
    ? `${Math.floor((totalHeightIn || 69) / 12)} ft ${roundedString((totalHeightIn || 69) % 12)} in`
    : `${form.heightCm} cm`;
  const neckValue = isImperial ? form.neckIn : form.neckCm;
  const waistValue = isImperial ? form.waistIn : form.waistCm;
  const sliderClass = "mt-2 w-full accent-cyan-600";
  const sliderLimits = isImperial ? IMPERIAL_SLIDER_LIMITS : METRIC_SLIDER_LIMITS;
  const [bmiCategory, bmiMessage] = getBmiSummary(bmi);
  const caloriePlanTimes = getCaloriePlanTimes(form, bmi);
  const bodyFatRange = getBodyFatRange(form);

  useEffect(() => {
    let isMounted = true;

    fetchCurrentUser()
      .then((user) => {
        if (!isMounted) {
          return;
        }

        mergeStoredUser({
          fitnessProfile: user.fitnessProfile,
          profileComplete: user.profileComplete
        });
        setForm(withSliderDefaults(user.fitnessProfile?.profileComplete ? hydrateFitnessForm(user.fitnessProfile) : createEmptyFitnessForm()));
        setError("");
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.response?.data?.message || "Could not load your profile.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateField = (field) => (event) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: event.target.value
    }));
  };

  const updateHeightSlider = (event) => {
    const totalInches = Number(event.target.value);
    const heightFt = Math.floor(totalInches / 12);

    setForm((currentForm) => ({
      ...currentForm,
      heightFt: String(heightFt),
      heightIn: roundedString(totalInches - (heightFt * 12))
    }));
  };

  const updateUnitSystem = (unitSystem) => {
    setForm((currentForm) => {
      if (currentForm.unitSystem === unitSystem) {
        return currentForm;
      }

      if (unitSystem === "imperial") {
        const heightCm = numberFrom(currentForm.heightCm);
        const totalInches = heightCm === null ? null : heightCm / IN_TO_CM;
        let heightFt = totalInches === null ? "" : Math.floor(totalInches / 12);
        let heightIn = totalInches === null ? "" : Math.round((totalInches - (heightFt * 12)) * 10) / 10;

        if (heightIn === 12) {
          heightFt += 1;
          heightIn = 0;
        }

        return withSliderDefaults({
          ...currentForm,
          bodyWeightLb: convertMeasurement(currentForm.bodyWeightKg, (value) => value * KG_TO_LB),
          heightFt: heightFt === "" ? "" : String(heightFt),
          heightIn: heightIn === "" ? "" : roundedString(heightIn),
          neckIn: convertMeasurement(currentForm.neckCm, (value) => value / IN_TO_CM),
          unitSystem,
          waistIn: convertMeasurement(currentForm.waistCm, (value) => value / IN_TO_CM)
        });
      }

      const heightFt = numberFrom(currentForm.heightFt);
      const heightIn = numberFrom(currentForm.heightIn);
      const totalInches = heightFt === null && heightIn === null ? null : ((heightFt || 0) * 12) + (heightIn || 0);

      return withSliderDefaults({
        ...currentForm,
        bodyWeightKg: convertMeasurement(currentForm.bodyWeightLb, (value) => value / KG_TO_LB),
        heightCm: totalInches === null ? "" : roundedString(totalInches * IN_TO_CM),
        neckCm: convertMeasurement(currentForm.neckIn, (value) => value * IN_TO_CM),
        unitSystem,
        waistCm: convertMeasurement(currentForm.waistIn, (value) => value * IN_TO_CM)
      });
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const response = await saveFitnessProfile({
        fitnessProfile: buildFitnessProfilePayload(form)
      });

      saveStoredUser(response);
      showToast({
        message: "Shaky can now personalize routines with your measurements.",
        title: "Profile saved",
        type: "success"
      });
      navigate(nextPath, { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not save your profile.");
      setIsSaving(false);
    }
  };

  return (
    <div className="page-fade mx-auto grid min-h-[calc(100vh-9rem)] max-w-6xl items-center gap-6 py-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="panel-fade rounded-3xl bg-slate-950 p-6 text-white shadow-2xl sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-200">Fitness profile</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Give Shaky better context.</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          XTracker uses these measurements to estimate BMI and waist-to-height ratio, then helps Shaky tailor workout, diet, and recovery guidance to the current member.
        </p>
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">Body overview</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <p className="text-sm font-bold text-slate-300">BMI <span className="block text-3xl font-black text-white">{bmi || "--"}</span></p>
            <p className="text-sm font-bold text-slate-300">RFM body fat <span className="block text-3xl font-black text-white">{bodyFatRange}</span></p>
            <p className="text-sm font-bold text-slate-300">Waist-to-height <span className="block text-3xl font-black text-white">{waistToHeightRatio || "--"}</span></p>
          </div>
          <p className="mt-3 text-sm font-black text-white">{bmiCategory}</p>
          <p className="mt-1 text-sm leading-6 text-slate-300">{bmiMessage}</p>
          {caloriePlanTimes.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {caloriePlanTimes.map((plan) => (
                <p key={plan.deficit} className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold text-slate-200">
                  {plan.label} {plan.deficit} kcal/day <span className="block text-sm font-black text-white">{plan.time}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="panel-fade rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-8">
        <h2 className="text-3xl font-black text-slate-950">Required Measurements</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Choose SI units or US units. XTracker stores normalized values securely for coaching.</p>

        <div className="mt-5 inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
          {[
            ["metric", "SI units"],
            ["imperial", "US units"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => updateUnitSystem(value)}
              className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${form.unitSystem === value ? "bg-slate-950 text-white shadow" : "text-slate-600 hover:bg-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-6 grid gap-5 sm:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Body Weight ({isImperial ? "lb" : "kg"})</label>
            <input
              type="number"
              required
              min={isImperial ? "55" : "25"}
              max={isImperial ? "770" : "350"}
              step="0.1"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              value={isImperial ? form.bodyWeightLb : form.bodyWeightKg}
              onChange={updateField(isImperial ? "bodyWeightLb" : "bodyWeightKg")}
              placeholder={isImperial ? "160" : "72"}
            />
          </div>

          {isImperial ? (
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Height</label>
              <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-900">{heightLabel}</p>
              <input
                type="range"
                min={sliderLimits.height[0]}
                max={sliderLimits.height[1]}
                step="0.1"
                className={sliderClass}
                value={heightSliderValue}
                onChange={updateHeightSlider}
              />
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Height (cm)</label>
              <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-900">{heightLabel}</p>
              <input
                type="range"
                min={sliderLimits.height[0]}
                max={sliderLimits.height[1]}
                step="0.1"
                className={sliderClass}
                value={form.heightCm}
                onChange={updateField("heightCm")}
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Neck ({isImperial ? "in" : "cm"})</label>
            <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-900">{neckValue} {isImperial ? "in" : "cm"}</p>
            <input
              type="range"
              min={sliderLimits.neck[0]}
              max={sliderLimits.neck[1]}
              step="0.1"
              className={sliderClass}
              value={neckValue}
              onChange={updateField(isImperial ? "neckIn" : "neckCm")}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Waist ({isImperial ? "in" : "cm"})</label>
            <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-900">{waistValue} {isImperial ? "in" : "cm"}</p>
            <input
              type="range"
              min={sliderLimits.waist[0]}
              max={sliderLimits.waist[1]}
              step="0.1"
              className={sliderClass}
              value={waistValue}
              onChange={updateField(isImperial ? "waistIn" : "waistCm")}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving || isLoading}
          className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
