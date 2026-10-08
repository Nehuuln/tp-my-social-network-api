import mongoose from "mongoose";

const Schema = new mongoose.Schema({
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", unique: true, sparse: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", unique: true, sparse: true },
    created_at: { type: Date, default: Date.now }
}, {
    collection: "threads",
    minimize: false,
    versionKey: false
});

Schema.pre("validate", function () {
    if (Boolean(this.group) === Boolean(this.event)) {
        this.invalidate("group", "a thread must be linked to 1 group or 1 event, but not both");
    }
});

const ThreadModel = mongoose.model("Thread", Schema);

export default ThreadModel;
