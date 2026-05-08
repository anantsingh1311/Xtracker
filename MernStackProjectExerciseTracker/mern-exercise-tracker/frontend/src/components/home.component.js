import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { fetchSiteSettings } from "../services/api";
import { getStoredUser } from "../utils/auth";
import { BUILDER_NAME, BUILDER_URL, SITE_LOGO_SRC, SITE_NAME } from "../utils/branding";

export default class Home extends Component {
    constructor(props) {
        super(props);

        this.state = {
            settings: null
        };
    }

    componentDidMount() {
        fetchSiteSettings()
            .then((settings) => this.setState({ settings }))
            .catch(() => this.setState({ settings: null }));
    }

    render() {
        const user = getStoredUser();
        const announcement = this.state.settings?.announcement;
        const featuredExercise = this.state.settings?.featuredExercise;

        return (
            <section className="page-fade py-6 sm:py-10">
                {announcement?.enabled && (announcement.title || announcement.message) && (
                    <div className="mb-6 rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-lg">
                        {announcement.title && <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">{announcement.title}</p>}
                        {announcement.message && <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{announcement.message}</p>}
                    </div>
                )}

                <div className="home-hero-grid grid items-start gap-8">
                    <div className="home-hero-copy panel-fade pt-2">
                        <p className="text-sm font-black uppercase tracking-[0.35em] text-cyan-700">Exercise tracking made simple</p>
                        <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                            Log smarter workouts with searchable exercise data.
                        </h1>
                        <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                            XTracker helps you search exercises, understand the movement, record duration and auto-estimated calories, then review your workout history from one clean dashboard.
                        </p>

                        <div className="home-cta-row mt-8 flex flex-col gap-3">
                            <Link
                                to={user ? "/create" : "/login-user"}
                                className="rounded-2xl bg-slate-950 px-6 py-4 text-center text-sm font-black uppercase tracking-[0.2em] text-white no-underline shadow-xl transition hover:-translate-y-1 hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200"
                            >
                                {user ? "Create Exercise Log" : "Log In To Start"}
                            </Link>
                            <Link
                                to="/exercise-library"
                                className="rounded-2xl border border-slate-300 bg-white px-6 py-4 text-center text-sm font-black uppercase tracking-[0.2em] text-slate-950 no-underline shadow-lg transition hover:-translate-y-1 hover:border-rose-300 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-100"
                            >
                                Explore Library
                            </Link>
                            {user && (
                                <Link
                                    to="/custom-exercises/new"
                                    className="rounded-2xl border border-slate-300 bg-white px-6 py-4 text-center text-sm font-black uppercase tracking-[0.2em] text-slate-950 no-underline shadow-lg transition hover:-translate-y-1 hover:border-lime-300 hover:text-lime-700 focus:outline-none focus:ring-4 focus:ring-lime-100"
                                >
                                    Add Custom Exercise
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="panel-fade rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5">
                        <div className="rounded-3xl bg-slate-950 p-5 text-white sm:p-6">
                            <p className="text-sm font-bold uppercase tracking-[0.25em] text-lime-200">Today&apos;s flow</p>
                            <div className="mt-5 space-y-3">
                                {[
                                    ["Search", "Find a movement by name, muscle, category, or equipment."],
                                    ["Learn", "Review instructions, images, videos, and author details."],
                                    ["Log", "Save duration and auto-estimated calories against your signed-in user."],
                                    ["Review", "Track every saved exercise in your logged list."]
                                ].map(([title, description], index) => (
                                    <div key={title} className="soft-card rounded-2xl border border-white/10 bg-white/10 p-4">
                                        <div className="flex items-start gap-3">
                                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300 text-sm font-black text-slate-950">
                                                {index + 1}
                                            </span>
                                            <div>
                                                <h2 className="text-lg font-black">{title}</h2>
                                                <p className="mt-1 text-sm leading-6 text-slate-300 sm:leading-7">{description}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {(featuredExercise?.title || featuredExercise?.description) && (
                        <div className="soft-card rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-lg sm:col-span-2 lg:col-span-3">
                            <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Featured by admin</p>
                            {featuredExercise.title && <h2 className="mt-3 text-2xl font-black text-slate-950">{featuredExercise.title}</h2>}
                            {featuredExercise.description && <p className="mt-2 text-sm leading-6 text-slate-600">{featuredExercise.description}</p>}
                            {featuredExercise.resourceUrl && (
                                <a
                                    href={featuredExercise.resourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 inline-block rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white no-underline transition hover:bg-cyan-700"
                                >
                                    Open Resource
                                </a>
                            )}
                        </div>
                    )}

                    <div className="soft-card rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Searchable</p>
                        <h2 className="mt-3 text-2xl font-black text-slate-950">External exercise library</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">Browse public exercise data with instructions and media where available.</p>
                    </div>
                    <div className="soft-card rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-rose-600">Trackable</p>
                        <h2 className="mt-3 text-2xl font-black text-slate-950">Duration and calories</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">Capture workout details and let XTracker estimate calories for each saved session.</p>
                    </div>
                    <div className="soft-card rounded-3xl border border-slate-200 bg-white p-5 shadow-lg sm:col-span-2 lg:col-span-1">
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-lime-700">Responsive</p>
                        <h2 className="mt-3 text-2xl font-black text-slate-950">Ready for review</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">Layouts adapt across mobile, tablet, and desktop with consistent interactions.</p>
                    </div>
                </div>

                <div className="mt-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-lg sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 p-2">
                            <img src={SITE_LOGO_SRC} alt={`${SITE_NAME} logo`} className="h-full w-full object-contain" />
                        </span>
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Built by</p>
                            <h2 className="mt-1 text-xl font-black text-slate-950">{BUILDER_NAME}</h2>
                        </div>
                    </div>
                    <a
                        href={BUILDER_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl bg-slate-950 px-5 py-3 text-center text-sm font-black uppercase tracking-[0.16em] text-white no-underline shadow-lg transition hover:-translate-y-1 hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200"
                    >
                        Visit Website
                    </a>
                </div>
            </section>
        );
    }
}
