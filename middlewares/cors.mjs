import cors from "cors";

const origins = process.env.CORS_ORIGIN

const corsOptions = cors({
    origin: origins.length > 0 ? origins : "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
});

export default corsOptions;
