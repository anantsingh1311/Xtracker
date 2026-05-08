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

  const dashboardStats = useMemo(() => ([
    ["Signed-up users", summary?.totalUsers],
    ["Admins", summary?.adminUsers],
    ["Workout logs", summary?.workoutLogCount],
    ["Content items", summary?.contentCount],
    ["AI tokens used", summary?.aiTokensUsed],
    ["AI tokens allocated", summary?.aiTokensAllocated]
  ]), [summary]);
  const quotaConfig = summary?.aiQuotaConfig || {};
  const defaultMonthlyTokenLimit = quotaConfig.defaultMonthlyTokenLimit ?? summary?.defaultMonthlyTokenLimit ?? 0;
  const maxMonthlyTokenLimit = quotaConfig.maxMonthlyTokenLimit ?? defaultMonthlyTokenLimit;
  const tokenLimitInputStep = quotaConfig.tokenLimitInputStep ?? 1;

  const syncStoredCurrentUser = useCallback((userList) => {
    const storedUser = getStoredUser();
    const updatedCurrentUser = userList.find((user) => user.userId === storedUser?.userId);

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
      const [summaryData, usersData, settingsData, contentData] = await Promise.all([
        fetchAdminSummary(),
        fetchAdminUsers(),
        fetchAdminSettings(),
        fetchAdminContent()
      ]);

      setSummary(summaryData);
      setUsers(usersData);
      setSettingsForm(readSettingsForm(settingsData));
      setContent(contentData);
      setQuotaDrafts(Object.fromEntries(usersData.map((user) => [
        user.userId,
        String(user.aiQuota?.monthlyTokenLimit || 0)
      ])));
      syncStoredCurrentUser(usersData);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not load the admin dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [syncStoredCurrentUser]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const replaceUser = (updatedUser) => {
    setUsers((currentUsers) => currentUsers.map((user) => (
      user.userId === updatedUser.userId ? updatedUser : user
    )));
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
        message: requestError.response?.data?.message || "Could not update this user's token allowance.",
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
        message: `${updatedUser.username}'s limit is back to ${formatNumber(updatedUser.aiQuota?.monthlyTokenLimit)} and usage is reset.`,
        title: "Default quota restored",
        type: "success"
      });
    } catch (requestError) {
      showToast({
        message: requestError.response?.data?.message || "Could not reset this user's token allowance.",
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
        message: `Applied ${formatNumber(result.monthlyTokenLimit)} monthly AI tokens to ${formatNumber(result.matchedCount)} users.`,
        title: "Default quota applied",
        type: "success"
      });
    } catch (requestError) {
      showToast({
        message: requestError.response?.data?.message || "Could not apply the default token allowance.",
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
        message: requestError.response?.data?.message || "Could not update this user's role.",
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
        message: requestError.response?.data?.message || "Could not update site settings.",
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
        message: requestError.response?.data?.message || "Could not save this content.",
        title: "Content failed",
        type: "error"
      });
    } finally {
      setIsSavingContent(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-fade mx-auto max-w-6xl py-8">
        <p className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-600 shadow-lg">
          Loading admin dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="page-fade mx-auto max-w-7xl py-6">
      <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-2xl sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-200">Admin dashboard</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Control XTracker safely.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Signed in as {currentUser?.username}. Manage users, AI token allowances, app settings, and exercise content from guarded admin APIs.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAdminData}
            className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {dashboardStats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{formatNumber(value)}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Users</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">AI token allowances</h2>
          </div>
          <p className="text-sm font-semibold text-slate-500">Monthly token budgets are enforced by the backend chat route.</p>
        </div>
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-slate-700">
            Backend default: {formatNumber(defaultMonthlyTokenLimit)} tokens per month. Admin ceiling: {formatNumber(maxMonthlyTokenLimit)}.
          </p>
          <button
            type="button"
            onClick={handleApplyDefaultQuota}
            disabled={isApplyingDefaultQuota}
            className="rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isApplyingDefaultQuota ? "Applying..." : "Apply Default To All"}
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
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
              {users.map((user) => (
                <tr key={user.userId} className="bg-slate-50">
                  <td className="rounded-l-2xl px-3 py-3">
                    <p className="font-black text-slate-950">{user.username}</p>
                    <p className="text-xs font-semibold text-slate-500">{user.profileComplete ? "Profile complete" : "Profile incomplete"}</p>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={user.role}
                      onChange={(event) => handleRoleChange(user, event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800"
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
                      onChange={(event) => setQuotaDrafts((drafts) => ({ ...drafts, [user.userId]: event.target.value }))}
                      className="w-36 rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-900"
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
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSettingsSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-rose-600">App settings</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">Public page controls</h2>

          <label className="mt-5 flex items-center gap-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={settingsForm.announcement.enabled}
              onChange={(event) => handleSettingsChange("announcement", "enabled", event.target.checked)}
              className="h-5 w-5 rounded border-slate-300"
            />
            Show announcement on home page
          </label>

          <div className="mt-4 grid gap-4">
            <input
              type="text"
              maxLength={100}
              value={settingsForm.announcement.title}
              onChange={(event) => handleSettingsChange("announcement", "title", event.target.value)}
              placeholder="Announcement title"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
            <textarea
              rows="3"
              maxLength={500}
              value={settingsForm.announcement.message}
              onChange={(event) => handleSettingsChange("announcement", "message", event.target.value)}
              placeholder="Announcement message"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
            <input
              type="text"
              maxLength={100}
              value={settingsForm.featuredExercise.title}
              onChange={(event) => handleSettingsChange("featuredExercise", "title", event.target.value)}
              placeholder="Featured exercise title"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
            <textarea
              rows="3"
              maxLength={500}
              value={settingsForm.featuredExercise.description}
              onChange={(event) => handleSettingsChange("featuredExercise", "description", event.target.value)}
              placeholder="Featured exercise description"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
            <input
              type="url"
              maxLength={1000}
              value={settingsForm.featuredExercise.resourceUrl}
              onChange={(event) => handleSettingsChange("featuredExercise", "resourceUrl", event.target.value)}
              placeholder="https://example.com/exercise-resource"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingSettings}
            className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingSettings ? "Saving..." : "Save Settings"}
          </button>
        </form>

        <form onSubmit={handleContentSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-lime-700">Exercise content</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">Add resource</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <input
              type="text"
              name="title"
              required
              maxLength={120}
              value={contentForm.title}
              onChange={handleContentChange}
              placeholder="Content title"
              className="sm:col-span-2 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
            <select
              name="contentType"
              value={contentForm.contentType}
              onChange={handleContentChange}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="exercise">Exercise</option>
              <option value="article">Article</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="document">Document</option>
              <option value="link">Link</option>
              <option value="note">Note</option>
            </select>
            <select
              name="status"
              value={contentForm.status}
              onChange={handleContentChange}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <input
              type="url"
              name="resourceUrl"
              maxLength={1000}
              value={contentForm.resourceUrl}
              onChange={handleContentChange}
              placeholder="https://..."
              className="sm:col-span-2 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
            <input
              type="text"
              name="tags"
              maxLength={480}
              value={contentForm.tags}
              onChange={handleContentChange}
              placeholder="Tags, comma separated"
              className="sm:col-span-2 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
            <textarea
              name="summary"
              rows="3"
              maxLength={500}
              value={contentForm.summary}
              onChange={handleContentChange}
              placeholder="Short summary"
              className="sm:col-span-2 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
            <textarea
              name="body"
              rows="5"
              maxLength={5000}
              value={contentForm.body}
              onChange={handleContentChange}
              placeholder="Exercise notes, instructions, or embedded lesson text"
              className="sm:col-span-2 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingContent}
            className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingContent ? "Saving..." : "Save Content"}
          </button>
        </form>
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Latest content</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {content.length === 0 ? (
            <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">No admin content yet.</p>
          ) : content.map((item) => (
            <article key={item._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">{item.contentType} | {item.status}</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">{item.title}</h3>
                </div>
              </div>
              {item.summary && <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>}
              {item.resourceUrl && (
                <a href={item.resourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-black text-cyan-700">
                  Open resource
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
