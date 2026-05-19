const crypto = require("crypto");
const express = require("express");
const axios = require("axios");
const User = require("../models/user-model");
const requireAuth = require("../middleware/require-auth");
const createRateLimiter = require("../middleware/rate-limit");
const { buildAiQuotaPayload } = require("../utils/ai-quota");
const {
    RAZORPAY_PROVIDER,
    applyPaidPlan,
    buildBillingPayload,
    buildPublicBillingPlans,
    ensureBillingEntitlements,
    getBillingPlanById,
    getRazorpayKeyId,
    getRazorpayKeySecret,
    isRazorpayConfigured
} = require("../utils/billing-plans");

const router = express.Router();
const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";
const PENDING_ORDER_TTL_MS = 24 * 60 * 60 * 1000;
const checkoutRateLimiter = createRateLimiter({
    max: 20,
    message: "Too many payment attempts. Please wait a few minutes and try again.",
    name: "billing-checkout",
    windowMs: 15 * 60 * 1000
});

function normalizePlanId(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeRazorpayId(value, prefix) {
    const id = typeof value === "string" ? value.trim() : "";

    return id.startsWith(prefix) && /^[A-Za-z0-9_]+$/.test(id) ? id : "";
}

function buildReceipt(userId) {
    return `xt_${Date.now().toString(36)}_${String(userId).slice(-8)}`.slice(0, 40);
}

function buildRazorpayAuth() {
    return {
        password: getRazorpayKeySecret(),
        username: getRazorpayKeyId()
    };
}

function cleanPendingOrders(orders = []) {
    const earliestCreatedAt = Date.now() - PENDING_ORDER_TTL_MS;

    return orders
        .filter((order) => {
            const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : 0;

            return order.status === "created" && createdAt >= earliestCreatedAt;
        })
        .slice(-9);
}

function toPlainBilling(value) {
    if (!value) {
        return {};
    }

    return typeof value.toObject === "function" ? value.toObject() : value;
}

function safeCompareHex(left, right) {
    if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) {
        return false;
    }

    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyRazorpaySignature(orderId, paymentId, signature) {
    const expectedSignature = crypto
        .createHmac("sha256", getRazorpayKeySecret())
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

    return safeCompareHex(expectedSignature, signature);
}

async function loadBillingUserDoc(req) {
    const userDoc = await User.findById(req.user.userId).select("username role aiQuota billing fitnessProfile");

    if (!userDoc) {
        const error = new Error("User not found.");
        error.statusCode = 401;
        throw error;
    }

    return userDoc;
}

async function createRazorpayOrder(plan, user) {
    const response = await axios.post(
        RAZORPAY_ORDERS_URL,
        {
            amount: plan.amountPaise,
            currency: plan.currency,
            notes: {
                app: "xtracker",
                planId: plan.id,
                userId: user.userId,
                username: user.username
            },
            receipt: buildReceipt(user.userId)
        },
        {
            auth: buildRazorpayAuth(),
            timeout: 15000
        }
    );

    return response.data;
}

router.get("/plans", (req, res) => {
    return res.json({
        gateway: RAZORPAY_PROVIDER,
        paymentGatewayConfigured: isRazorpayConfigured(),
        plans: buildPublicBillingPlans(),
        razorpayKeyId: getRazorpayKeyId(),
        recommendation: {
            planId: "pro_yearly",
            reason: "Annual pricing keeps the monthly equivalent low for Indian UPI users while still covering AI coaching costs."
        }
    });
});

router.get("/status", requireAuth, async (req, res) => {
    try {
        const userDoc = await loadBillingUserDoc(req);

        if (ensureBillingEntitlements(userDoc)) {
            await userDoc.save();
        }

        return res.json({
            aiQuota: buildAiQuotaPayload(userDoc),
            billing: buildBillingPayload(userDoc)
        });
    } catch (error) {
        console.error("Billing status lookup failed:", {
            message: error?.message || "Unknown error",
            requestId: req.requestId
        });

        return res.status(error.statusCode || 500).json({
            message: error.statusCode === 401 ? "Authentication required" : "Could not load billing status."
        });
    }
});

router.post("/orders", requireAuth, checkoutRateLimiter, async (req, res) => {
    if (!isRazorpayConfigured()) {
        return res.status(503).json({ message: "Payments are not configured yet." });
    }

    const planId = normalizePlanId(req.body?.planId);
    const plan = getBillingPlanById(planId);

    if (!plan || plan.id === "free") {
        return res.status(400).json({ message: "Choose a paid plan to continue." });
    }

    try {
        const userDoc = await loadBillingUserDoc(req);
        const order = await createRazorpayOrder(plan, req.user);
        const currentBilling = toPlainBilling(userDoc.billing);
        const pendingOrders = cleanPendingOrders(currentBilling.pendingOrders || []);

        pendingOrders.push({
            amount: plan.amountPaise,
            createdAt: new Date(),
            currency: plan.currency,
            orderId: order.id,
            planId: plan.id,
            provider: RAZORPAY_PROVIDER,
            status: "created"
        });

        userDoc.billing = {
            ...currentBilling,
            pendingOrders,
            updatedAt: new Date()
        };
        userDoc.markModified("billing");
        await userDoc.save();

        return res.status(201).json({
            gateway: RAZORPAY_PROVIDER,
            order: {
                amount: order.amount,
                currency: order.currency,
                id: order.id,
                planId: plan.id
            },
            plan: {
                id: plan.id,
                name: plan.name,
                periodLabel: plan.periodLabel
            },
            razorpayKeyId: getRazorpayKeyId()
        });
    } catch (error) {
        console.error("Razorpay order creation failed:", {
            message: error?.message || "Unknown error",
            requestId: req.requestId,
            status: error?.response?.status || null
        });

        return res.status(502).json({ message: "Could not start checkout right now." });
    }
});

router.post("/verify", requireAuth, checkoutRateLimiter, async (req, res) => {
    if (!isRazorpayConfigured()) {
        return res.status(503).json({ message: "Payments are not configured yet." });
    }

    const orderId = normalizeRazorpayId(req.body?.razorpay_order_id, "order_");
    const paymentId = normalizeRazorpayId(req.body?.razorpay_payment_id, "pay_");
    const signature = typeof req.body?.razorpay_signature === "string" ? req.body.razorpay_signature.trim() : "";

    if (!orderId || !paymentId || !/^[a-f0-9]{64}$/i.test(signature)) {
        return res.status(400).json({ message: "Payment verification details are invalid." });
    }

    try {
        const userDoc = await loadBillingUserDoc(req);
        const pendingOrders = userDoc.billing?.pendingOrders || [];
        const pendingOrder = pendingOrders.find((order) => order.orderId === orderId && order.status === "created");

        if (!pendingOrder) {
            return res.status(400).json({ message: "This checkout session was not found or was already processed." });
        }

        if (!verifyRazorpaySignature(orderId, paymentId, signature)) {
            pendingOrder.status = "failed";
            userDoc.markModified("billing");
            await userDoc.save();

            return res.status(400).json({ message: "Payment verification failed." });
        }

        const plan = getBillingPlanById(pendingOrder.planId);

        if (!plan || plan.id === "free") {
            return res.status(400).json({ message: "Paid plan could not be matched." });
        }

        pendingOrder.status = "paid";
        pendingOrder.verifiedAt = new Date();

        const billing = applyPaidPlan(userDoc, plan.id, {
            orderId,
            paymentId
        });

        await userDoc.save();

        return res.json({
            aiQuota: buildAiQuotaPayload(userDoc),
            billing,
            message: "Payment verified. Shaky Pro is active."
        });
    } catch (error) {
        console.error("Razorpay payment verification failed:", {
            message: error?.message || "Unknown error",
            requestId: req.requestId
        });

        return res.status(500).json({ message: "Payment was received but could not be activated. Please contact support." });
    }
});

module.exports = router;
