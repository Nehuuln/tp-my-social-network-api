import fs from "node:fs";
import https from "node:https";
import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import routes from "../controllers/routes.mjs";
import authToken from "../middlewares/auth.mjs";
import corsOptions from "../middlewares/cors.mjs";
import { limiter, authLimiter } from "../middlewares/rateLimit.mjs";

const Server = class Server {
    constructor() {
        this.app = express();
        this.port = process.env.PORT;
    }

    async dbConnect() {
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log("[OK] MongoDB connected");
        } catch (error) {
            console.error("[ERROR] MongoDB connection ->", error);
            process.exit(1);
        }
    }

    sslOptions() {
        try {
            return {
                key: fs.readFileSync(process.env.SSL_KEY_PATH || "ssl/social-network.key"),
                cert: fs.readFileSync(process.env.SSL_CERT_PATH || "ssl/social-network.crt")
            };
        } catch (error) {
            console.error("[ERROR] SSL certificate ->", error.message);
            process.exit(1);
        }
    }

    middleware() {
        this.app.use(helmet());
        this.app.use(corsOptions);
        this.app.use(limiter);
        this.app.use("/auth", authLimiter);
        this.app.use(express.json());
    }

    routes() {
        new routes.Auth(this.app);
        new routes.Users(this.app, authToken);
        new routes.Groups(this.app, authToken);
        new routes.Events(this.app, authToken);
        new routes.Threads(this.app, authToken);
        new routes.Albums(this.app, authToken);
        new routes.Polls(this.app, authToken);
        new routes.Tickets(this.app, authToken);

        this.app.use((req, res) => {
            res.status(404).json({
                code: 404,
                message: "Not Found"
            });
        });

        this.app.use((error, req, res, next) => {
            if (error.type === "entity.parse.failed") {
                return res.status(400).json({
                    code: 400,
                    message: "Invalid JSON body"
                });
            }

            console.error("[ERROR]", error);
            res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        });
    }

    async run() {
        await this.dbConnect();
        this.middleware();
        this.routes();

        https.createServer(this.sslOptions(), this.app).listen(this.port, () => {
            console.log(`[OK] HTTPS server listening on port ${this.port}`);
        });
    }
}

export default Server;
