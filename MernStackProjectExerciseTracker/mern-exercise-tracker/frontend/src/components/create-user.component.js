import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { post } from "../services/api";
import { saveStoredUser } from "../utils/auth";
import { buildFitnessProfilePayload, calculateBmiFromForm, calculateWaistToHeightFromForm, createEmptyFitnessForm } from "../utils/measurements";
import { queueToast, showToast } from "../utils/toast";

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

function createGeneratedUsername() {
    return `xt-${Math.random().toString(36).slice(2, 8)}`;
}

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

export default class CreateUser extends Component {
    constructor(props) {
        super(props);

        this.OnChangeName = this.OnChangeName.bind(this);
        this.OnChangePassword = this.OnChangePassword.bind(this);
        this.OnChangeCheckPassword = this.OnChangeCheckPassword.bind(this);
        this.OnChangeMeasurement = this.OnChangeMeasurement.bind(this);
        this.OnChangeHeightSlider = this.OnChangeHeightSlider.bind(this);
        this.OnChangeUnitSystem = this.OnChangeUnitSystem.bind(this);
        this.OnSubmit = this.OnSubmit.bind(this);

        this.state = {
            ...withSliderDefaults(createEmptyFitnessForm()),
            name: '',
            username: createGeneratedUsername(),
            password: '',
            checkPassword: '',
            isSubmitting: false
        };
    }

    OnChangeName(e) {
        this.setState({
            name: e.target.value
        });
    }

    OnChangePassword(e) {
        this.setState({
            password: e.target.value
        });
    }

    OnChangeCheckPassword(e) {
        this.setState({
            checkPassword: e.target.value
        });
    }

    OnChangeMeasurement(field, e) {
        this.setState({
            [field]: e.target.value
        });
    }

    OnChangeHeightSlider(e) {
        const totalInches = Number(e.target.value);
        const heightFt = Math.floor(totalInches / 12);

        this.setState({
            heightFt: String(heightFt),
            heightIn: roundedString(totalInches - (heightFt * 12))
        });
    }

    OnChangeUnitSystem(unitSystem) {
        if (this.state.unitSystem === unitSystem) {
            return;
        }

        this.setState((currentState) => {
            if (unitSystem === "imperial") {
                const heightCm = numberFrom(currentState.heightCm);
                const totalInches = heightCm === null ? null : heightCm / IN_TO_CM;
                let heightFt = totalInches === null ? "" : Math.floor(totalInches / 12);
                let heightIn = totalInches === null ? "" : Math.round((totalInches - (heightFt * 12)) * 10) / 10;

                if (heightIn === 12) {
                    heightFt += 1;
                    heightIn = 0;
                }

                return withSliderDefaults({
                    ...currentState,
                    bodyWeightLb: convertMeasurement(currentState.bodyWeightKg, (value) => value * KG_TO_LB),
                    heightFt: heightFt === "" ? "" : String(heightFt),
                    heightIn: heightIn === "" ? "" : roundedString(heightIn),
                    neckIn: convertMeasurement(currentState.neckCm, (value) => value / IN_TO_CM),
                    unitSystem,
                    waistIn: convertMeasurement(currentState.waistCm, (value) => value / IN_TO_CM)
                });
            }

            const heightFt = numberFrom(currentState.heightFt);
            const heightIn = numberFrom(currentState.heightIn);
            const totalInches = heightFt === null && heightIn === null ? null : ((heightFt || 0) * 12) + (heightIn || 0);

            return withSliderDefaults({
                ...currentState,
                bodyWeightKg: convertMeasurement(currentState.bodyWeightLb, (value) => value / KG_TO_LB),
                heightCm: totalInches === null ? "" : roundedString(totalInches * IN_TO_CM),
                neckCm: convertMeasurement(currentState.neckIn, (value) => value * IN_TO_CM),
                unitSystem,
                waistCm: convertMeasurement(currentState.waistIn, (value) => value * IN_TO_CM)
            });
        });
    }

    async OnSubmit(e) {
        e.preventDefault();

        if (this.state.password !== this.state.checkPassword) {
            showToast({
                message: "The passwords don't match. Please re-enter them.",
                title: "Check your password",
                type: "warning"
            });
            return;
        }

        this.setState({ isSubmitting: true });

        const user = {
            fitnessProfile: {
                ...buildFitnessProfilePayload(this.state)
            },
            name: this.state.name,
            password: this.state.password,
            username: this.state.username
        };

        try {
            const response = await post('/api/user/add', user);
            const didSaveUser = saveStoredUser(response);
            if (!didSaveUser) {
                throw new Error("Your browser could not save this login session. Please allow site storage and try again.");
            }

            this.setState({
                name: '',
                username: createGeneratedUsername(),
                password: '',
                checkPassword: '',
                ...withSliderDefaults(createEmptyFitnessForm(this.state.unitSystem)),
                isSubmitting: false
            });

            queueToast({
                message: response.message || "User created successfully.",
                title: "Account ready",
                type: "success"
            });
            window.location.replace("/create");
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || "Could not create this user right now.";
            if (process.env.NODE_ENV !== "production") {
                console.error("BACKEND ERROR:", errorMessage);
            }

            this.setState({ isSubmitting: false });
            if (err.response?.status === 409) {
                this.setState({ username: createGeneratedUsername() });
            }
            showToast({
                message: errorMessage,
                title: "Signup failed",
                type: "error"
            });
        }
    }

    render() {
        const isImperial = this.state.unitSystem === "imperial";
        const bmi = calculateBmiFromForm(this.state);
        const waistToHeightRatio = calculateWaistToHeightFromForm(this.state);
        const totalHeightIn = ((Number(this.state.heightFt) || 0) * 12) + (Number(this.state.heightIn) || 0);
        const heightSliderValue = isImperial ? totalHeightIn || 69 : this.state.heightCm;
        const heightLabel = isImperial
            ? `${Math.floor((totalHeightIn || 69) / 12)} ft ${roundedString((totalHeightIn || 69) % 12)} in`
            : `${this.state.heightCm} cm`;
        const neckValue = isImperial ? this.state.neckIn : this.state.neckCm;
        const waistValue = isImperial ? this.state.waistIn : this.state.waistCm;
        const sliderClass = "mt-2 w-full accent-rose-600";
        const sliderLimits = isImperial ? IMPERIAL_SLIDER_LIMITS : METRIC_SLIDER_LIMITS;
        const [bmiCategory, bmiMessage] = getBmiSummary(bmi);
        const caloriePlanTimes = getCaloriePlanTimes(this.state, bmi);
        const bodyFatRange = getBodyFatRange(this.state);

        return (
            <div className="page-fade mx-auto grid min-h-[calc(100vh-9rem)] max-w-6xl items-center gap-6 py-6 lg:grid-cols-[1fr_0.9fr]">
                <div className="panel-fade rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-8">
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-rose-600">New account</p>
                    <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-5xl">Create your XTracker user.</h1>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                        Your name or generated user ID can log you in later. Your measurements help XTracker estimate BMI, waist-to-height ratio, and help Shaky coach you with better context.
                    </p>

                    <form onSubmit={this.OnSubmit} className="mt-6 space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">Name</label>
                            <input
                                type="text"
                                required
                                maxLength={32}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                                value={this.state.name}
                                onChange={this.OnChangeName}
                                placeholder="Your name"
                            />
                            <p className="mt-2 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-bold text-slate-600">
                                Generated user ID: <span className="font-black text-slate-950">{this.state.username}</span>
                            </p>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={8}
                                    maxLength={72}
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                                    value={this.state.password}
                                    onChange={this.OnChangePassword}
                                    placeholder="Minimum 8 characters"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={8}
                                    maxLength={72}
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                                    value={this.state.checkPassword}
                                    onChange={this.OnChangeCheckPassword}
                                    placeholder="Re-enter password"
                                />
                            </div>
                        </div>

                        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
                            {[
                                ["metric", "SI units"],
                                ["imperial", "US units"]
                            ].map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => this.OnChangeUnitSystem(value)}
                                    className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${this.state.unitSystem === value ? "bg-slate-950 text-white shadow" : "text-slate-600 hover:bg-white"}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="grid gap-5 sm:grid-cols-4">
                            <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">Body Weight ({isImperial ? "lb" : "kg"})</label>
                                <input
                                    type="number"
                                    required
                                    min={isImperial ? "55" : "25"}
                                    max={isImperial ? "770" : "350"}
                                    step="0.1"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                                    value={isImperial ? this.state.bodyWeightLb : this.state.bodyWeightKg}
                                    onChange={(event) => this.OnChangeMeasurement(isImperial ? "bodyWeightLb" : "bodyWeightKg", event)}
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
                                        onChange={this.OnChangeHeightSlider}
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
                                        value={heightSliderValue}
                                        onChange={(event) => this.OnChangeMeasurement("heightCm", event)}
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
                                    onChange={(event) => this.OnChangeMeasurement(isImperial ? "neckIn" : "neckCm", event)}
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
                                    onChange={(event) => this.OnChangeMeasurement(isImperial ? "waistIn" : "waistCm", event)}
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl bg-slate-100 px-4 py-4 text-sm text-slate-600">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <p className="font-bold">BMI <span className="block text-xl font-black text-slate-950">{bmi || "--"}</span></p>
                                <p className="font-bold">RFM body fat <span className="block text-xl font-black text-slate-950">{bodyFatRange}</span></p>
                                <p className="font-bold">Waist-to-height <span className="block text-xl font-black text-slate-950">{waistToHeightRatio || "--"}</span></p>
                            </div>
                            <p className="mt-3 font-bold text-slate-950">{bmiCategory}</p>
                            <p className="mt-1 leading-6">{bmiMessage}</p>
                            {caloriePlanTimes.length > 0 && (
                                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                    {caloriePlanTimes.map((plan) => (
                                        <p key={plan.deficit} className="rounded-xl bg-white px-3 py-2 font-bold text-slate-700">
                                            {plan.label} {plan.deficit} kcal/day <span className="block text-slate-950">{plan.time}</span>
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={this.state.isSubmitting}
                            className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {this.state.isSubmitting ? "Creating..." : "Create User"}
                        </button>
                    </form>

                    <p className="mt-5 text-center text-sm text-slate-600">
                        Already have an account?{" "}
                        <Link to="/login-user" className="font-black text-rose-600 no-underline transition hover:text-cyan-700">
                            Log in
                        </Link>
                    </p>
                </div>

                <div className="panel-fade rounded-3xl bg-slate-950 p-6 text-white shadow-2xl sm:p-8">
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-rose-200">What you get</p>
                    <div className="mt-6 space-y-4">
                        <div className="soft-card rounded-3xl border border-white/10 bg-white/10 p-5">
                            <h2 className="text-xl font-black">Personal exercise logs</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-300">Every saved workout is connected to your generated user ID.</p>
                        </div>
                        <div className="soft-card rounded-3xl border border-white/10 bg-white/10 p-5">
                            <h2 className="text-xl font-black">Search before logging</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-300">Use the external library to choose exercises with confidence.</p>
                        </div>
                        <div className="soft-card rounded-3xl border border-white/10 bg-white/10 p-5">
                            <h2 className="text-xl font-black">Review-ready UI</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-300">Responsive layouts keep the app usable on phone, tablet, and desktop.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
