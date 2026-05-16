import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyDefaultAdminAiQuota,
  createAdminContent,
  fetchAdminContent,
  fetchAdminSettings,
  fetchAdminSummary,
  fetchAdminUsers,
  updateAdminSettings,
  updateAdminUserAiQuota,
  updateAdminUserRole
} from "../services/api";
import { getStoredUser, mergeStoredUser } from "../utils/auth";
import { showToast } from "../utils/toast";

const emptyContentForm = {
  body: "",
  contentType: "exercise",
  resourceUrl: "",
  status: "draft",
  summary: "",
  tags: "",
  title: ""
};

const emptySettingsForm = {
  announcement: {
    enabled: false,
    message: "",
    title: ""
  },
  featuredExercise: {
    description: "",
    resourceUrl: "",
    title: ""
  }
};

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function readSettingsForm(settings = {}) {
  return {
    announcement: {
      enabled: Boolean(settings.announcement?.enabled),
      message: settings.announcement?.message || "",
      title: settings.announcement?.title || ""
    },
    featuredExercise: {
      description: settings.featuredExercise?.description || "",
      resourceUrl: settings.featuredExercise?.resourceUrl || "",
      title: settings.featuredExercise?.title || ""
    }
  };
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [content, setContent] = useState([]);
  const [settingsForm, setSettingsForm] = useState(emptySettingsForm);
  const [contentForm, setContentForm] = useState(emptyContentForm);
  const [quotaDrafts, setQuotaDrafts] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isApplyingDefaultQuota, setIsApplyingDefaultQuota] = useState(false);
  const [error, setError] = useState("");

  const currentUser = getStoredUser();

  const dashboardStats = useMemo(
    () => [
      ["Signed-up users", summary?.totalUsers],
      ["Admins", summary?.adminUsers],
      ["Workout logs", summary?.workoutLogCount],
      ["Content items", summary?.contentCount],
      ["AI tokens used", summary?.aiTokensUsed],
      ["AI tokens allocated", summary?.aiTokensAllocated]
    ],
    [summary]
  );

  const quotaConfig = summary?.aiQuotaConfig || {};

  const defaultMonthlyTokenLimit =
    quotaConfig.defaultMonthlyTokenLimit ?? summary?.defaultMonthlyTokenLimit ?? 0;

  const maxMonthlyTokenLimit =
    quotaConfig.maxMonthlyTokenLimit ?? defaultMonthlyTokenLimit;

  const tokenLimitInputStep = quotaConfig.tokenLimitInputStep ?? 1;

  const inputClass =
    "w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100";

  const selectClass =
    "w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100";

  const labelClass =
    "text-xs font-black uppercase tracking-[0.14em] text-slate-500";

  const primaryButtonClass =
    "rounded-2xl bg-slate-950 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60";

  const syncStoredCurrentUser = useCallback((userList) => {
    const storedUser = getStoredUser();

    const updatedCurrentUser = userList.find(
      (user) => user.userId === storedUser?.userId
    );

    if (updatedCurrentUser) {
      mergeStoredUser({
        aiQuota: updatedCurrentUser.aiQuota,
        role: updatedCurrentUser.role
      });
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    setError("");

    try {
      const [summaryData, usersData, settingsData, contentData] =
        await Promise.all([
          fetchAdminSummary(),
          fetchAdminUsers(),
          fetchAdminSettings(),
          fetchAdminContent()
        ]);

      setSummary(summaryData);
      setUsers(usersData);
      setSettingsForm(readSettingsForm(settingsData));
      setContent(contentData);

      setQuotaDrafts(
        Object.fromEntries(
          usersData.map((user) => [
            user.userId,
            String(user.aiQuota?.monthlyTokenLimit || 0)
          ])
        )
      );

      syncStoredCurrentUser(usersData);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not load the admin dashboard."
      );
    } finally {
      setIsLoading(false);
    }
  }, [syncStoredCurrentUser]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const replaceUser = (updatedUser) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.userId === updatedUser.userId ? updatedUser : user
      )
    );

    setQuotaDrafts((currentDrafts) => ({
      ...currentDrafts,
      [updatedUser.userId]: String(updatedUser.aiQuota?.monthlyTokenLimit || 0)
    }));

    syncStoredCurrentUser([updatedUser]);
  };

  const handleQuotaSave = async (user, resetUsage = false) => {
    try {
      const updatedUser = await updateAdminUserAiQuota(user.userId, {
        monthlyTokenLimit: Number(quotaDrafts[user.userId]),
        resetUsage
      });

      replaceUser(updatedUser);

      showToast({
        message: `${updatedUser.username}'s AI token allowance was updated.`,
        title: "Admin change saved",
        type: "success"
      });
    } catch (requestError) {
      showToast({
        message:
          requestError.response?.data?.message ||
          "Could not update this user's token allowance.",
        title: "Admin save failed",
        type: "error"
      });
    }
  };

  const handleResetUserToDefaultQuota = async (user) => {
    try {
      const updatedUser = await updateAdminUserAiQuota(user.userId, {
        monthlyTokenLimit: defaultMonthlyTokenLimit,
        resetUsage: true
      });

      replaceUser(updatedUser);

      showToast({
        message: `${updatedUser.username}'s limit is back to ${formatNumber(
          updatedUser.aiQuota?.monthlyTokenLimit
        )} and usage is reset.`,
        title: "Default quota restored",
        type: "success"
      });
    } catch (requestError) {
      showToast({
        message:
          requestError.response?.data?.message ||
          "Could not reset this user's token allowance.",
        title: "Reset failed",
        type: "error"
      });
    }
  };

  const handleApplyDefaultQuota = async () => {
    setIsApplyingDefaultQuota(true);

    try {
      const result = await applyDefaultAdminAiQuota();

      await loadAdminData();

      showToast({
        message: `Applied ${formatNumber(
          result.monthlyTokenLimit
        )} monthly AI tokens to ${formatNumber(result.matchedCount)} users.`,
        title: "Default quota applied",
        type: "success"
      });
    } catch (requestError) {
      showToast({
        message:
          requestError.response?.data?.message ||
          "Could not apply the default token allowance.",
        title: "Bulk update failed",
        type: "error"
      });
    } finally {
      setIsApplyingDefaultQuota(false);
    }
  };

  const handleRoleChange = async (user, role) => {
    try {
      const updatedUser = await updateAdminUserRole(user.userId, { role });

      replaceUser(updatedUser);

      showToast({
        message: `${updatedUser.username} is now ${updatedUser.role}.`,
        title: "Role updated",
        type: "success"
      });
    } catch (requestError) {
      showToast({
        message:
          requestError.response?.data?.message ||
          "Could not update this user's role.",
        title: "Role update failed",
        type: "error"
      });
    }
  };

  const handleSettingsChange = (section, field, value) => {
    setSettingsForm((currentForm) => ({
      ...currentForm,
      [section]: {
        ...currentForm[section],
        [field]: value
      }
    }));
  };

  const handleSettingsSubmit = async (event) => {
    event.preventDefault();

    setIsSavingSettings(true);

    try {
      const updatedSettings = await updateAdminSettings(settingsForm);

      setSettingsForm(readSettingsForm(updatedSettings));

      showToast({
        message: "The public app settings were updated.",
        title: "Settings saved",
        type: "success"
      });
    } catch (requestError) {
      showToast({
        message:
          requestError.response?.data?.message ||
          "Could not update site settings.",
        title: "Settings failed",
        type: "error"
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleContentChange = (event) => {
    const { name, value } = event.target;

    setContentForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }));
  };

  const handleContentSubmit = async (event) => {
    event.preventDefault();

    setIsSavingContent(true);

    try {
      const savedContent = await createAdminContent(contentForm);

      setContent((currentContent) => [savedContent, ...currentContent]);
      setContentForm(emptyContentForm);

      showToast({
        message: "Exercise content was saved.",
        title: "Content saved",
        type: "success"
      });
    } catch (requestError) {
      showToast({
        message:
          requestError.response?.data?.message ||
          "Could not save this content.",
        title: "Content failed",
        type: "error"
      });
    } finally {
      setIsSavingContent(false);
    }
  };

  if (isLoading) {
    return (
      <main className="page-fade min-h-screen w-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-screen-2xl">
          <p className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-600 shadow-lg">
            Loading admin dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-fade min-h-screen w-full overflow-x-hidden bg-slate-50 px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-screen-2xl space-y-5 sm:space-y-6">
        <section className="overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-2xl sm:p-7 lg:p-8">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200 sm:text-sm sm:tracking-[0.3em]">
                Admin dashboard
              </p>

              <h1 className="mt-4 max-w-5xl text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                Control XTracker safely.
              </h1>

              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300 sm:text-base">
                Signed in as{" "}
                <span className="font-black text-white">
                  {currentUser?.username || "Admin"}
                </span>
                . Manage users, AI token allowances, app settings, and exercise
                content from guarded admin APIs.
              </p>
            </div>

            <button
              type="button"
              onClick={loadAdminData}
              className="w-full rounded-2xl border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/10 sm:w-auto"
            >
              Refresh
            </button>
          </div>
        </section>

        {error && (
          <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {dashboardStats.map(([label, value]) => (
            <article
              key={label}
              className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg"
            >
              <p className="text-xs font-black uppercase tracking-[0.13em] text-slate-500">
                {label}
              </p>

              <p className="mt-2 break-words text-2xl font-black text-slate-950">
                {formatNumber(value)}
              </p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700 sm:text-sm">
                Users
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                AI token allowances
              </h2>
            </div>

            <p className="max-w-xl text-sm font-semibold leading-6 text-slate-500 xl:text-right">
              Monthly token budgets are enforced by the backend chat route.
            </p>
          </div>

          <div className="mt-4 grid gap-3 rounded-2xl bg-slate-100 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <p className="text-sm font-bold leading-6 text-slate-700">
              Backend default:{" "}
              <span className="font-black text-slate-950">
                {formatNumber(defaultMonthlyTokenLimit)}
              </span>{" "}
              tokens per month. Admin ceiling:{" "}
              <span className="font-black text-slate-950">
                {formatNumber(maxMonthlyTokenLimit)}
              </span>
              .
            </p>

            <button
              type="button"
              onClick={handleApplyDefaultQuota}
              disabled={isApplyingDefaultQuota}
              className={`${primaryButtonClass} w-full md:w-auto`}
            >
              {isApplyingDefaultQuota ? "Applying..." : "Apply Default To All"}
            </button>
          </div>

          <div className="mt-5 grid gap-4 xl:hidden">
            {users.length === 0 ? (
              <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
                No users found.
              </p>
            ) : (
              users.map((user) => (
                <article
                  key={user.userId}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="min-w-0">
                    <p className="break-words text-lg font-black text-slate-950">
                      {user.username}
                    </p>

                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {user.profileComplete
                        ? "Profile complete"
                        : "Profile incomplete"}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <label className="block min-w-0">
                      <span className={labelClass}>Role</span>

                      <select
                        value={user.role}
                        onChange={(event) =>
                          handleRoleChange(user, event.target.value)
                        }
                        className={`${selectClass} mt-2`}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>

                    <div className="min-w-0">
                      <p className={labelClass}>Used</p>

                      <p className="mt-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-800">
                        {formatNumber(user.aiQuota?.tokensUsedThisPeriod)}
                      </p>
                    </div>

                    <label className="block min-w-0">
                      <span className={labelClass}>Monthly limit</span>

                      <input
                        type="number"
                        min="0"
                        max={maxMonthlyTokenLimit}
                        step={tokenLimitInputStep}
                        value={quotaDrafts[user.userId] || "0"}
                        onChange={(event) =>
                          setQuotaDrafts((drafts) => ({
                            ...drafts,
                            [user.userId]: event.target.value
                          }))
                        }
                        className={`${inputClass} mt-2`}
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => handleQuotaSave(user)}
                      className="rounded-xl bg-slate-950 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-cyan-700"
                    >
                      Save
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuotaSave(user, true)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-700 transition hover:border-rose-300 hover:text-rose-600"
                    >
                      Reset used
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResetUserToDefaultQuota(user)}
                      className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-cyan-800 transition hover:border-cyan-300 hover:bg-cyan-100"
                    >
                      Default limit
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="mt-5 hidden overflow-x-auto xl:block">
            <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Used</th>
                  <th className="px-3 py-2">Monthly limit</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-600"
                    >
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.userId} className="bg-slate-50">
                      <td className="rounded-l-2xl px-3 py-3">
                        <p className="font-black text-slate-950">
                          {user.username}
                        </p>

                        <p className="text-xs font-semibold text-slate-500">
                          {user.profileComplete
                            ? "Profile complete"
                            : "Profile incomplete"}
                        </p>
                      </td>

                      <td className="px-3 py-3">
                        <select
                          value={user.role}
                          onChange={(event) =>
                            handleRoleChange(user, event.target.value)
                          }
                          className="w-40 rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>

                      <td className="px-3 py-3 font-bold text-slate-700">
                        {formatNumber(user.aiQuota?.tokensUsedThisPeriod)}
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          max={maxMonthlyTokenLimit}
                          step={tokenLimitInputStep}
                          value={quotaDrafts[user.userId] || "0"}
                          onChange={(event) =>
                            setQuotaDrafts((drafts) => ({
                              ...drafts,
                              [user.userId]: event.target.value
                            }))
                          }
                          className="w-44 rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                        />
                      </td>

                      <td className="rounded-r-2xl px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuotaSave(user)}
                            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-cyan-700"
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuotaSave(user, true)}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 transition hover:border-rose-300 hover:text-rose-600"
                          >
                            Reset used
                          </button>

                          <button
                            type="button"
                            onClick={() => handleResetUserToDefaultQuota(user)}
                            className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-800 transition hover:border-cyan-300 hover:bg-cyan-100"
                          >
                            Default limit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl justify-items-end border border-slate-200 bg-white p-4 shadow-xl sm:p-6 md:p-40">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.35fr)] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600 sm:text-sm">
                App settings
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                Public page controls
              </h2>
            </div>

            <p className="text-sm font-semibold leading-6 text-slate-500 lg:text-right">
              Control what appears on the public side of XTracker.
            </p>
          </div>

          <form onSubmit={handleSettingsSubmit} className="mt-5">
            <label className="flex items-start gap-3 text-sm font-bold leading-6 text-slate-700">
              <input
                type="checkbox"
                checked={settingsForm.announcement.enabled}
                onChange={(event) =>
                  handleSettingsChange(
                    "announcement",
                    "enabled",
                    event.target.checked
                  )
                }
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300"
              />

              <span>Show announcement on home page</span>
            </label>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <label className="block min-w-0">
                <span className={labelClass}>Announcement title</span>

                <input
                  type="text"
                  maxLength={100}
                  value={settingsForm.announcement.title}
                  onChange={(event) =>
                    handleSettingsChange(
                      "announcement",
                      "title",
                      event.target.value
                    )
                  }
                  placeholder="Announcement title"
                  className={`${inputClass} mt-2`}
                />
              </label>

              <label className="block min-w-0">
                <span className={labelClass}>Featured exercise title</span>

                <input
                  type="text"
                  maxLength={100}
                  value={settingsForm.featuredExercise.title}
                  onChange={(event) =>
                    handleSettingsChange(
                      "featuredExercise",
                      "title",
                      event.target.value
                    )
                  }
                  placeholder="Featured exercise title"
                  className={`${inputClass} mt-2`}
                />
              </label>

              <label className="block min-w-0">
                <span className={labelClass}>Announcement message</span>

                <textarea
                  rows="4"
                  maxLength={500}
                  value={settingsForm.announcement.message}
                  onChange={(event) =>
                    handleSettingsChange(
                      "announcement",
                      "message",
                      event.target.value
                    )
                  }
                  placeholder="Announcement message"
                  className={`${inputClass} mt-2 min-h-32 resize-y`}
                />
              </label>

              <label className="block min-w-0">
                <span className={labelClass}>Featured exercise description</span>

                <textarea
                  rows="4"
                  maxLength={500}
                  value={settingsForm.featuredExercise.description}
                  onChange={(event) =>
                    handleSettingsChange(
                      "featuredExercise",
                      "description",
                      event.target.value
                    )
                  }
                  placeholder="Featured exercise description"
                  className={`${inputClass} mt-2 min-h-32 resize-y`}
                />
              </label>

              <label className="block min-w-0 lg:col-span-2">
                <span className={labelClass}>Featured exercise URL</span>

                <input
                  type="url"
                  maxLength={1000}
                  value={settingsForm.featuredExercise.resourceUrl}
                  onChange={(event) =>
                    handleSettingsChange(
                      "featuredExercise",
                      "resourceUrl",
                      event.target.value
                    )
                  }
                  placeholder="https://example.com/exercise-resource"
                  className={`${inputClass} mt-2`}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={isSavingSettings}
              className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-56"
            >
              {isSavingSettings ? "Saving..." : "Save Settings"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.35fr)] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-700 sm:text-sm">
                Exercise content
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                Add resource
              </h2>
            </div>

            <p className="text-sm font-semibold leading-6 text-slate-500 lg:text-right">
              This form now uses the full page width instead of getting squeezed.
            </p>
          </div>

          <form onSubmit={handleContentSubmit} className="mt-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="block min-w-0 md:col-span-2 xl:col-span-4">
                <span className={labelClass}>Content title</span>

                <input
                  type="text"
                  name="title"
                  required
                  maxLength={120}
                  value={contentForm.title}
                  onChange={handleContentChange}
                  placeholder="Content title"
                  className={`${inputClass} mt-2`}
                />
              </label>

              <label className="block min-w-0 md:col-span-1 xl:col-span-2">
                <span className={labelClass}>Content type</span>

                <select
                  name="contentType"
                  value={contentForm.contentType}
                  onChange={handleContentChange}
                  className={`${selectClass} mt-2`}
                >
                  <option value="exercise">Exercise</option>
                  <option value="article">Article</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="document">Document</option>
                  <option value="link">Link</option>
                  <option value="note">Note</option>
                </select>
              </label>

              <label className="block min-w-0 md:col-span-1 xl:col-span-2">
                <span className={labelClass}>Status</span>

                <select
                  name="status"
                  value={contentForm.status}
                  onChange={handleContentChange}
                  className={`${selectClass} mt-2`}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              <label className="block min-w-0 md:col-span-2 xl:col-span-4">
                <span className={labelClass}>Resource URL</span>

                <input
                  type="url"
                  name="resourceUrl"
                  maxLength={1000}
                  value={contentForm.resourceUrl}
                  onChange={handleContentChange}
                  placeholder="https://..."
                  className={`${inputClass} mt-2`}
                />
              </label>

              <label className="block min-w-0 md:col-span-2 xl:col-span-4">
                <span className={labelClass}>Tags</span>

                <input
                  type="text"
                  name="tags"
                  maxLength={480}
                  value={contentForm.tags}
                  onChange={handleContentChange}
                  placeholder="Tags, comma separated"
                  className={`${inputClass} mt-2`}
                />
              </label>

              <label className="block min-w-0 md:col-span-2 xl:col-span-4">
                <span className={labelClass}>Short summary</span>

                <textarea
                  name="summary"
                  rows="4"
                  maxLength={500}
                  value={contentForm.summary}
                  onChange={handleContentChange}
                  placeholder="Short summary"
                  className={`${inputClass} mt-2 min-h-32 resize-y`}
                />
              </label>

              <label className="block min-w-0 md:col-span-2 xl:col-span-4">
                <span className={labelClass}>Body / notes / instructions</span>

                <textarea
                  name="body"
                  rows="8"
                  maxLength={5000}
                  value={contentForm.body}
                  onChange={handleContentChange}
                  placeholder="Exercise notes, instructions, or embedded lesson text"
                  className={`${inputClass} mt-2 min-h-56 resize-y`}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={isSavingContent}
              className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-56"
            >
              {isSavingContent ? "Saving..." : "Save Content"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 sm:text-sm">
                Latest content
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                Recently added resources
              </h2>
            </div>

            <p className="text-sm font-semibold text-slate-500">
              {formatNumber(content.length)} item{content.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {content.length === 0 ? (
              <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
                No admin content yet.
              </p>
            ) : (
              content.map((item) => (
                <article
                  key={item._id}
                  className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="min-w-0">
                    <p className="break-words text-xs font-black uppercase tracking-[0.14em] text-cyan-700">
                      {item.contentType} | {item.status}
                    </p>

                    <h3 className="mt-2 break-words text-lg font-black text-slate-950">
                      {item.title}
                    </h3>
                  </div>

                  {item.summary && (
                    <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                      {item.summary}
                    </p>
                  )}

                  {item.resourceUrl && (
                    <a
                      href={item.resourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block max-w-full break-words text-sm font-black text-cyan-700 hover:text-cyan-900"
                    >
                      Open resource
                    </a>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}