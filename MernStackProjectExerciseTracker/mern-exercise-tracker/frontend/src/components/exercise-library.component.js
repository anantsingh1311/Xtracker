import React, { startTransition, useDeferredValue, useEffect, useState } from "react";
import { fetchCustomExercises, fetchExternalExercises } from "../services/api";
import { getMediaUrl, getYoutubeSearchUrl, normalizeCustomExercise, normalizeExercises } from "../utils/external-exercises";
import { getStoredUser } from "../utils/auth";

function InfoPill({ children }) {
  return (
    <span className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
      {children}
    </span>
  );
}

const WORKOUT_TYPE_FILTERS = [
  ["all", "All"],
  ["cardio", "Cardio"],
  ["strength", "Strength"]
];

export default function ExerciseLibrary() {
  const [exercises, setExercises] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const currentUser = getStoredUser();
  const isAuthenticatedUser = Boolean(currentUser?.userId && currentUser?.username && currentUser?.token);

  useEffect(() => {
    let isMounted = true;

    const loadExercises = async () => {
      try {
        const [externalResult, customResult] = await Promise.allSettled([
          fetchExternalExercises(),
          isAuthenticatedUser ? fetchCustomExercises() : Promise.resolve([])
        ]);

        if (externalResult.status === "rejected") {
          throw externalResult.reason;
        }

        const normalizedExercises = [
          ...normalizeExercises(externalResult.value),
          ...(customResult.status === "fulfilled" ? customResult.value.map(normalizeCustomExercise) : [])
        ];
        const firstExerciseWithMedia = normalizedExercises.find((exercise) => exercise.hasMedia);

        if (!isMounted) {
          return;
        }

        startTransition(() => {
          setExercises(normalizedExercises);
          setSelectedExercise(firstExerciseWithMedia || normalizedExercises[0] || null);
        });
        setError("");
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error(err);
        }
        if (isMounted) {
          setError("Could not load the exercise library right now.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadExercises();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticatedUser]);

  const searchWords = deferredSearchTerm.trim().toLowerCase();
  const filteredExercises = exercises
    .filter((exercise) => {
      if (typeFilter !== "all" && exercise.workoutType !== typeFilter) {
        return false;
      }

      if (!searchWords) {
        return true;
      }

      return exercise.searchIndex.includes(searchWords);
    })
    .slice(0, 24);

  const description = selectedExercise?.descriptionText || "";
  const primaryMuscles = selectedExercise?.primaryMuscles || [];
  const secondaryMuscles = selectedExercise?.secondaryMuscles || [];
  const equipment = selectedExercise?.equipmentNames || [];
  const aliases = selectedExercise?.aliases || [];
  const selectedExerciseName = selectedExercise?.displayName || "";
  const youtubeUrl = selectedExerciseName ? getYoutubeSearchUrl(selectedExerciseName) : "";

  return (
    <div className="page-fade mx-auto max-w-7xl py-6">
      <div className="panel-fade overflow-hidden rounded-3xl bg-slate-950 shadow-xl">
        <div className="bg-gradient-to-r from-orange-400 via-rose-400 to-fuchsia-500 px-6 py-1" />
        <div className="grid gap-8 p-6 text-white md:grid-cols-[1.2fr_0.8fr] md:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-200">Exercise library</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Search exercises before you train</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Browse the external exercise data with names, instructions, muscles, equipment, images, videos, license info, and authors in one place.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm font-semibold text-slate-300">Loaded exercises</p>
            <p className="mt-2 text-5xl font-black">{exercises.length}</p>
            <p className="mt-2 text-sm text-slate-300">Separated into cardio and strength options for logging.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="panel-fade rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
          <label className="mb-2 block text-sm font-bold text-slate-700">Search by name, muscle, category, or equipment</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
            placeholder="Try face pull, chest, dumbbell..."
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {WORKOUT_TYPE_FILTERS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTypeFilter(value)}
                className={`rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                  typeFilter === value
                    ? "bg-slate-950 text-white shadow"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {isLoading && (
            <p className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">Loading exercises...</p>
          )}

          {error && (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
          )}

          <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {filteredExercises.map((exercise) => {
              const isSelected = selectedExercise?.id === exercise.id;
              const hasExerciseMedia = Boolean(exercise.videos?.length || exercise.images?.length);

              return (
                <button
                  type="button"
                  key={exercise.id || exercise.uuid}
                  onClick={() => setSelectedExercise(exercise)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${isSelected ? "border-rose-300 bg-rose-50 shadow-sm" : "border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50"}`}
                >
                  <span className="block text-sm font-black text-slate-900">{exercise.displayName}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    {exercise.workoutType} | {exercise.category?.name || "No category"} {exercise.sourceType === "custom" ? "custom exercise" : hasExerciseMedia ? "with media" : "details only"}
                  </span>
                </button>
              );
            })}

            {!isLoading && filteredExercises.length === 0 && (
              <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">No exercises matched your search.</p>
            )}
          </div>
        </aside>

        <main className="panel-fade rounded-3xl border border-slate-200 bg-white p-5 shadow-lg md:p-8">
          {!selectedExercise ? (
            <div className="rounded-3xl bg-slate-100 p-8 text-center">
              <p className="text-lg font-black text-slate-700">Search and select an exercise to see details.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.25em] text-rose-500">{selectedExercise.category?.name || "Exercise"}</p>
                  <h3 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">{selectedExercise.displayName}</h3>
                </div>

                <div className="rounded-2xl bg-slate-950 px-4 py-3 text-right text-white">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Media</p>
                  <p className="text-lg font-black">{selectedExercise.images?.length || 0} images / {selectedExercise.videos?.length || 0} videos</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <InfoPill>{selectedExercise.workoutType || "strength"}</InfoPill>
                <InfoPill>ID {selectedExercise.id}</InfoPill>
                <InfoPill>{selectedExercise.license?.short_name || "No license"}</InfoPill>
                <InfoPill>{selectedExercise.license_author || "Community author"}</InfoPill>
              </div>

              {description && (
                <section className="mt-6 rounded-3xl bg-slate-50 p-5">
                  <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Instructions</h4>
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{description}</p>
                </section>
              )}

              <section className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 p-4">
                  <h4 className="text-sm font-black text-slate-900">Primary muscles</h4>
                  <p className="mt-2 text-sm text-slate-600">{primaryMuscles.join(", ") || "Not listed"}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 p-4">
                  <h4 className="text-sm font-black text-slate-900">Secondary muscles</h4>
                  <p className="mt-2 text-sm text-slate-600">{secondaryMuscles.join(", ") || "Not listed"}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 p-4">
                  <h4 className="text-sm font-black text-slate-900">Equipment</h4>
                  <p className="mt-2 text-sm text-slate-600">{equipment.join(", ") || "No equipment listed"}</p>
                </div>
              </section>

              <section className="mt-6">
                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Videos</h4>
                {selectedExercise.videos?.length ? (
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    {selectedExercise.videos.map((video) => (
                      <div key={video.id || video.uuid} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950">
                        <video controls className="h-64 w-full bg-black object-contain">
                          <source src={getMediaUrl(video.video)} />
                          Your browser does not support this video.
                        </video>
                        <div className="p-4 text-sm text-slate-300">
                          <p className="font-bold text-white">{video.duration ? `${video.duration}s` : "Exercise video"}</p>
                          <p>{video.codec_long || video.codec || "Video provided by wger"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <h5 className="text-lg font-black text-slate-950">Need a movement demo?</h5>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Open YouTube results for {selectedExerciseName} and pick the clearest form tutorial.
                    </p>
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-block rounded-2xl bg-red-600 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:-translate-y-0.5 hover:bg-red-700"
                    >
                      Watch on YouTube
                    </a>
                  </div>
                )}
              </section>

              <section className="mt-6">
                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Visual Tutorial</h4>
                {selectedExercise.images?.length ? (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {selectedExercise.images.map((image) => (
                      <div key={image.id || image.uuid} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                        <img
                          src={getMediaUrl(image.image)}
                          alt={selectedExercise.displayName}
                          className="h-64 w-full object-contain"
                        />
                        <div className="px-4 py-3 text-xs font-semibold text-slate-500">
                          {image.is_main ? "Main image" : "Supporting image"} {image.is_ai_generated ? "AI generated" : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <h5 className="text-lg font-black text-slate-950">Visual guide</h5>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Use a video walkthrough to check setup, range of motion, and safe technique for {selectedExerciseName}.
                    </p>
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-block rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:-translate-y-0.5 hover:bg-red-600"
                    >
                      Find Video Guide
                    </a>
                  </div>
                )}
              </section>

              <section className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 p-4">
                  <h4 className="text-sm font-black text-slate-900">Aliases</h4>
                  <p className="mt-2 text-sm text-slate-600">{aliases.join(", ") || "No aliases listed"}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 p-4">
                  <h4 className="text-sm font-black text-slate-900">Authors</h4>
                  <p className="mt-2 text-sm text-slate-600">{selectedExercise.total_authors_history?.join(", ") || selectedExercise.author_history?.join(", ") || "Not listed"}</p>
                </div>
              </section>

              {selectedExercise.license?.url && (
                <a
                  href={selectedExercise.license.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-block rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:-translate-y-0.5 hover:bg-rose-600"
                >
                  View license
                </a>
              )}

            </>
          )}
        </main>
      </div>
    </div>
  );
}
