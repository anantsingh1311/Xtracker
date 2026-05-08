const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, ".env"), quiet: true });
dotenv.config({ quiet: true });

const excerciseRouter = require("./routes/excercise");
const userRouter = require("./routes/user");
const authUserRoutes = require("./routes/auth");
const adminRouter = require("./routes/admin");
const externalExerciseRouter = require("./routes/externalExercises");
const customExerciseRouter = require("./routes/custom-exercises");
const chatbotRouter = require("./routes/chatbot-router");
const siteSettingsRouter = require("./routes/site-settings");
const { ensureBootstrapAdmin } = require("./utils/admin-bootstrap");
const { assertProductionSessionSecret } = require("./utils/session-token");

const app = express();
const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.ATLAS_URI;
const isProduction = process.env.NODE_ENV === "production";
const clientOrigins = (process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const buildPath = path.resolve(__dirname, "..", "build");
const buildIndexPath = path.join(buildPath, "index.html");

assertProductionSessionSecret();

function buildCorsOptions() {
    if (clientOrigins.length) {
        return {
            origin(origin, callback) {
                if (!origin || clientOrigins.includes(origin)) {
                    return callback(null, true);
                }

                return callback(new Error("Not allowed by CORS"));
            }
        };
    }

    return isProduction ? null : undefined;
}

function buildContentSecurityPolicy() {
    const directives = [
        "default-src 'self'",
        "base-uri 'self'",
        "connect-src 'self'",
        "font-src 'self' data:",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "img-src 'self' data: blob: https://wger.de https://*.wger.de",
        "media-src 'self' blob: https://wger.de https://*.wger.de",
        "object-src 'none'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'"
    ];

    if (isProduction) {
        directives.push("upgrade-insecure-requests");
    }

    return directives.join("; ");
}

app.set("trust proxy", 1);
app.set("query parser", "simple");
app.disable("x-powered-by");
app.use((req, res, next) => {
    req.requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    res.set({
        "Content-Security-Policy": buildContentSecurityPolicy(),
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Request-Id": req.requestId,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY"
    });

    if (isProduction) {
        res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    next();
});
const corsOptions = buildCorsOptions();
if (corsOptions !== null) {
    app.use(cors(corsOptions));
}
app.use(express.json({ limit: "100kb" }));

mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error.message);
});

if (mongoUri) {
    mongoose
        .connect(mongoUri)
        .then(async () => {
            console.log("MongoDB database connection established successfully");
            await ensureBootstrapAdmin();
        })
        .catch((error) => {
            console.error("MongoDB initial connection failed:", error.message);
        });
} else {
    console.warn("ATLAS_URI is not configured. Database-backed routes will stay unavailable until it is set.");
}

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.use("/exercise", excerciseRouter);
app.use("/api/admin", adminRouter);
app.use("/api/user", userRouter);
app.use("/api/custom-exercises", customExerciseRouter);
app.use("/api", authUserRoutes);
app.use("/api/chat", chatbotRouter);
app.use("/api/site-settings", siteSettingsRouter);
app.use("/externalExercisesInfo", externalExerciseRouter);

app.use(["/api", "/exercise", "/externalExercisesInfo"], (req, res) => {
    res.status(404).json({ message: "API route not found" });
});

if (fs.existsSync(buildIndexPath)) {
    app.use(express.static(buildPath));

    app.get(/.*/, (req, res) => {
        res.sendFile(buildIndexPath);
    });
}

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    const statusCode = error?.type === "entity.too.large"
        ? 413
        : error?.message === "Not allowed by CORS"
            ? 403
            : 500;
    const message = statusCode === 413
        ? "Request body is too large."
        : statusCode === 403
            ? "Origin is not allowed."
            : "Something went wrong.";

    console.error("Request failed:", {
        method: req.method,
        path: req.originalUrl,
        requestId: req.requestId,
        statusCode
    });

    return res.status(statusCode).json({
        message,
        requestId: req.requestId
    });
});

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});
