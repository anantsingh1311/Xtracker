const { getDefaultMonthlyTokenLimit } = require("./ai-quota");

const DAY_MS = 24 * 60 * 60 * 1000;
const INR = "INR";
const RAZORPAY_PROVIDER = "razorpay";

function readPositiveInteger(value, fallback) {
    const number = Number(value);

    return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function readPriceInPaise(envName, fallbackInr) {
    return readPositiveInteger(process.env[envName], fallbackInr) * 100;
}

function buildPlanDefinitions() {
    const freeAiLimit = getDefaultMonthlyTokenLimit();

    return [
        {
            id: "free",
            name: "XTracker Free",
            amountPaise: 0,
            currency: INR,
            durationDays: 0,
            aiMonthlyTokenLimit: freeAiLimit,
            badge: "Free",
            periodLabel: "Forever",
            checkoutLabel: "Current free plan",
            features: [
                "Exercise search and workout logs",
                "Fitness profile and calorie estimates",
                "Starter Shaky AI allowance"
            ]
        },
        {
            id: "pro_monthly",
            name: "Shaky Pro Monthly",
            amountPaise: readPriceInPaise("XTRACKER_PRO_MONTHLY_PRICE_INR", 149),
            currency: INR,
            durationDays: readPositiveInteger(process.env.XTRACKER_PRO_MONTHLY_DAYS, 30),
            aiMonthlyTokenLimit: readPositiveInteger(process.env.XTRACKER_PRO_MONTHLY_AI_TOKENS, 150000),
            badge: "UPI starter",
            periodLabel: "30 days",
            checkoutLabel: "Start monthly pass",
            features: [
                "Higher Shaky AI coaching allowance",
                "Body photo and body-map coaching prompts",
                "Workout, diet, recovery and progress-plan support"
            ]
        },
        {
            id: "pro_yearly",
            name: "Shaky Pro Annual",
            amountPaise: readPriceInPaise("XTRACKER_PRO_YEARLY_PRICE_INR", 999),
            currency: INR,
            durationDays: readPositiveInteger(process.env.XTRACKER_PRO_YEARLY_DAYS, 365),
            aiMonthlyTokenLimit: readPositiveInteger(process.env.XTRACKER_PRO_YEARLY_AI_TOKENS, 300000),
            badge: "Best value",
            periodLabel: "365 days",
            checkoutLabel: "Get annual pass",
            recommended: true,
            features: [
                "Lowest effective monthly price",
                "Largest Shaky AI coaching allowance",
                "Built for Indian users who prefer UPI-first passes"
            ]
        }
    ];
}

function getBillingPlans() {
    return buildPlanDefinitions();
}

function getBillingPlanById(planId) {
    return getBillingPlans().find((plan) => plan.id === planId) || null;
}

function formatAmountRupees(amountPaise) {
    return Math.round(amountPaise / 100);
}

function buildPublicBillingPlans() {
    return getBillingPlans().map((plan) => ({
        aiMonthlyTokenLimit: plan.aiMonthlyTokenLimit,
        amount: plan.amountPaise,
        badge: plan.badge,
        checkoutLabel: plan.checkoutLabel,
        currency: plan.currency,
        durationDays: plan.durationDays,
        features: plan.features,
        id: plan.id,
        name: plan.name,
        periodLabel: plan.periodLabel,
        priceInr: formatAmountRupees(plan.amountPaise),
        recommended: Boolean(plan.recommended)
    }));
}

function getRazorpayKeyId() {
    return process.env.RAZORPAY_KEY_ID || "";
}

function getRazorpayKeySecret() {
    return process.env.RAZORPAY_KEY_SECRET || "";
}

function isRazorpayConfigured() {
    return Boolean(getRazorpayKeyId() && getRazorpayKeySecret());
}

function getSafeDate(value) {
    const date = value ? new Date(value) : null;

    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

function toPlainBilling(value) {
    if (!value) {
        return {};
    }

    return typeof value.toObject === "function" ? value.toObject() : value;
}

function isPaidPlanActive(billing = {}, now = new Date()) {
    const plan = getBillingPlanById(billing.plan);
    const paidUntil = getSafeDate(billing.paidUntil);

    return Boolean(plan && plan.id !== "free" && billing.status === "active" && paidUntil && paidUntil > now);
}

function applyAiTokenLimit(userDoc, tokenLimit) {
    const quota = userDoc.aiQuota || {};

    if (Number(quota.monthlyTokenLimit || 0) >= tokenLimit) {
        return false;
    }

    userDoc.aiQuota = {
        ...quota,
        monthlyTokenLimit: tokenLimit,
        updatedAt: new Date()
    };
    userDoc.markModified("aiQuota");
    return true;
}

function downgradeExpiredAiTokenLimit(userDoc) {
    const quota = userDoc.aiQuota || {};
    const defaultLimit = getDefaultMonthlyTokenLimit();

    if (Number(quota.monthlyTokenLimit || 0) <= defaultLimit) {
        return false;
    }

    userDoc.aiQuota = {
        ...quota,
        monthlyTokenLimit: defaultLimit,
        updatedAt: new Date()
    };
    userDoc.markModified("aiQuota");
    return true;
}

function ensureBillingEntitlements(userDoc) {
    const billing = toPlainBilling(userDoc.billing);
    const now = new Date();
    let changed = false;

    if (isPaidPlanActive(billing, now)) {
        const plan = getBillingPlanById(billing.plan);
        changed = applyAiTokenLimit(userDoc, plan.aiMonthlyTokenLimit) || changed;
    } else if (billing.status === "active") {
        userDoc.billing = {
            ...billing,
            status: "expired",
            updatedAt: now
        };
        userDoc.markModified("billing");
        changed = true;
        changed = downgradeExpiredAiTokenLimit(userDoc) || changed;
    }

    return changed;
}

function buildBillingPayload(userDoc) {
    const billing = toPlainBilling(userDoc.billing);
    const now = new Date();
    const paidUntil = getSafeDate(billing.paidUntil);
    const active = isPaidPlanActive(billing, now);
    const paidPlan = getBillingPlanById(billing.plan);
    const displayPlan = active && paidPlan ? paidPlan : getBillingPlanById("free");

    return {
        isPro: active,
        paidUntil: paidUntil ? paidUntil.toISOString() : null,
        planId: displayPlan.id,
        planName: displayPlan.name,
        provider: RAZORPAY_PROVIDER,
        status: active ? "active" : billing.status === "expired" ? "expired" : "free",
        lastPayment: billing.lastPayment
            ? {
                amount: billing.lastPayment.amount,
                currency: billing.lastPayment.currency,
                paidAt: billing.lastPayment.paidAt,
                paymentId: billing.lastPayment.paymentId,
                planId: billing.lastPayment.planId
            }
            : null
    };
}

function applyPaidPlan(userDoc, planId, payment = {}) {
    const plan = getBillingPlanById(planId);

    if (!plan || plan.id === "free") {
        throw new Error("Invalid paid plan.");
    }

    const now = new Date();
    const currentBilling = toPlainBilling(userDoc.billing);
    const currentPaidUntil = getSafeDate(currentBilling.paidUntil);
    const extensionStart = currentPaidUntil && currentPaidUntil > now ? currentPaidUntil : now;
    const paidUntil = new Date(extensionStart.getTime() + plan.durationDays * DAY_MS);

    userDoc.billing = {
        ...currentBilling,
        lastPayment: {
            amount: plan.amountPaise,
            currency: plan.currency,
            orderId: payment.orderId || "",
            paidAt: now,
            paymentId: payment.paymentId || "",
            planId: plan.id,
            provider: RAZORPAY_PROVIDER
        },
        paidUntil,
        plan: plan.id,
        status: "active",
        updatedAt: now
    };
    userDoc.markModified("billing");
    applyAiTokenLimit(userDoc, plan.aiMonthlyTokenLimit);

    return buildBillingPayload(userDoc);
}

module.exports = {
    RAZORPAY_PROVIDER,
    applyPaidPlan,
    buildBillingPayload,
    buildPublicBillingPlans,
    ensureBillingEntitlements,
    getBillingPlanById,
    getBillingPlans,
    getRazorpayKeyId,
    getRazorpayKeySecret,
    isRazorpayConfigured
};
