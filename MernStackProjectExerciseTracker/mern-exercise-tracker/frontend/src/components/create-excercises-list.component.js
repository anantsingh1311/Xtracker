import React, { Component } from 'react';
import { fetchCustomExercises, fetchExternalExercises, post } from "../services/api";
import { formatDateInputValue, getWorkoutDateInputBounds } from "../utils/date-input";
import { normalizeCustomExercise, normalizeExercises } from "../utils/external-exercises";
import { getStoredUser } from "../utils/auth";

const LAST_WORKOUT_PROFILE_KEY = "xt_last_workout_profile";
const WORKOUT_TYPE_FILTERS = [
    ["all", "All"],
    ["cardio", "Cardio"],
    ["strength", "Strength"]
];

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
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(LAST_WORKOUT_PROFILE_KEY, JSON.stringify(profile));
}

export default class CreateExercise extends Component {
    constructor(props) {
        super(props);

        const savedProfile = readSavedWorkoutProfile();
        const userProfile = getStoredUser()?.fitnessProfile || {};
        const preferredWeightUnit = savedProfile.weightUnit || (userProfile.preferredUnitSystem === "imperial" ? "lb" : "kg");
        const profileBodyWeight = preferredWeightUnit === "lb" ? userProfile.bodyWeightLb : userProfile.bodyWeightKg;

        this.OnChangeUsername = this.OnChangeUsername.bind(this);
        this.OnChangeExerciseSearch = this.OnChangeExerciseSearch.bind(this);
        this.OnChangeDate = this.OnChangeDate.bind(this);
        this.OnChangeDuration = this.OnChangeDuration.bind(this);
        this.OnChangeBodyWeight = this.OnChangeBodyWeight.bind(this);
        this.OnChangeWeightUnit = this.OnChangeWeightUnit.bind(this);
        this.OnChangeIntensity = this.OnChangeIntensity.bind(this);
        this.OnChangeLoadUnit = this.OnChangeLoadUnit.bind(this);
        this.OnChangeLoadWeight = this.OnChangeLoadWeight.bind(this);
        this.OnChangeReps = this.OnChangeReps.bind(this);
        this.OnChangeSets = this.OnChangeSets.bind(this);
        this.OnChangeWorkoutType = this.OnChangeWorkoutType.bind(this);
        this.OnChangeWorkoutTypeFilter = this.OnChangeWorkoutTypeFilter.bind(this);
        this.OnSelectExercise = this.OnSelectExercise.bind(this);
        this.OnSubmit = this.OnSubmit.bind(this);

        this.state = {
            username: '',
            description: '',
            searchTerm: '',
            workoutType: savedProfile.workoutType || 'strength',
            workoutTypeFilter: 'all',
            duration: '',
            sets: savedProfile.sets || '',
            reps: savedProfile.reps || '',
            loadWeight: savedProfile.loadWeight || '',
            loadUnit: savedProfile.loadUnit || preferredWeightUnit,
            bodyWeight: savedProfile.bodyWeight || profileBodyWeight || '',
            weightUnit: preferredWeightUnit,
            intensity: savedProfile.intensity || 'moderate',
            calorieEstimate: null,
            estimateMeta: null,
            estimateError: '',
            date: formatDateInputValue(),
            exercises: [],
            isLoadingExercises: true,
            exerciseError: '',
            isSaving: false,
            isEstimating: false
        };

        this._isMounted = false;
        this.estimateTimer = null;
    }

    async componentDidMount() {
        this._isMounted = true;

        const loggedInUser = getStoredUser();

        if (!loggedInUser) {
            window.location = "/login-user";
            return;
        }

        this.setState({
            username: loggedInUser.username
        });

        try {
            const [externalResult, customResult] = await Promise.allSettled([
                fetchExternalExercises(),
                fetchCustomExercises()
            ]);

            if (externalResult.status === "rejected") {
                throw externalResult.reason;
            }

            const exercises = [
                ...normalizeExercises(externalResult.value),
                ...(customResult.status === "fulfilled" ? customResult.value.map(normalizeCustomExercise) : [])
            ];

            if (!this._isMounted) {
                return;
            }

            this.setState({
                exercises,
                exerciseError: '',
                isLoadingExercises: false
            });
        } catch (err) {
            if (process.env.NODE_ENV !== "production") {
                console.error(err);
            }

            if (this._isMounted) {
                this.setState({
                    exerciseError: "Could not load exercises right now.",
                    isLoadingExercises: false
                });
            }
        }
    }

    componentDidUpdate(prevProps, prevState) {
        const watchedFields = ["description", "workoutType", "duration", "sets", "reps", "loadWeight", "loadUnit", "bodyWeight", "weightUnit", "intensity"];
        const shouldRefreshEstimate = watchedFields.some((field) => prevState[field] !== this.state[field]);

        if (shouldRefreshEstimate) {
            this.scheduleEstimate();
        }
    }

    componentWillUnmount() {
        this._isMounted = false;

        if (this.estimateTimer) {
            window.clearTimeout(this.estimateTimer);
        }
    }

    hasEnoughEstimateInputs() {
        const hasWorkDetails = this.state.workoutType === "strength"
            ? Number(this.state.sets) > 0 && Number(this.state.reps) > 0 && Number(this.state.loadWeight || 0) >= 0
            : Number(this.state.duration) > 0;

        return Boolean(
            this.state.description
            && hasWorkDetails
            && Number(this.state.bodyWeight) > 0
            && this.state.intensity
        );
    }

    scheduleEstimate() {
        if (this.estimateTimer) {
            window.clearTimeout(this.estimateTimer);
        }

        if (!this.hasEnoughEstimateInputs()) {
            if (this.state.calorieEstimate !== null || this.state.estimateError) {
                this.setState({
                    calorieEstimate: null,
                    estimateError: '',
                    estimateMeta: null,
                    isEstimating: false
                });
            }
            return;
        }

        this.estimateTimer = window.setTimeout(() => {
            this.requestEstimate();
        }, 250);
    }

    async requestEstimate() {
        if (!this.hasEnoughEstimateInputs()) {
            return;
        }

        this.setState({
            estimateError: '',
            isEstimating: true
        });

        try {
            const estimate = await post('/exercise/estimate', {
                description: this.state.description,
                workoutType: this.state.workoutType,
                duration: Number(this.state.duration),
                sets: Number(this.state.sets),
                reps: Number(this.state.reps),
                loadWeight: Number(this.state.loadWeight || 0),
                loadUnit: this.state.loadUnit,
                intensity: this.state.intensity,
                weight: Number(this.state.bodyWeight),
                weightUnit: this.state.weightUnit
            });

            if (!this._isMounted) {
                return;
            }

            this.setState({
                calorieEstimate: estimate.calories,
                estimateMeta: estimate,
                estimateError: '',
                isEstimating: false
            });
        } catch (err) {
            if (!this._isMounted) {
                return;
            }

            this.setState({
                calorieEstimate: null,
                estimateMeta: null,
                estimateError: err.response?.data?.message || "Could not estimate calories right now.",
                isEstimating: false
            });
        }
    }

    OnChangeUsername(e) {
        this.setState({
            username: e.target.value
        });
    }

    OnChangeExerciseSearch(e) {
        this.setState({
            searchTerm: e.target.value,
            description: ''
        });
    }

    OnSelectExercise(exercise) {
        const exerciseName = exercise.displayName;

        this.setState({
            description: exerciseName,
            searchTerm: exerciseName,
            workoutType: exercise.workoutType || this.state.workoutType,
            exerciseError: ''
        });
    }

    OnChangeWorkoutType(e) {
        this.setState({
            workoutType: e.target.value
        });
    }

    OnChangeWorkoutTypeFilter(type) {
        this.setState({
            workoutTypeFilter: type
        });
    }

    OnChangeDuration(e) {
        this.setState({
            duration: e.target.value
        });
    }

    OnChangeSets(e) {
        this.setState({
            sets: e.target.value
        });
    }

    OnChangeReps(e) {
        this.setState({
            reps: e.target.value
        });
    }

    OnChangeLoadWeight(e) {
        this.setState({
            loadWeight: e.target.value
        });
    }

    OnChangeLoadUnit(e) {
        this.setState({
            loadUnit: e.target.value
        });
    }

    OnChangeBodyWeight(e) {
        this.setState({
            bodyWeight: e.target.value
        });
    }

    OnChangeWeightUnit(e) {
        this.setState({
            weightUnit: e.target.value
        });
    }

    OnChangeIntensity(e) {
        this.setState({
            intensity: e.target.value
        });
    }

    OnChangeDate(e) {
        this.setState({
            date: e.target.value
        });
    }

    GetFilteredExercises() {
        const searchTerm = this.state.searchTerm.trim().toLowerCase();
        const exercisesByType = this.state.workoutTypeFilter === "all"
            ? this.state.exercises
            : this.state.exercises.filter((exercise) => exercise.workoutType === this.state.workoutTypeFilter);

        if (!searchTerm) {
            return exercisesByType.slice(0, 10);
        }

        return exercisesByType
            .filter(exercise => exercise.searchIndex.includes(searchTerm))
            .slice(0, 10);
    }

    async OnSubmit(e) {
        e.preventDefault();

        if (!this.state.description) {
            this.setState({
                exerciseError: "Search for an exercise and select it before logging."
            });
            return;
        }

        this.setState({ isSaving: true, exerciseError: '' });

        const exercise = {
            username: this.state.username,
            description: this.state.description,
            workoutType: this.state.workoutType,
            duration: Number(this.state.duration),
            sets: Number(this.state.sets),
            reps: Number(this.state.reps),
            loadWeight: Number(this.state.loadWeight || 0),
            loadUnit: this.state.loadUnit,
            intensity: this.state.intensity,
            weight: Number(this.state.bodyWeight),
            weightUnit: this.state.weightUnit,
            date: this.state.date
        };

        try {
            await post('/exercise/add', exercise);
            saveWorkoutProfile({
                bodyWeight: this.state.bodyWeight,
                intensity: this.state.intensity,
                loadUnit: this.state.loadUnit,
                loadWeight: this.state.loadWeight,
                reps: this.state.reps,
                sets: this.state.sets,
                weightUnit: this.state.weightUnit,
                workoutType: this.state.workoutType
            });
            window.location = "/Excercises";
        } catch (err) {
            if (process.env.NODE_ENV !== "production") {
                console.error(err);
            }
            this.setState({
                exerciseError: err.response?.data?.message || "Could not save this exercise log.",
                isSaving: false
            });
        }
    }

    render() {
        const filteredExercises = this.GetFilteredExercises();
        const shouldShowResults = this.state.searchTerm && !this.state.description;
        const dateBounds = getWorkoutDateInputBounds();

        return (
            <div className="page-fade mx-auto max-w-5xl py-6">
                <div className="panel-fade overflow-hidden rounded-3xl bg-slate-950 shadow-xl">
                    <div className="bg-gradient-to-r from-cyan-500 via-teal-400 to-lime-300 px-6 py-1" />
                    <div className="p-6 text-white md:p-8">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">Workout log</p>
                        <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Create Exercise Log</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                            Search the exercise library, choose cardio or strength, then enter the details XTracker needs to estimate calories automatically.
                        </p>
                    </div>
                </div>

                <form onSubmit={this.OnSubmit} className="panel-fade mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-lg md:p-8">
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-bold text-slate-700">Username</label>
                            <input
                                type="text"
                                className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600 outline-none"
                                value={this.state.username}
                                disabled
                            />
                        </div>

                        <div className="relative md:col-span-2">
                            <label className="mb-2 block text-sm font-bold text-slate-700">Search Exercise</label>
                            <div className="mb-3 flex flex-wrap gap-2">
                                {WORKOUT_TYPE_FILTERS.map(([value, label]) => (
                                    <button
                                        type="button"
                                        key={value}
                                        onClick={() => this.OnChangeWorkoutTypeFilter(value)}
                                        className={`rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                                            this.state.workoutTypeFilter === value
                                                ? "bg-slate-950 text-white shadow"
                                                : "border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-700"
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                value={this.state.searchTerm}
                                onChange={this.OnChangeExerciseSearch}
                                placeholder="Start typing, for example bench press or squat"
                            />

                            {this.state.isLoadingExercises && (
                                <p className="mt-2 text-sm font-medium text-slate-500">Loading exercise library...</p>
                            )}

                            {shouldShowResults && (
                                <div className="absolute z-10 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                                    {filteredExercises.length > 0 ? (
                                        filteredExercises.map(exercise => {
                                            const exerciseName = exercise.displayName;

                                            if (!exerciseName) {
                                                return null;
                                            }

                                            return (
                                                <button
                                                    type="button"
                                                    key={exercise.id || exercise.uuid || exerciseName}
                                                    onClick={() => this.OnSelectExercise(exercise)}
                                                    className="block w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-cyan-50 hover:text-cyan-700"
                                                >
                                                    <span className="block">{exerciseName}</span>
                                                    <span className="mt-1 block text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
                                                        {exercise.workoutType} | {exercise.sourceType === "custom" ? "Custom exercise" : exercise.category?.name || "External exercise"}
                                                    </span>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <p className="px-4 py-3 text-sm text-slate-500">No matching exercises found.</p>
                                    )}
                                </div>
                            )}

                            {this.state.description && (
                                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                                    Selected exercise: {this.state.description}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">Workout Type</label>
                            <select
                                required
                                value={this.state.workoutType}
                                onChange={this.OnChangeWorkoutType}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                            >
                                <option value="cardio">Cardio</option>
                                <option value="strength">Strength</option>
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">Intensity</label>
                            <select
                                required
                                value={this.state.intensity}
                                onChange={this.OnChangeIntensity}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                            >
                                <option value="light">Light</option>
                                <option value="moderate">Moderate</option>
                                <option value="vigorous">Vigorous</option>
                            </select>
                        </div>

                        {this.state.workoutType === "cardio" ? (
                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm font-bold text-slate-700">Duration (minutes)</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    max="600"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                    value={this.state.duration}
                                    onChange={this.OnChangeDuration}
                                    placeholder="45"
                                />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-slate-700">Sets</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        max="50"
                                        step="1"
                                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                        value={this.state.sets}
                                        onChange={this.OnChangeSets}
                                        placeholder="4"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-slate-700">Reps per set</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        max="200"
                                        step="1"
                                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                        value={this.state.reps}
                                        onChange={this.OnChangeReps}
                                        placeholder="10"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-sm font-bold text-slate-700">Lifted Weight</label>
                                    <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            max={this.state.loadUnit === "lb" ? "2204" : "1000"}
                                            step="0.1"
                                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                            value={this.state.loadWeight}
                                            onChange={this.OnChangeLoadWeight}
                                            placeholder={this.state.loadUnit === "lb" ? "135" : "60"}
                                        />
                                        <select
                                            value={this.state.loadUnit}
                                            onChange={this.OnChangeLoadUnit}
                                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                        >
                                            <option value="kg">kg</option>
                                            <option value="lb">lb</option>
                                        </select>
                                    </div>
                                    <p className="mt-2 text-xs font-semibold text-slate-500">Use 0 for bodyweight-only movements such as push ups.</p>
                                </div>
                            </>
                        )}

                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-bold text-slate-700">Body Weight</label>
                            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                                <input
                                    type="number"
                                    required
                                    min={this.state.weightUnit === "lb" ? "55" : "25"}
                                    step="0.1"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                    value={this.state.bodyWeight}
                                    onChange={this.OnChangeBodyWeight}
                                    placeholder={this.state.weightUnit === "lb" ? "180" : "82"}
                                />
                                <select
                                    value={this.state.weightUnit}
                                    onChange={this.OnChangeWeightUnit}
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
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
                                    <p className="mt-2 text-4xl font-black text-slate-950">
                                        {this.state.calorieEstimate !== null ? this.state.calorieEstimate : "--"}
                                    </p>
                                </div>
                                {this.state.estimateMeta && (
                                    <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                                        <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Method</p>
                                        <p className="mt-1 text-sm font-black text-slate-950">{this.state.estimateMeta.metValue} MET</p>
                                        <p className="text-xs text-slate-500">{this.state.estimateMeta.activityCategory}</p>
                                        {this.state.estimateMeta.workoutType === "strength" && (
                                            <p className="mt-1 text-xs text-slate-500">
                                                {this.state.estimateMeta.setCount} x {this.state.estimateMeta.repsPerSet} | {this.state.estimateMeta.volumeLoadKg} kg volume
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {this.state.isEstimating && (
                                <p className="mt-3 text-sm font-semibold text-slate-500">Updating estimate...</p>
                            )}

                            {!this.state.isEstimating && !this.state.calorieEstimate && !this.state.estimateError && (
                                <p className="mt-3 text-sm text-slate-600">
                                    Select an exercise and enter the visible workout details to calculate calories automatically.
                                </p>
                            )}

                            {this.state.estimateError && (
                                <p className="mt-3 text-sm font-semibold text-red-700">{this.state.estimateError}</p>
                            )}
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-bold text-slate-700">Date</label>
                            <input
                                type="date"
                                required
                                min={dateBounds.min}
                                max={dateBounds.max}
                                value={this.state.date}
                                onChange={this.OnChangeDate}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                            />
                        </div>
                    </div>

                    {this.state.exerciseError && (
                        <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                            {this.state.exerciseError}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={this.state.isSaving}
                        className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {this.state.isSaving ? "Saving..." : "Create Exercise Log"}
                    </button>
                </form>
            </div>
        );
    }
}
