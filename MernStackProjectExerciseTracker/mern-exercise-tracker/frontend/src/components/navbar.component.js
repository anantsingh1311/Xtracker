import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { clearStoredUser, getAuthChangeEventName, getStoredUser, isAdmin } from "../utils/auth";
import { BUILDER_NAME, BUILDER_URL, SITE_LOGO_SRC, SITE_NAME, SITE_TAGLINE } from "../utils/branding";

export default class Navbar extends Component {

  constructor(props) {
    super(props);

    this.state = {
      user: getStoredUser(),
      isMenuOpen: false
    };
  }

  componentDidMount() {
    window.addEventListener("storage", this.syncUser);
    window.addEventListener(getAuthChangeEventName(), this.syncUser);
  }

  componentWillUnmount() {
    window.removeEventListener("storage", this.syncUser);
    window.removeEventListener(getAuthChangeEventName(), this.syncUser);
  }

  syncUser = () => {
    this.setState({ user: getStoredUser() });
  }

  toggleMenu = () => {
    this.setState((state) => ({ isMenuOpen: !state.isMenuOpen }));
  }

  closeMenu = () => {
    this.setState({ isMenuOpen: false });
  }

  handleLogout = () => {
    clearStoredUser();
    this.setState({ user: null, isMenuOpen: false });
    window.location = '/';
  }

  renderLinks(isMobileMenu = false) {
    const { user } = this.state;
    const linkClass = "rounded-2xl px-4 py-2 text-sm font-bold text-slate-200 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-4 focus:ring-cyan-400/30";
    const builderLinkClass = isMobileMenu
      ? `${linkClass} border border-white/10 bg-white/5`
      : `${linkClass} hidden border border-white/10 bg-white/5 xl:inline-flex`;
    const builderLink = (
      <a
        onClick={this.closeMenu}
        href={BUILDER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={builderLinkClass}
        aria-label={`Open ${BUILDER_NAME} website`}
      >
        Built by {BUILDER_NAME}
      </a>
    );

    if (!user) {
      return (
        <>
          {builderLink}
          <Link onClick={this.closeMenu} to="/login-user" className={linkClass}>Log In</Link>
          <Link onClick={this.closeMenu} to="/user" className={linkClass}>Create User</Link>
        </>
      );
    }

    return (
      <>
        {builderLink}
        {isAdmin(user) && <Link onClick={this.closeMenu} to="/admin" className={linkClass}>Admin</Link>}
        <Link onClick={this.closeMenu} to="/Excercises" className={linkClass}>Logged Exercises</Link>
        <Link onClick={this.closeMenu} to="/exercise-library" className={linkClass}>Exercise Library</Link>
        <Link onClick={this.closeMenu} to="/custom-exercises/new" className={linkClass}>Add Exercise</Link>
        <Link onClick={this.closeMenu} to="/profile" className={linkClass}>Profile</Link>
        <Link onClick={this.closeMenu} to="/create" className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-lime-300 focus:outline-none focus:ring-4 focus:ring-cyan-300/40">
          Create Log
        </Link>
        <button onClick={this.handleLogout} className="rounded-2xl px-4 py-2 text-left text-sm font-bold text-slate-300 transition hover:-translate-y-0.5 hover:bg-rose-500/15 hover:text-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-400/30">
          Log Out
        </button>
      </>
    );
  }

  render() {
    return (
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 lg:px-8">
        <nav className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-slate-950/95 px-4 py-3 shadow-xl shadow-slate-950/10 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <Link onClick={this.closeMenu} to="/" className="group flex items-center gap-3 no-underline">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white p-1.5 shadow-lg transition group-hover:-rotate-3 group-hover:scale-105">
                <img
                  src={SITE_LOGO_SRC}
                  alt={`${SITE_NAME} logo`}
                  className="h-full w-full object-contain"
                />
              </span>
              <span>
                <span className="block text-lg font-black tracking-tight text-white">{SITE_NAME}</span>
                <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">{SITE_TAGLINE}</span>
              </span>
            </Link>

          <div className="navbar-desktop-links hidden items-center gap-2 md:flex">
            {this.renderLinks()}
          </div>

            <button
              type="button"
              onClick={this.toggleMenu}
              className="navbar-menu-button rounded-2xl border border-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-cyan-400/30 md:hidden"
              aria-expanded={this.state.isMenuOpen}
            >
              Menu
            </button>
          </div>

          <div className={`grid transition-all duration-300 md:hidden ${this.state.isMenuOpen ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="overflow-hidden">
              <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
                {this.renderLinks(true)}
              </div>
            </div>
          </div>
        </nav>
      </header>
    );
  }
}
