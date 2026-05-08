import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchCurrentUser, saveFitnessProfile } from "../services/api";
import { getStoredUser, mergeStoredUser, saveStoredUser } from "../utils/auth";
import { buildFitnessProfilePayload, calculateBmiFromForm, calculateWaistToHeightFromForm, createEmptyFitnessForm, hydrateFitnessForm } from "../utils/measurements";
import { showToast } from "../utils/toast";

function readInitialProfile() {
  const profile = getStoredUser()?.fitnessProfile || {};
  return profile.profileComplete ? hydrateFitnessForm(profile) : createEmptyFitnessForm(profile.preferredUnitSystem || "metric");
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
        setForm(user.fitnessProfile?.profileComplete ? hydrateFitnessForm(user.fitnessProfile) : createEmptyFitnessForm());
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

  const updateUnitSystem = (unitSystem) => {
    setForm((currentForm) => {
      if (currentForm.unitSystem === unitSystem) {
        return currentForm;
      }

      return {
        ...createEmptyFitnessForm(unitSystem),
        unitSystem
      };
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
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">Estimated BMI</p>
          <p className="mt-2 text-4xl font-black">{bmi || "--"}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">Waist-to-height ratio: {waistToHeightRatio || "--"}. BMI is a rough screening estimate, not a medical diagnosis.</p>
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
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  required
                  min="3"
                  max="8"
                  step="1"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  value={form.heightFt}
                  onChange={updateField("heightFt")}
                  placeholder="ft"
                />
                <input
                  type="number"
                  min="0"
                  max="11.9"
                  step="0.1"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  value={form.heightIn}
                  onChange={updateField("heightIn")}
                  placeholder="in"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Height (cm)</label>
              <input
                type="number"
                required
                min="100"
                max="250"
                step="0.1"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                value={form.heightCm}
                onChange={updateField("heightCm")}
                placeholder="175"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Neck ({isImperial ? "in" : "cm"})</label>
            <input
              type="number"
              required
              step="0.1"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              value={isImperial ? form.neckIn : form.neckCm}
              onChange={updateField(isImperial ? "neckIn" : "neckCm")}
              placeholder={isImperial ? "15" : "38"}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Waist ({isImperial ? "in" : "cm"})</label>
            <input
              type="number"
              required
              step="0.1"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              value={isImperial ? form.waistIn : form.waistCm}
              onChange={updateField(isImperial ? "waistIn" : "waistCm")}
              placeholder={isImperial ? "34" : "86"}
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
