import mongoose from "mongoose";
import bcrypt from "bcrypt";
import validator from "validator";

const Schema = new mongoose.Schema({
    firstname: {
        type: String,
        required: [true, "firstname is required"],
        trim: true,
        minLength: [2, "firstname must be at least 2 characters"],
        maxLength: [50, "firstname must be at most 50 characters"]
    },
    lastname: {
        type: String,
        required: [true, "lastname is required"],
        trim: true,
        minLength: [2, "lastname must be at least 2 characters"],
        maxLength: [50, "lastname must be at most 50 characters"]
    },
    email: {
        type: String,
        required: [true, "email is required"],
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: (value) => validator.isEmail(value),
            message: "email must be a valid email address"
        }
    },
    password: {
        type: String,
        required: [true, "password is required"],
        minLength: [8, "password must be at least 8 characters"],
        maxLength: [72, "password must be at most 72 characters"],
        select: false
    },
    avatar: {
        type: String,
        trim: true,
        validate: {
            validator: (value) => validator.isURL(value),
            message: "avatar must be a valid URL"
        }
    },
    created_at: { type: Date, default: Date.now }
}, {
    collection: "users",
    minimize: false,
    versionKey: false,
    toJSON: {
        transform: (doc, ret) => {
            delete ret.password;
            return ret;
        }
    }
});

Schema.pre("save", async function () {
    if (this.isModified("password")) {
        this.password = await bcrypt.hash(this.password, 10);
    }
});

Schema.methods.comparePassword = function (password) {
    return bcrypt.compare(password, this.password);
};

const UserModel = mongoose.model("User", Schema);

export default UserModel;
