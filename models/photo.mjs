import mongoose from "mongoose";
import validator from "validator";

const Schema = new mongoose.Schema({
    album: { type: mongoose.Schema.Types.ObjectId, ref: "Album", required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    url: {
        type: String,
        required: [true, "url is required"],
        trim: true,
        validate: {
            validator: (value) => validator.isURL(value),
            message: "url must be a valid URL"
        }
    },
    caption: {
        type: String,
        trim: true,
        maxLength: [500, "caption must be at most 500 characters"]
    },
    created_at: { type: Date, default: Date.now }
}, {
    collection: "photos",
    minimize: false,
    versionKey: false
});

Schema.index({ album: 1, created_at: 1 });

const PhotoModel = mongoose.model("Photo", Schema);

export default PhotoModel;
