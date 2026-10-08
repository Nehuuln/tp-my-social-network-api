import { rateLimit } from "express-rate-limit";

const WINDOW_MS = 15 * 60 * 1000;

const createLimiter = (limit, message) => rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            code: 429,
            message
        });
    }
});

export const limiter = createLimiter(Number(process.env.RATE_LIMIT_MAX) || 100, "Too many requests, please try again later");

export const authLimiter = createLimiter(Number(process.env.AUTH_RATE_LIMIT_MAX) || 10, "Too many authentication attempts, please try again later");
