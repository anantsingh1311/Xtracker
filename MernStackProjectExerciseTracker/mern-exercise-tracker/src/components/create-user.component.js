import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { post } from "../services/api";
import { saveStoredUser } from "../utils/auth";
import { buildFitnessProfilePayload, calculateBmiFromForm, calculateWaistToHeightFromForm, createEmptyFitnessForm } from "../utils/measurements";
import { queueToast, showToast } from "../utils/toast";

export default class CreateUser extends Component {
    constructor(props) {
        super(props);

        this.OnChangeUsername = this.OnChangeUsername.bind(this);
        this.OnChangePassword = this.OnChangePassword.bind(this);
        this.OnChangeCheckPassword = this.OnChangeCheckPassword.bind(this);
        this.OnChangeMeasurement = this.OnChangeMeasurement.bind(this);
        this.OnChangeUnitSystem = this.OnChangeUnitSystem.bind(this);
        this.OnSubmit = this.OnSubmit.bind(this);

        this.state = {
            ...createEmptyFitnessForm(),
            username: '',
            password: '',
            checkPassword: '',
            isSubmitting: false
        };
    }

    OnChangeUsername(e) {
        this.setState({
            username: e.target.value
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

    OnChangeUnitSystem(unitSystem) {
        if (this.state.unitSystem === unitSystem) {
            return;
        }

        this.setState({
            ...createEmptyFitnessForm(unitSystem),
            username: this.state.username,
            password: this.state.password,
            checkPassword: this.state.checkPassword,
            isSubmitting: this.state.isSubmitting
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
                username: '',
                password: '',
                checkPassword: '',
                ...createEmptyFitnessForm(this.state.unitSystem),
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

        return (
            <div className="page-fade mx-auto grid min-h-[calc(100vh-9rem)] max-w-6xl items-center gap-6 py-6 lg:grid-cols-[1fr_0.9fr]">
                <div className="panel-fade rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-8">
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-rose-600">New account</p>
                    <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-5xl">Create your XTracker user.</h1>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                        Your username keeps your workout history separate. Your measurements help XTracker estimate BMI, waist-to-height ratio, and help Shaky coach you with better context.
                    </p>

                    <form onSubmit={this.OnSubmit} className="mt-6 space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">Username</label>
                            <input
                                type="text"
                                required
                                maxLength={32}
                                pattern="[A-Za-z0-9_.-]{3,32}"
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                                value={this.state.username}
                                onChange={this.OnChangeUsername}
                                placeholder="Choose a username"
                            />
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
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="number"
                                            required
                                            min="3"
                                            max="8"
                                            step="1"
                                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                                            value={this.state.heightFt}
                                            onChange={(event) => this.OnChangeMeasurement("heightFt", event)}
                                            placeholder="ft"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            max="11.9"
                                            step="0.1"
                                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                                            value={this.state.heightIn}
                                            onChange={(event) => this.OnChangeMeasurement("heightIn", event)}
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
                                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                                        value={this.state.heightCm}
                                        onChange={(event) => this.OnChangeMeasurement("heightCm", event)}
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
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                                    value={isImperial ? this.state.neckIn : this.state.neckCm}
                                    onChange={(event) => this.OnChangeMeasurement(isImperial ? "neckIn" : "neckCm", event)}
                                    placeholder={isImperial ? "15" : "38"}
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">Waist ({isImperial ? "in" : "cm"})</label>
                                <input
                                    type="number"
                                    required
                                    step="0.1"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                                    value={isImperial ? this.state.waistIn : this.state.waistCm}
                                    onChange={(event) => this.OnChangeMeasurement(isImperial ? "waistIn" : "waistCm", event)}
                                    placeholder={isImperial ? "34" : "86"}
                                />
                            </div>
                        </div>

                        <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600">
                            Estimated BMI: <span className="text-slate-950">{bmi || "--"}</span>
                            <span className="mx-2 text-slate-400">|</span>
                            Waist-to-height ratio: <span className="text-slate-950">{waistToHeightRatio || "--"}</span>
                        </p>

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
                            <p className="mt-2 text-sm leading-6 text-slate-300">Every saved workout is connected to your username.</p>
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
