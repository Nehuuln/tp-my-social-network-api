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
        maxLength: [2000, "description must be at most 2000 characters"]
    },
    start_date: {
        type: Date,
        required: [true, "start_date is required"]
    },
    end_date: {
        type: Date,
        required: [true, "end_date is required"],
        validate: {
            validator: function (value) {
                return !this.start_date || value >= this.start_date;
            },
            message: "end_date must be after start_date"
        }
    },
    location: {
        type: String,
        required: [true, "location is required"],
        trim: true,
        maxLength: [200, "location must be at most 200 characters"]
    },
    cover: {
        type: String,
        trim: true,
        validate: {
            validator: (value) => validator.isURL(value),
            message: "cover must be a valid URL"
        }
    },
    visibility: {
        type: String,
        enum: {
            values: ["public", "private"],
            message: "visibility must be one of: public, private"
        },
        default: "public"
    },
    organizers: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        validate: {
            validator: (value) => value.length > 0,
            message: "an event must have at least 1 organizer"
        }
    },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
    created_at: { type: Date, default: Date.now }
}, {
    collection: "events",
    minimize: false,
    versionKey: false
});

Schema.methods.isParticipant = function (userId) {
    return this.participants.some((participant) => participant.equals(userId));
};

Schema.methods.isOrganizer = function (userId) {
    return this.organizers.some((organizer) => organizer.equals(userId));
};

const EventModel = mongoose.model("Event", Schema);

export default EventModel;
