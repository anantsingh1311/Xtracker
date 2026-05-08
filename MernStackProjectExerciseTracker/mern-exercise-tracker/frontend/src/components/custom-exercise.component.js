import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCustomExercises, post } from "../services/api";
import { getStoredUser } from "../utils/auth";

const initialFormState = {
  name: "",
  category: "",
  primaryMuscles: "",
  secondaryMuscles: "",
  equipment: "",
  instructions: ""
};

export default function CustomExerciseManager() {
  const [form, setForm] = useState(initialFormState);
  const [customExercises, setCustomExercises] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const currentUser = getStoredUser();

  useEffect(() => {
    let isMounted = true;

    const loadCustomExercises = async () => {
      try {
        const exercises = await fetchCustomExercises();

        if (isMounted) {
          setCustomExercises(exercises);
          setError("");
        }
      } catch (loadError) {
        if (isMounted) {
          setError("Could not load your custom exercises right now.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadCustomExercises();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const savedExercise = await post("/api/custom-exercises", form);

      setCustomExercises((currentExercises) => [savedExercise, ...currentExercises]);
      setForm(initialFormState);
      setMessage("Custom exercise saved. You can now find it in your exercise search.");
    } catch (saveError) {
      setError(saveError.response?.data?.message || "Could not save this custom exercise.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-fade mx-auto max-w-6xl py-6">
      <div className="overflow-hidden rounded-3xl bg-slate-950 shadow-xl">
        <div className="bg-gradient-to-r from-lime-400 via-cyan-400 to-blue-500 px-6 py-1" />
        <div className="grid gap-6 p-6 text-white md:grid-cols-[1fr_auto] md:items-end md:p-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-lime-200">Custom exercise library</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Add your own exercise definitions</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Signed-in members can save custom exercises to the database, then reuse them inside exercise search and workout logs.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm font-semibold text-slate-300">Signed in as</p>
            <p className="mt-2 text-3xl font-black">{currentUser?.username || "Member"}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={handleSubmit} className="panel-fade rounded-3xl border border-slate-200 bg-white p-5 shadow-lg md:p-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-bold text-slate-700">Exercise name</label>
              <input
                type="text"
                name="name"
                required
                maxLength={80}
                value={form.name}
                onChange={handleChange}
                placeholder="Example: Banded shoulder raise"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-bold text-slate-700">Category</label>
              <input
                type="text"
                name="category"
                required
                maxLength={80}
                value={form.category}
                onChange={handleChange}
                placeholder="Example: Shoulders"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Primary muscles</label>
              <input
                type="text"
                name="primaryMuscles"
                maxLength={480}
                value={form.primaryMuscles}
                onChange={handleChange}
                placeholder="Comma separated"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Secondary muscles</label>
              <input
                type="text"
                name="secondaryMuscles"
                maxLength={480}
                value={form.secondaryMuscles}
                onChange={handleChange}
                placeholder="Comma separated"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-bold text-slate-700">Equipment</label>
              <input
                type="text"
                name="equipment"
                maxLength={480}
                value={form.equipment}
                onChange={handleChange}
                placeholder="Example: Dumbbell, resistance band"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-bold text-slate-700">Instructions</label>
              <textarea
                name="instructions"
                rows="6"
                maxLength={1000}
                value={form.instructions}
                onChange={handleChange}
                placeholder="Add setup notes, movement cues, or anything you want to remember."
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </div>
          </div>

          {error && (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          {message && (
            <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              {message}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Custom Exercise"}
            </button>
            <Link
              to="/create"
              className="flex-1 rounded-2xl border border-slate-300 px-5 py-4 text-center text-sm font-black uppercase tracking-[0.2em] text-slate-700 no-underline transition hover:-translate-y-0.5 hover:border-lime-300 hover:bg-lime-50 hover:text-lime-700"
            >
              Create Workout Log
            </Link>
          </div>
        </form>

        <aside className="panel-fade rounded-3xl border border-slate-200 bg-white p-5 shadow-lg md:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Your saved exercises</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">{customExercises.length}</h2>
            </div>
            <div className="rounded-2xl bg-slate-950 px-4 py-3 text-right text-white">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Next step</p>
              <p className="text-sm font-black">Search them in log creation</p>
            </div>
          </div>

          {isLoading ? (
            <p className="mt-5 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
              Loading your custom exercises...
            </p>
          ) : customExercises.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <h3 className="text-lg font-black text-slate-950">No custom exercises yet</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Add your first custom movement and it will appear in your exercise search results.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {customExercises.map((exercise) => (
                <article key={exercise._id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">{exercise.category}</p>
                      <h3 className="mt-1 text-lg font-black text-slate-950">{exercise.name}</h3>
                    </div>
                    <span className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm">
                      Custom
                    </span>
                  </div>

                  {exercise.instructions && (
                    <p className="mt-3 text-sm leading-6 text-slate-600">{exercise.instructions}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {exercise.primaryMuscles?.map((muscle) => (
                      <span key={`${exercise._id}-${muscle}`} className="rounded-2xl border border-slate-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                        {muscle}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
