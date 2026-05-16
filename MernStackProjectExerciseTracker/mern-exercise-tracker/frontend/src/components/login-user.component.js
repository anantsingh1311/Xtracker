import React, { Component } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { post } from "../services/api";
import { getStoredUser, hasCompletedFitnessProfile, isAdmin, saveStoredUser } from "../utils/auth";
import { queueToast, showToast } from "../utils/toast";

function getRequestedPath(location) {
    const requestedPath = location?.state?.from;

    return requestedPath && requestedPath !== "/login-user" ? requestedPath : "";
}

function getPostLoginPath(user, requestedPath = "") {
    if (isAdmin(user)) {
        return requestedPath || "/admin";
    }

    if (!hasCompletedFitnessProfile(user)) {
        return "/profile";
    }

    if (requestedPath && requestedPath !== "/admin" && requestedPath !== "/user") {
        return requestedPath;
    }

    return "/create";
}

function assertSessionPayload(user) {
    if (!user?.userId || !user?.username || !user?.token) {
        throw new Error("The login service did not return a valid session. Check that the frontend is connected to the backend API.");
    }
}

class LoginUser extends Component {

    constructor(props) {
        super(props);
        this.OnUserNameChanged = this.OnUserNameChanged.bind(this);
        this.OnChangePassword = this.OnChangePassword.bind(this);
        this.OnSubmit = this.OnSubmit.bind(this);

        this.state = {
            username: '',
            password: '',
            isSubmitting: false
        };
    }

    componentDidMount() {
        const storedUser = getStoredUser();

        if (storedUser) {
            this.props.navigate(getPostLoginPath(storedUser, getRequestedPath(this.props.location)), { replace: true });
        }
    }

    OnChangePassword(e) {
        this.setState({
            password: e.target.value
        });
    }

    OnUserNameChanged(e) {
        this.setState({
            username: e.target.value
        });
    }

    async OnSubmit(e) {
        e.preventDefault();
        this.setState({ isSubmitting: true });

        const logInUser = {
            username: this.state.username,
            password: this.state.password
        };

        try {
            const user = await post("/api/login", logInUser);
            assertSessionPayload(user);

            this.setState({
                username: "",
                password: "",
                isSubmitting: false
            });

            const didSaveUser = saveStoredUser(user);
            if (!didSaveUser) {
                throw new Error("Your browser could not save this login session. Please allow site storage and try again.");
            }

            queueToast({
                message: `Welcome back, ${user.username}.`,
                title: "Login successful",
                type: "success"
            });
            this.props.navigate(getPostLoginPath(user, getRequestedPath(this.props.location)), { replace: true });
        } catch (err) {
            if (process.env.NODE_ENV !== "production") {
                console.error(err);
            }
            this.setState({ isSubmitting: false });
            showToast({
                message: err.response?.data?.message || err.message || "Invalid username or password",
                title: "Login failed",
                type: "error"
            });
        }
    }

    render() {
        return (
            <div className="page-fade mx-auto grid min-h-[calc(100vh-9rem)] max-w-6xl items-center gap-6 py-6 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="panel-fade rounded-3xl bg-slate-950 p-6 text-white shadow-2xl sm:p-8">
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-200">Welcome back</p>
                    <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Log in and keep your streak moving.</h1>
                    <p className="mt-4 text-sm leading-7 text-slate-300">
                        Once you are signed in, XTracker can attach every exercise log to your username and keep your history separate.
                    </p>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                        <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                            <p className="text-2xl font-black">01</p>
                            <p className="mt-1 text-sm text-slate-300">Search exercises</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                            <p className="text-2xl font-black">02</p>
                            <p className="mt-1 text-sm text-slate-300">Save workout logs</p>
                        </div>
                    </div>
                </div>

                <div className="panel-fade rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-8">
                    <h2 className="text-3xl font-black text-slate-950">Log In</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Enter your account details to start logging your next exercise.</p>

                    <form onSubmit={this.OnSubmit} className="mt-6 space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">Username</label>
                            <input
                                type="text"
                                required
                                maxLength={32}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                value={this.state.username}
                                onChange={this.OnUserNameChanged}
                                placeholder="Your username"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">Password</label>
                            <input
                                type="password"
                                required
                                maxLength={72}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                                value={this.state.password}
                                onChange={this.OnChangePassword}
                                placeholder="Your password"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={this.state.isSubmitting}
                            className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {this.state.isSubmitting ? "Logging In..." : "Log In"}
                        </button>
                    </form>

                    <p className="mt-5 text-center text-sm text-slate-600">
                        New here?{" "}
                        <Link to="/user" className="font-black text-cyan-700 no-underline transition hover:text-rose-600">
                            Create an account
                        </Link>
                    </p>
                </div>
            </div>
        );
    }
}

export default function LoginUserWithRouter(props) {
    const location = useLocation();
    const navigate = useNavigate();

    return <LoginUser {...props} location={location} navigate={navigate} />;
}
