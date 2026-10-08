import UserModel from "../models/user.mjs";
import { formatValidationError, formatDuplicateError } from "../utils/validation.mjs";

const Users = class Users {
    constructor(app, authToken) {
        this.app = app;
        this.authToken = authToken;
        this.run();
    }

    getUsers() {
        this.app.get("/users", this.authToken, async (req, res) => {
            try {
                const users = await UserModel.find();
                res.status(200).json(users);
            } catch (error) {
                console.error("[ERROR] GET /users ->", error);
                res.status(500).json({
                    code: 500,
                    message: "Internal Server Error"
                });
            }
        });
    }

    getUserById() {
        this.app.get("/users/:id", this.authToken, async (req, res) => {
            try {
                const { id } = req.params;
                const user = await UserModel.findById(id);

                if (!user) {
                    return res.status(404).json({
                        code: 404,
                        message: "User not found"
                    });
                }

                res.status(200).json(user);
            } catch (error) {
                const details = formatValidationError(error);
                if (details) {
                    return res.status(400).json({
                        code: 400,
                        message: "Validation failed",
                        errors: details
                    });
                }

                console.error("[ERROR] GET /users/:id ->", error);
                res.status(500).json({
                    code: 500,
                    message: "Internal Server Error"
                });
            }
        });
    }

    updateUser() {
        this.app.put("/users/:id", this.authToken, async (req, res) => {
            try {
                const { firstname, lastname, email, password, avatar } = req.body || {};
                const { id } = req.params;

                if (id !== req.user.id) {
                    return res.status(403).json({
                        code: 403,
                        message: "You can only update your own account"
                    });
                }

                const user = await UserModel.findById(id);
                if (!user) {
                    return res.status(404).json({
                        code: 404,
                        message: "User not found"
                    });
                }

                const fields = { firstname, lastname, email, password, avatar };
                for (const [key, value] of Object.entries(fields)) {
                    if (value !== undefined) {
                        user[key] = value;
                    }
                }
                await user.save();

                res.status(200).json(user);
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

                console.error("[ERROR] PUT /users/:id ->", error);
                res.status(500).json({
                    code: 500,
                    message: "Internal Server Error"
                });
            }
        });
    }

    deleteUser() {
        this.app.delete("/users/:id", this.authToken, async (req, res) => {
            try {
                const { id } = req.params;

                if (id !== req.user.id) {
                    return res.status(403).json({
                        code: 403,
                        message: "You can only delete your own account"
                    });
                }

                const user = await UserModel.findByIdAndDelete(id);
                if (!user) {
                    return res.status(404).json({
                        code: 404,
                        message: "User not found"
                    });
                }

                res.status(200).json({
                    code: 200,
                    message: "User deleted successfully"
                });
            } catch (error) {
                console.error("[ERROR] DELETE /users/:id ->", error);
                res.status(500).json({
                    code: 500,
                    message: "Internal Server Error"
                });
            }
        });
    }

    run() {
        this.getUsers();
        this.getUserById();
        this.updateUser();
        this.deleteUser();
    }
}

export default Users;
