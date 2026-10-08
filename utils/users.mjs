import mongoose from "mongoose";
import UserModel from "../models/user.mjs";

export const findUser = async (res, userId) => {
    if (!mongoose.isValidObjectId(userId)) {
        res.status(400).json({
            code: 400,
            message: "Validation failed",
            errors: [{ field: "user_id", message: "user_id is invalid" }]
        });
        return null;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
        res.status(404).json({
            code: 404,
            message: "User not found"
        });
        return null;
    }

    return user;
};

export const findUserIds = async (res, field, userIds = []) => {
    const invalid = () => {
        res.status(400).json({
            code: 400,
            message: "Validation failed",
            errors: [{ field, message: `${field} must be an array of existing user ids` }]
        });
        return null;
    };

    if (!Array.isArray(userIds) || !userIds.every((userId) => mongoose.isValidObjectId(userId))) {
        return invalid();
    }

    const ids = [...new Set(userIds.map((userId) => String(userId)))];
    const count = await UserModel.countDocuments({ _id: { $in: ids } });

    return count === ids.length ? ids : invalid();
};
