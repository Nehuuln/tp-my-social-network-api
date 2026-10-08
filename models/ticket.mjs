import mongoose from "mongoose";
import validator from "validator";

const Schema = new mongoose.Schema({
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    ticket_type: { type: mongoose.Schema.Types.ObjectId, ref: "TicketType", required: true },
    lastname: {
        type: String,
        required: [true, "lastname is required"],
        trim: true,
        minLength: [2, "lastname must be at least 2 characters"],
        maxLength: [50, "lastname must be at most 50 characters"]
    },
    firstname: {
        type: String,
        required: [true, "firstname is required"],
        trim: true,
        minLength: [2, "firstname must be at least 2 characters"],
        maxLength: [50, "firstname must be at most 50 characters"]
    },
    email: {
        type: String,
        required: [true, "email is required"],
        trim: true,
        lowercase: true,
        validate: {
            validator: (value) => validator.isEmail(value),
            message: "email must be a valid email address"
        }
    },
    address: {
        street: {
            type: String,
            required: [true, "address.street is required"],
            trim: true,
            maxLength: [200, "address.street must be at most 200 characters"]
        },
        zip_code: {
            type: String,
            required: [true, "address.zip_code is required"],
            trim: true,
            maxLength: [20, "address.zip_code must be at most 20 characters"]
        },
        city: {
            type: String,
            required: [true, "address.city is required"],
            trim: true,
            maxLength: [100, "address.city must be at most 100 characters"]
        },
        country: {
            type: String,
            required: [true, "address.country is required"],
            trim: true,
            maxLength: [100, "address.country must be at most 100 characters"]
        }
    },
    purchased_at: { type: Date, default: Date.now }
}, {
    collection: "tickets",
    minimize: false,
    versionKey: false
});

Schema.index({ event: 1, email: 1 }, { unique: true });

const TicketModel = mongoose.model("Ticket", Schema);

export default TicketModel;
