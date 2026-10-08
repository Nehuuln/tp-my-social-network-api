import jwt from "jsonwebtoken";
import UserModel from "../models/user.mjs";
import { formatValidationError, formatDuplicateError } from "../utils/validation.mjs";

const Auth = class Auth {
    constructor(app) {
        this.app = app;
        this.run();
    }

    generateToken(user) {
        return jwt.sign({
            id: user._id,
            email: user.email
        }, process.env.JWT_SECRET, { expiresIn: "24h" });
    }

    register() {
        this.app.post("/auth/register", async (req, res) => {
            try {
                const { firstname, lastname, email, password, avatar } = req.body || {};

                const addUser = new UserModel({ firstname, lastname, email, password, avatar });
                await addUser.save();

                res.status(201).json({
                    user: addUser,
                    token: this.generateToken(addUser)
                });
            } catch (error) {
                const details = formatValidationError(error);
                if (details) {
                    return res.status(400).json({
                        code: 400,
                        message: "Validation failed",
                        errors: details
                    });
                }

                const duplicates = formatDuplicateError(error);
                if (duplicates) {
                    return res.status(409).json({
                        code: 409,
                        message: "Conflict",
                        errors: duplicates
                    });
                }

                console.error("[ERROR] POST /auth/register ->", error);
                res.status(500).json({
                    code: 500,
                    message: "Internal Server Error"
                });
            }
        });
    }

    login() {
        this.app.post("/auth/login", async (req, res) => {
            try {
                const { email, password } = req.body || {};

                if (typeof email !== "string" || typeof password !== "string") {
                    return res.status(400).json({
                        code: 400,
                        message: "Validation failed",
                        errors: [{
                            field: "email, password",
                            message: "email and password are required"
                        }]
                    });
                }

                const user = await UserModel.findOne({ email: email.trim().toLowerCase() }).select("+password");

                if (!user || !(await user.comparePassword(password))) {
                    return res.status(401).json({
                        code: 401,
                        message: "Invalid email or password"
                    });
                }

                res.status(200).json({
                    token: this.generateToken(user)
                });
            } catch (error) {
                console.error("[ERROR] POST /auth/login ->", error);
                res.status(500).json({
                    code: 500,
                    message: "Internal Server Error"
                });
            }
        });
    }

    run() {
        this.register();
        this.login();
    }
}

export default Auth;
