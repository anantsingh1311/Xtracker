import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import { useParams, useNavigate } from "react-router-dom";
import { get, post } from "../services/api";
import "react-datepicker/dist/react-datepicker.css";

const LAST_WORKOUT_PROFILE_KEY = "xt_last_workout_profile";
const LB_TO_KG = 0.45359237;

function readSavedWorkoutProfile() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(LAST_WORKOUT_PROFILE_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function saveWorkoutProfile(profile) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LAST_WORKOUT_PROFILE_KEY, JSON.stringify(profile));
  }
}

function convertStoredWeightToDisplay(bodyWeightKg, weightUnit) {
  if (!bodyWeightKg) {
    return "";
  }

  if (weightUnit === "lb") {
    return Math.round((Number(bodyWeightKg) / LB_TO_KG) * 10) / 10;
  }

  return bodyWeightKg;
}

export default function EditExercise() {
  const { id } = useParams();
  const navigate = useNavigate();
  const savedProfile = readSavedWorkoutProfile();

  const [username, setUsername] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [date, setDate] = useState(new Date());
  const [bodyWeight, setBodyWeight] = useState(savedProfile.bodyWeight || "");
  const [weightUnit, setWeightUnit] = useState(savedProfile.weightUnit || "kg");
  const [intensity, setIntensity] = useState(savedProfile.intensity || "moderate");
  const [calorieEstimate, setCalorieEstimate] = useState(null);
  const [estimateMeta, setEstimateMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [error, setError] = useState("");
  const [estimateError, setEstimateError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadExercise = async () => {
      setIsLoading(true);

      try {
        const exercise = await get(`/exercise/id/${id}`);

        if (!isMounted) {
          return;
        }

        setUsername(exercise.username);
        setDescription(exercise.description);
        setDuration(exercise.duration);
        setWeightUnit(exercise.weightUnit || "kg");
        setBodyWeight(convertStoredWeightToDisplay(exercise.bodyWeightKg, exercise.weightUnit || "kg"));
        setIntensity(exercise.intensity || "moderate");
        setCalorieEstimate(exercise.calories || 0);
        setEstimateMeta({
          activityCategory: exercise.activityCategory,
          metValue: exercise.metValue
        });
        setDate(new Date(exercise.date));
        setError("");
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error(err);
        }

        if (isMounted) {
          setError("Could not load this exercise log.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadExercise();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!description || Number(duration) <= 0 || Number(bodyWeight) <= 0 || !intensity) {
      setCalorieEstimate(null);
      setEstimateMeta(null);
      setEstimateError("");
      setIsEstimating(false);
      return undefined;
    }

    let isMounted = true;
    const timerId = window.setTimeout(async () => {
      setIsEstimating(true);
      setEstimateError("");

      try {
        const estimate = await post("/exercise/estimate", {
          description,
          duration: Number(duration),
          intensity,
          weight: Number(bodyWeight),
          weightUnit
        });

        if (!isMounted) {
          return;
        }

        setCalorieEstimate(estimate.calories);
        setEstimateMeta(estimate);
        setEstimateError("");
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setCalorieEstimate(null);
        setEstimateMeta(null);
        setEstimateError(err.response?.data?.message || "Could not estimate calories right now.");
      } finally {
        if (isMounted) {
          setIsEstimating(false);
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      window.clearTimeout(timerId);
    };
  }, [bodyWeight, description, duration, intensity, weightUnit]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError("");

    const exercise = {
      username,
      description,
      duration,
      intensity,
      weight: bodyWeight,
      weightUnit,
      date,
    };

    try {
      await post(`/exercise/update/${id}`, exercise);
      saveWorkoutProfile({
        bodyWeight,
        intensity,
        weightUnit
      });
      navigate("/Excercises");
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error(err);
      }
      setError(err.response?.data?.message || "Could not save your updates.");
      setIsSaving(false);
    }
  };

  return (
    <div className="page-fade mx-auto max-w-5xl py-6">
      <div className="overflow-hidden rounded-3xl bg-slate-950 shadow-xl">
        <div className="bg-gradient-to-r from-rose-500 via-orange-400 to-lime-300 px-6 py-1" />
        <div className="p-6 text-white md:p-8">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-rose-200">Workout history</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Edit Exercise Log</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Update the exercise, duration, body weight, intensity, or date and XTracker will recalculate calories automatically.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-6 rounded-3xl bg-white p-6 text-center text-sm font-bold text-slate-600 shadow-lg">
          Loading exercise log...
        </p>
      ) : (
        <form onSubmit={onSubmit} className="panel-fade mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-lg md:p-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-bold text-slate-700">Username</label>
              <input
                type="text"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                value={username}
                disabled
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-bold text-slate-700">Exercise Description</label>
              <input
                type="text"
                required
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Duration (minutes)</label>
              <input
                type="number"
                min="1"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Intensity</label>
              <select
                value={intensity}
                onChange={(e) => setIntensity(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
              >
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="vigorous">Vigorous</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-bold text-slate-700">Body Weight</label>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <input
                  type="number"
                  min="25"
                  step="0.1"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                  value={bodyWeight}
                  onChange={(e) => setBodyWeight(e.target.value)}
                />
                <select
                  value={weightUnit}
                  onChange={(e) => setWeightUnit(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                >
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </select>
              </div>
            </div>

            <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Estimated calories</p>
                  <p className="mt-2 text-4xl font-black text-slate-950">{calorieEstimate !== null ? calorieEstimate : "--"}</p>
                </div>
                {estimateMeta && (
                  <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Method</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{estimateMeta.metValue} MET</p>
                    <p className="text-xs text-slate-500">{estimateMeta.activityCategory}</p>
                  </div>
                )}
              </div>

              {isEstimating && (
                <p className="mt-3 text-sm font-semibold text-slate-500">Updating estimate...</p>
              )}

              {estimateError && (
                <p className="mt-3 text-sm font-semibold text-red-700">{estimateError}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-bold text-slate-700">Date</label>
              <DatePicker
                selected={date}
                onChange={(d) => setDate(d)}
                wrapperClassName="w-full"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
              />
            </div>
          </div>

          {error && (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      )}
    </div>
  );
}
