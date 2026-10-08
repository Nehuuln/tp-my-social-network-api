import express from "express";
import mongoose from "mongoose";

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

    middleware() {
        this.app.use(express.json());
    }

    routes() {
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

        this.app.listen(this.port, () => {
            console.log(`[OK] Server listening on port ${this.port}`);
        });
    }
}

export default Server;
