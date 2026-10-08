import mongoose from "mongoose";
import validator from "validator";

const Schema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "name is required"],
        trim: true,
        minLength: [2, "name must be at least 2 characters"],
        maxLength: [100, "name must be at most 100 characters"]
    },
    description: {
        type: String,
        trim: true,
        maxLength: [1000, "description must be at most 1000 characters"]
    },
    icon: {
        type: String,
        trim: true,
        validate: {
            validator: (value) => validator.isURL(value),
            message: "icon must be a valid URL"
        }
    },
    cover: {
        type: String,
        trim: true,
        validate: {
            validator: (value) => validator.isURL(value),
            message: "cover must be a valid URL"
        }
    },
    type: {
        type: String,
        enum: {
            values: ["public", "private", "secret"],
            message: "type must be one of: public, private, secret"
        },
        default: "public"
    },
    allow_members_to_post: { type: Boolean, default: true },
    allow_members_to_create_events: { type: Boolean, default: true },
    administrators: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        validate: {
            validator: (value) => value.length > 0,
            message: "a group must have at least 1 administrator"
        }
    },
    members: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        validate: {
            validator: (value) => value.length > 0,
            message: "a group must have at least 1 member"
        }
    },
    created_at: { type: Date, default: Date.now }
}, {
    collection: "groups",
    minimize: false,
    versionKey: false
});

Schema.methods.isMember = function (userId) {
    return this.members.some((member) => member.equals(userId));
};

Schema.methods.isAdministrator = function (userId) {
    return this.administrators.some((administrator) => administrator.equals(userId));
};

const GroupModel = mongoose.model("Group", Schema);

export default GroupModel;
