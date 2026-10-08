import mongoose from "mongoose";

const Schema = new mongoose.Schema({
    thread: { type: mongoose.Schema.Types.ObjectId, ref: "Thread", required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: {
        type: String,
        required: [true, "content is required"],
        trim: true,
        maxLength: [2000, "content must be at most 2000 characters"]
    },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: null }
}, {
    collection: "messages",
    minimize: false,
    versionKey: false
});

Schema.index({ thread: 1, created_at: 1 });

const MessageModel = mongoose.model("Message", Schema);

export default MessageModel;
