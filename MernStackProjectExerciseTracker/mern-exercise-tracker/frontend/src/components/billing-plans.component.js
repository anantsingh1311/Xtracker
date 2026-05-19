import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createBillingOrder, fetchBillingPlans, fetchBillingStatus, verifyBillingPayment } from "../services/api";
import { getAuthChangeEventName, getStoredUser, mergeStoredUser } from "../utils/auth";
import { SITE_LOGO_SRC, SITE_NAME } from "../utils/branding";

let razorpayScriptPromise = null;

function loadRazorpayCheckout() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Checkout is available only in the browser."));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise;
  }

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay checkout."));
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

function formatInr(amountPaise) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(Number(amountPaise || 0) / 100);
}

function formatPaidUntil(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function getCheckoutLogoUrl() {
  if (typeof window === "undefined") {
    return SITE_LOGO_SRC;
  }

  return new URL(SITE_LOGO_SRC, window.location.origin).toString();
}

function createCheckoutPromise(options) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (callback, value) => {
      if (settled) {
        return;
      }

      settled = true;
      callback(value);
    };
    const checkout = new window.Razorpay({
      ...options,
      handler: (response) => settle(resolve, response),
      modal: {
        ondismiss: () => settle(reject, new Error("Checkout was closed before payment."))
      }
    });

    checkout.on("payment.failed", (response) => {
      const description = response?.error?.description || response?.error?.reason || "Payment failed. Please try again.";
      settle(reject, new Error(description));
    });
    checkout.open();
  });
}

export default function BillingPlans() {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [plansData, setPlansData] = useState(null);
  const [billingStatus, setBillingStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [checkoutPlanId, setCheckoutPlanId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const plans = useMemo(() => plansData?.plans || [], [plansData]);
  const activeBilling = billingStatus?.billing || currentUser?.billing || null;
  const activePlanId = activeBilling?.isPro ? activeBilling.planId : "free";

  useEffect(() => {
    const syncUser = () => setCurrentUser(getStoredUser());

    window.addEventListener("storage", syncUser);
    window.addEventListener(getAuthChangeEventName(), syncUser);

    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener(getAuthChangeEventName(), syncUser);
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    setIsLoading(true);
    fetchBillingPlans()
      .then((data) => {
        if (isCurrent) {
          setPlansData(data);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setError("Could not load Pro plans right now.");
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setBillingStatus(null);
      return undefined;
    }

    let isCurrent = true;

    fetchBillingStatus()
      .then((status) => {
        if (isCurrent) {
          setBillingStatus(status);
          mergeStoredUser({ aiQuota: status.aiQuota, billing: status.billing });
        }
      })
      .catch(() => {
        if (isCurrent) {
          setBillingStatus(null);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [currentUser]);

  const handleCheckout = async (plan) => {
    if (!currentUser) {
      setError("Log in first, then choose a Pro pass.");
      setMessage("");
      return;
    }

    if (!plansData?.paymentGatewayConfigured) {
      setError("Payments need Razorpay keys on the backend before checkout can open.");
      setMessage("");
      return;
    }

    setCheckoutPlanId(plan.id);
    setError("");
    setMessage("Opening secure Razorpay checkout...");

    try {
      const checkoutData = await createBillingOrder(plan.id);
      await loadRazorpayCheckout();

      const response = await createCheckoutPromise({
        amount: checkoutData.order.amount,
        currency: checkoutData.order.currency,
        description: `${checkoutData.plan.name} - ${checkoutData.plan.periodLabel}`,
        image: getCheckoutLogoUrl(),
        key: checkoutData.razorpayKeyId,
        name: SITE_NAME,
        notes: {
          app: "xtracker",
          planId: plan.id
        },
        order_id: checkoutData.order.id,
        prefill: {
          name: currentUser.username
        },
        theme: {
          color: "#0891b2"
        }
      });
      const verified = await verifyBillingPayment({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      });

      mergeStoredUser({ aiQuota: verified.aiQuota, billing: verified.billing });
      setBillingStatus({ aiQuota: verified.aiQuota, billing: verified.billing });
      setMessage(verified.message || "Shaky Pro is active.");
    } catch (checkoutError) {
      setError(checkoutError?.message || "Checkout could not finish.");
      setMessage("");
    } finally {
      setCheckoutPlanId("");
    }
  };

  return (
    <section className="page-fade py-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-700">India-first Pro pass</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Make XTracker sharper than a basic workout log.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
            XTracker Pro sells the part users actually feel: more Shaky AI coaching, body-map prompts, body photo analysis, and practical plans built around their saved measurements.
          </p>
        </div>

        <aside className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-lg">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Current access</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            {activeBilling?.isPro ? "Shaky Pro" : "Free"}
          </h2>
          {activeBilling?.isPro && (
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Active until {formatPaidUntil(activeBilling.paidUntil)}
            </p>
          )}
          {!currentUser && (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Log in or create an account before checkout.
            </p>
          )}
          {currentUser && billingStatus?.aiQuota && (
            <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-800">
              {Number(billingStatus.aiQuota.remainingTokens || 0).toLocaleString("en-IN")} AI tokens left this month
            </p>
          )}
        </aside>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ["UPI-native pricing", "Low ticket monthly and annual passes match how Indian users already pay for digital products."],
          ["Not another gym pass", "The value is independent coaching and logging, so users can train at home, at a local gym, or with basic equipment."],
          ["AI with body context", "Shaky can use profile measurements, selected muscles, recent logs, and one-time photo analysis for practical planning."]
        ].map(([title, description]) => (
          <div key={title} className="soft-card rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
            <h2 className="text-xl font-black text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        ))}
      </div>

      {message && (
        <p className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {isLoading && (
          <p className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-600 shadow-lg lg:col-span-3">
            Loading plans...
          </p>
        )}

        {!isLoading && plans.map((plan) => {
          const isFree = plan.id === "free";
          const isActive = activePlanId === plan.id;
          const isCheckingOut = checkoutPlanId === plan.id;

          return (
            <article
              key={plan.id}
              className={`soft-card rounded-3xl border p-5 shadow-xl ${
                plan.recommended
                  ? "border-cyan-300 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-950"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-xs font-black uppercase tracking-[0.18em] ${plan.recommended ? "text-cyan-200" : "text-cyan-700"}`}>
                    {plan.badge}
                  </p>
                  <h2 className="mt-3 text-2xl font-black">{plan.name}</h2>
                </div>
                {plan.recommended && (
                  <span className="rounded-2xl bg-cyan-300 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-950">
                    Pick
                  </span>
                )}
              </div>

              <p className={`mt-5 text-4xl font-black ${plan.recommended ? "text-white" : "text-slate-950"}`}>
                {formatInr(plan.amount)}
              </p>
              <p className={`mt-1 text-sm font-bold ${plan.recommended ? "text-slate-300" : "text-slate-500"}`}>
                {plan.periodLabel}
              </p>

              <div className="mt-5 space-y-3">
                {plan.features.map((feature) => (
                  <p key={feature} className={`rounded-2xl px-4 py-3 text-sm font-semibold leading-6 ${plan.recommended ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-700"}`}>
                    {feature}
                  </p>
                ))}
              </div>

              {isFree ? (
                <button
                  className="mt-6 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-slate-500"
                  disabled
                  type="button"
                >
                  Free tier
                </button>
              ) : currentUser ? (
                <button
                  className={`mt-6 w-full rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    plan.recommended
                      ? "bg-cyan-300 text-slate-950 hover:bg-lime-300"
                      : "bg-slate-950 text-white hover:bg-cyan-700"
                  }`}
                  disabled={isCheckingOut || isActive}
                  onClick={() => handleCheckout(plan)}
                  type="button"
                >
                  {isActive ? "Active" : isCheckingOut ? "Opening..." : plan.checkoutLabel}
                </button>
              ) : (
                <Link
                  to="/login-user"
                  className={`mt-6 block rounded-2xl px-4 py-3 text-center text-sm font-black uppercase tracking-[0.16em] no-underline transition ${
                    plan.recommended
                      ? "bg-cyan-300 text-slate-950 hover:bg-lime-300"
                      : "bg-slate-950 text-white hover:bg-cyan-700"
                  }`}
                >
                  Log in to buy
                </Link>
              )}
            </article>
          );
        })}
      </div>

      {!plansData?.paymentGatewayConfigured && !isLoading && (
        <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          Checkout is hidden until Razorpay keys are configured on the backend.
        </p>
      )}
    </section>
  );
}
