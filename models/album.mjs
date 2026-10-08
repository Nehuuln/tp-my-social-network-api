import mongoose from "mongoose";

const Schema = new mongoose.Schema({
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
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
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    created_at: { type: Date, default: Date.now }
}, {
    collection: "albums",
    minimize: false,
    versionKey: false
});

Schema.index({ event: 1, created_at: 1 });

const AlbumModel = mongoose.model("Album", Schema);

export default AlbumModel;
