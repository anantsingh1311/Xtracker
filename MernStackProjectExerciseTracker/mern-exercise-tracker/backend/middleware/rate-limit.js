const buckets = new Map();
let lastCleanupAt = 0;

function now() {
    return Date.now();
}

function normalizeClientKey(value) {
    return String(value || "")
        .split(",")[0]
        .trim()
        .slice(0, 128) || "unknown-client";
}

function getClientKey(req) {
    return normalizeClientKey(req.ip || req.headers["x-forwarded-for"]);
}

function createRateLimiter(options = {}) {
    const {
        buildKey = getClientKey,
        max = 30,
        message = "Too many requests. Please try again later.",
        name = "global",
        windowMs = 15 * 60 * 1000
    } = options;

    return (req, res, next) => {
        const currentTime = now();
        if (currentTime - lastCleanupAt >= 60 * 1000) {
            lastCleanupAt = currentTime;
            for (const [bucketKey, bucket] of buckets.entries()) {
                if (bucket.expiresAt <= currentTime) {
                    buckets.delete(bucketKey);
                }
            }
        }

        const key = `${name}:${buildKey(req)}`;
        const existingBucket = buckets.get(key);

        if (!existingBucket || (currentTime - existingBucket.startedAt) >= windowMs) {
            buckets.set(key, {
                count: 1,
                expiresAt: currentTime + windowMs,
                startedAt: currentTime
            });

            return next();
        }

        if (existingBucket.count >= max) {
            const retryAfterSeconds = Math.max(Math.ceil((windowMs - (currentTime - existingBucket.startedAt)) / 1000), 1);
            res.set("Retry-After", String(retryAfterSeconds));

            return res.status(429).json({ message });
        }

        existingBucket.count += 1;
        return next();
    };
}

module.exports = createRateLimiter;
