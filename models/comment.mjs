import mongoose from "mongoose";

const Schema = new mongoose.Schema({
    photo: { type: mongoose.Schema.Types.ObjectId, ref: "Photo", required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: {
        type: String,
        required: [true, "content is required"],
        trim: true,
        maxLength: [1000, "content must be at most 1000 characters"]
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: null }
}, {
    collection: "comments",
    minimize: false,
    versionKey: false
});

Schema.index({ photo: 1, created_at: 1 });

const CommentModel = mongoose.model("Comment", Schema);

export default CommentModel;
