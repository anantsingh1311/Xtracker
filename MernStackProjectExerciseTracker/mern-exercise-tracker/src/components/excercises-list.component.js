import React, { Component } from "react";
import { Link } from "react-router-dom";
import { get, remove } from "../services/api";
import { getStoredUser } from "../utils/auth";

const formatDate = (date) => {
  if (!date) {
    return "No date";
  }

  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

const toPositiveNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : 0;
};

const formatShortDate = (dateKey) => {
  if (!dateKey || dateKey === "unknown") {
    return "No date";
  }

  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
};

const buildDailyProgress = (exercises) => {
  const days = new Map();

  exercises.forEach((exercise) => {
    const date = new Date(exercise.date);
    const dateKey = Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "unknown";
    const current = days.get(dateKey) || {
      calories: 0,
      dateKey,
      entries: 0,
      minutes: 0
    };

    current.calories += toPositiveNumber(exercise.calories);
    current.entries += 1;
    current.minutes += toPositiveNumber(exercise.duration);
    days.set(dateKey, current);
  });

  let cumulativeCalories = 0;
  let cumulativeEntries = 0;
  let cumulativeMinutes = 0;

  return Array.from(days.values())
    .sort((a, b) => {
      if (a.dateKey === "unknown") {
        return 1;
      }

      if (b.dateKey === "unknown") {
        return -1;
      }

      return a.dateKey.localeCompare(b.dateKey);
    })
    .map((day) => {
      cumulativeCalories += day.calories;
      cumulativeEntries += day.entries;
      cumulativeMinutes += day.minutes;

      return {
        ...day,
        cumulativeCalories,
        cumulativeEntries,
        cumulativeMinutes
      };
    });
};

const buildIntensityBreakdown = (exercises) => {
  const totals = {
    light: { calories: 0, entries: 0, minutes: 0 },
    moderate: { calories: 0, entries: 0, minutes: 0 },
    vigorous: { calories: 0, entries: 0, minutes: 0 }
  };

  exercises.forEach((exercise) => {
    const key = ["light", "moderate", "vigorous"].includes(exercise.intensity)
      ? exercise.intensity
      : "moderate";

    totals[key].calories += toPositiveNumber(exercise.calories);
    totals[key].entries += 1;
    totals[key].minutes += toPositiveNumber(exercise.duration);
  });

  const totalMinutes = Object.values(totals).reduce((total, item) => total + item.minutes, 0) || 1;

  return [
    { key: "light", label: "Light", color: "bg-sky-400", ...totals.light },
    { key: "moderate", label: "Moderate", color: "bg-teal-400", ...totals.moderate },
    { key: "vigorous", label: "Vigorous", color: "bg-orange-400", ...totals.vigorous }
  ].map((item) => ({
    ...item,
    percent: Math.round((item.minutes / totalMinutes) * 100)
  }));
};

const PROGRESS_METRICS = [
  {
    key: "minutes",
    label: "Minutes",
    dailyField: "minutes",
    cumulativeField: "cumulativeMinutes",
    suffix: " min",
    stroke: "#0891b2"
  },
  {
    key: "calories",
    label: "Calories",
    dailyField: "calories",
    cumulativeField: "cumulativeCalories",
    suffix: " cal",
    stroke: "#0f766e"
  },
  {
    key: "entries",
    label: "Entries",
    dailyField: "entries",
    cumulativeField: "cumulativeEntries",
    suffix: "",
    stroke: "#f97316"
  }
];

const ProgressCharts = ({ exercises }) => {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [metricKey, setMetricKey] = React.useState("minutes");
  const [mode, setMode] = React.useState("daily");
  const [activeIntensity, setActiveIntensity] = React.useState("moderate");
  const dailyProgress = React.useMemo(() => buildDailyProgress(exercises), [exercises]);
  const intensityBreakdown = React.useMemo(() => buildIntensityBreakdown(exercises), [exercises]);
  const metric = PROGRESS_METRICS.find((item) => item.key === metricKey) || PROGRESS_METRICS[0];
  const field = mode === "cumulative" ? metric.cumulativeField : metric.dailyField;
  const chartRows = dailyProgress.map((day) => ({
    ...day,
    value: toPositiveNumber(day[field])
  }));

  if (chartRows.length === 0) {
    return null;
  }

  const width = 720;
  const height = 280;
  const padding = { bottom: 42, left: 58, right: 24, top: 24 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...chartRows.map((row) => row.value), 1);
  const safeIndex = Math.min(activeIndex, chartRows.length - 1);
  const points = chartRows.map((row, index) => {
    const x = chartRows.length === 1
      ? padding.left + (plotWidth / 2)
      : padding.left + ((plotWidth / (chartRows.length - 1)) * index);
    const y = padding.top + plotHeight - ((row.value / maxValue) * plotHeight);

    return { ...row, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const barWidth = Math.max(10, Math.min(46, plotWidth / chartRows.length * 0.55));
  const activePoint = points[safeIndex];
  const bestDay = chartRows.reduce((best, current) => current.value > best.value ? current : best, chartRows[0]);
  const latestDay = chartRows[chartRows.length - 1];
  const activeIntensityItem = intensityBreakdown.find((item) => item.key === activeIntensity) || intensityBreakdown[0];
  const totalValue = chartRows.reduce((total, row) => total + row.value, 0);
  const averageValue = Math.round((totalValue / chartRows.length) * 10) / 10;

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Progress dashboard</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Your fitness journey</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {PROGRESS_METRICS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMetricKey(item.key)}
                  className={`rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${
                    metricKey === item.key
                      ? "bg-slate-950 text-white shadow-md"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {["daily", "cumulative"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${
                  mode === item
                    ? "bg-cyan-500 text-slate-950 shadow-md"
                    : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-cyan-300 hover:text-cyan-700"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl bg-slate-50 p-3">
            <svg
              aria-label={`${metric.label} ${mode} progress chart`}
              className="h-[280px] w-full"
              role="img"
              viewBox={`0 0 ${width} ${height}`}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                const y = padding.top + plotHeight - (plotHeight * step);
                const label = Math.round(maxValue * step);

                return (
                  <g key={step}>
                    <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                    <text x={padding.left - 12} y={y + 4} textAnchor="end" className="fill-slate-400 text-[11px] font-bold">
                      {label}
                    </text>
                  </g>
                );
              })}

              {mode === "daily" && points.map((point, index) => {
                const barHeight = plotHeight - (point.y - padding.top);

                return (
                  <rect
                    key={point.dateKey}
                    x={point.x - (barWidth / 2)}
                    y={point.y}
                    width={barWidth}
                    height={Math.max(barHeight, 2)}
                    rx="6"
                    className="cursor-pointer transition"
                    fill={index === safeIndex ? metric.stroke : "#67e8f9"}
                    opacity={index === safeIndex ? "1" : "0.72"}
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    tabIndex="0"
                  />
                );
              })}

              {mode === "cumulative" && (
                <>
                  <path d={path} fill="none" stroke={metric.stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
                  {points.map((point, index) => (
                    <circle
                      key={point.dateKey}
                      cx={point.x}
                      cy={point.y}
                      r={index === safeIndex ? 8 : 5}
                      className="cursor-pointer transition"
                      fill={index === safeIndex ? "#0f172a" : metric.stroke}
                      onMouseEnter={() => setActiveIndex(index)}
                      onFocus={() => setActiveIndex(index)}
                      tabIndex="0"
                    />
                  ))}
                </>
              )}

              {points.map((point, index) => {
                if (index !== 0 && index !== points.length - 1 && index !== safeIndex) {
                  return null;
                }

                return (
                  <text
                    key={`${point.dateKey}-label`}
                    x={point.x}
                    y={height - 13}
                    textAnchor="middle"
                    className="fill-slate-500 text-[11px] font-bold"
                  >
                    {formatShortDate(point.dateKey)}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>

        <aside className="border-t border-slate-200 bg-slate-950 p-5 text-white lg:border-l lg:border-t-0 md:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Selected point</p>
          <p className="mt-2 text-3xl font-black">
            {Math.round(activePoint.value * 10) / 10}{metric.suffix}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-300">{formatShortDate(activePoint.dateKey)}</p>

          <div className="mt-6 grid gap-3 text-sm">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="font-black uppercase tracking-[0.14em] text-cyan-100">Best day</p>
              <p className="mt-2 font-semibold text-white">
                {formatShortDate(bestDay.dateKey)} | {Math.round(bestDay.value * 10) / 10}{metric.suffix}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="font-black uppercase tracking-[0.14em] text-cyan-100">Average</p>
              <p className="mt-2 font-semibold text-white">
                {averageValue}{metric.suffix} per logged day
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="font-black uppercase tracking-[0.14em] text-cyan-100">Latest</p>
              <p className="mt-2 font-semibold text-white">
                {formatShortDate(latestDay.dateKey)} | {Math.round(latestDay.value * 10) / 10}{metric.suffix}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Intensity mix</p>
            <div className="mt-3 space-y-3">
              {intensityBreakdown.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveIntensity(item.key)}
                  onFocus={() => setActiveIntensity(item.key)}
                  className="block w-full text-left"
                >
                  <span className="flex items-center justify-between text-xs font-black uppercase tracking-[0.14em] text-slate-300">
                    <span>{item.label}</span>
                    <span>{item.percent}%</span>
                  </span>
                  <span className="mt-2 block h-3 overflow-hidden rounded-2xl bg-white/15">
                    <span
                      className={`block h-full rounded-2xl ${item.color}`}
                      style={{ width: `${Math.max(item.percent, item.minutes > 0 ? 4 : 0)}%` }}
                    />
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 rounded-2xl bg-white/10 p-4 text-sm font-semibold text-slate-200">
              {activeIntensityItem.label}: {activeIntensityItem.minutes} min, {activeIntensityItem.entries} logs, {activeIntensityItem.calories} cal.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
};

const ExerciseCard = (props) => (
  <article className="soft-card rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">{props.exercise.username}</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">{props.exercise.description}</h2>
      </div>
      <span className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-white">
        {props.exercise.calories || 0} est cal
      </span>
    </div>

    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-2xl bg-slate-100 p-3">
        <p className="font-bold text-slate-500">Duration</p>
        <p className="mt-1 font-black text-slate-950">{props.exercise.duration} min</p>
      </div>
      <div className="rounded-2xl bg-slate-100 p-3">
        <p className="font-bold text-slate-500">Date</p>
        <p className="mt-1 font-black text-slate-950">{formatDate(props.exercise.date)}</p>
      </div>
    </div>

    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {props.exercise.intensity || "moderate"} intensity | {props.exercise.bodyWeightKg || "--"} kg basis
    </p>

    <div className="mt-5 flex gap-3">
      <Link
        className="flex-1 rounded-2xl bg-cyan-600 px-4 py-3 text-center text-sm font-black text-white no-underline transition hover:-translate-y-0.5 hover:bg-cyan-700"
        to={`/edit/${props.exercise._id}`}
      >
        Edit
      </Link>
      <button
        className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
        onClick={() => props.deleteExercise(props.exercise._id)}
      >
        Delete
      </button>
    </div>
  </article>
);

const ExerciseRow = (props) => (
  <tr className="border-b border-slate-100 transition hover:bg-cyan-50/60">
    <td className="px-4 py-4 text-sm font-bold text-slate-600">{props.exercise.username}</td>
    <td className="px-4 py-4 text-sm font-black text-slate-950">{props.exercise.description}</td>
    <td className="px-4 py-4 text-sm text-slate-600">{props.exercise.duration} min</td>
    <td className="px-4 py-4 text-sm text-slate-600">{formatDate(props.exercise.date)}</td>
    <td className="px-4 py-4 text-sm text-slate-600">{props.exercise.calories || 0}</td>
    <td className="px-4 py-4">
      <div className="flex gap-2">
        <Link
          className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black text-white no-underline transition hover:-translate-y-0.5 hover:bg-cyan-700"
          to={`/edit/${props.exercise._id}`}
        >
          Edit
        </Link>
        <button
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
          onClick={() => props.deleteExercise(props.exercise._id)}
        >
          Delete
        </button>
      </div>
    </td>
  </tr>
);

export default class ExercisesList extends Component {
  constructor(props) {
    super(props);

    this.deleteExercise = this.deleteExercise.bind(this);

    this.state = {
      exercises: [],
      user: getStoredUser(),
      isLoading: true,
      error: ""
    };

    this._isMounted = false;
  }

  syncUser = async () => {
    const user = getStoredUser();

    this.setState({ user });

    if (user?.username) {
      await this.loadExercises(user.username);
      return;
    }

    if (this._isMounted) {
      this.setState({
        exercises: [],
        isLoading: false,
        error: ""
      });
    }
  }

  componentDidMount() {
    this._isMounted = true;
    window.addEventListener("storage", this.syncUser);

    const { user } = this.state;
    if (user && user.username) {
      this.loadExercises(user.username);
    } else {
      this.setState({ isLoading: false });
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    window.removeEventListener("storage", this.syncUser);
  }

  async loadExercises(username = this.state.user?.username) {
    if (!username) {
      if (this._isMounted) {
        this.setState({ exercises: [], isLoading: false, error: "" });
      }
      return;
    }

    this.setState({ isLoading: true, error: "" });

    try {
      const exercises = await get(`/exercise/${username}`);

      if (this._isMounted) {
        this.setState({
          exercises: Array.isArray(exercises) ? exercises : [],
          isLoading: false,
          error: ""
        });
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error(err);
      }

      if (this._isMounted) {
        this.setState({
          exercises: [],
          isLoading: false,
          error: "Could not load your exercise logs."
        });
      }
    }
  }

  async deleteExercise(id) {
    const previousExercises = this.state.exercises;

    this.setState((state) => ({
      exercises: state.exercises.filter((exercise) => exercise._id !== id),
      error: ""
    }));

    try {
      await remove(`/exercise/${id}`);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error(err);
      }

      if (this._isMounted) {
        this.setState({
          exercises: previousExercises,
          error: "Could not delete this exercise log."
        });
      }
    }
  }

  exerciseCards() {
    return this.state.exercises.map((currentExercise) => (
      <ExerciseCard
        exercise={currentExercise}
        deleteExercise={this.deleteExercise}
        key={currentExercise._id}
      />
    ));
  }

  exerciseRows() {
    return this.state.exercises.map((currentExercise) => (
      <ExerciseRow
        exercise={currentExercise}
        deleteExercise={this.deleteExercise}
        key={currentExercise._id}
      />
    ));
  }

  render() {
    const totalMinutes = this.state.exercises.reduce((total, exercise) => total + Number(exercise.duration || 0), 0);
    const totalCalories = this.state.exercises.reduce((total, exercise) => total + Number(exercise.calories || 0), 0);

    return (
      <div className="page-fade mx-auto max-w-7xl py-6">
        <div className="overflow-hidden rounded-3xl bg-slate-950 shadow-xl">
          <div className="bg-gradient-to-r from-cyan-500 via-teal-400 to-lime-300 px-6 py-1" />
          <div className="grid gap-5 p-6 text-white md:grid-cols-[1fr_auto] md:items-end md:p-8">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-200">Workout history</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Logged Exercises</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Review the exercises saved for {this.state.user?.username || "your account"}.
              </p>
            </div>
            <Link
              to="/create"
              className="rounded-2xl bg-cyan-400 px-5 py-4 text-center text-sm font-black uppercase tracking-[0.2em] text-slate-950 no-underline shadow-lg transition hover:-translate-y-0.5 hover:bg-lime-300"
            >
              Add Log
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="soft-card rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Entries</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{this.state.exercises.length}</p>
          </div>
          <div className="soft-card rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Minutes</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{totalMinutes}</p>
          </div>
          <div className="soft-card rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Estimated calories</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{totalCalories}</p>
          </div>
        </div>

        {!this.state.isLoading && this.state.exercises.length > 0 && (
          <ProgressCharts exercises={this.state.exercises} />
        )}

        {this.state.isLoading && (
          <p className="mt-6 rounded-3xl bg-white p-6 text-center text-sm font-bold text-slate-600 shadow-lg">
            Loading your exercise logs...
          </p>
        )}

        {this.state.error && (
          <p className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">
            {this.state.error}
          </p>
        )}

        {!this.state.isLoading && this.state.exercises.length === 0 && (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-lg">
            <h2 className="text-2xl font-black text-slate-950">No exercise logs yet</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Create your first log to start tracking duration and estimated calories.</p>
            <Link
              to="/create"
              className="mt-5 inline-block rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white no-underline transition hover:-translate-y-0.5 hover:bg-cyan-700"
            >
              Create Log
            </Link>
          </div>
        )}

        {this.state.exercises.length > 0 && (
          <>
            <div className="mt-6 grid gap-4 lg:hidden">
              {this.exerciseCards()}
            </div>

            <div className="mt-6 hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg lg:block">
              <table className="w-full border-collapse">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.2em] text-slate-500">Username</th>
                    <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.2em] text-slate-500">Exercise</th>
                    <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.2em] text-slate-500">Duration</th>
                    <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.2em] text-slate-500">Date</th>
                    <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.2em] text-slate-500">Calories</th>
                    <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.2em] text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>{this.exerciseRows()}</tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }
}
