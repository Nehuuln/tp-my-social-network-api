import mongoose from "mongoose";

const Schema = new mongoose.Schema({
    poll: { type: mongoose.Schema.Types.ObjectId, ref: "Poll", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    answers: [{
        _id: false,
        question: { type: mongoose.Schema.Types.ObjectId, required: true },
        answer: { type: mongoose.Schema.Types.ObjectId, required: true }
    }],
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: null }
}, {
    collection: "poll_responses",
    minimize: false,
    versionKey: false
});

Schema.index({ poll: 1, user: 1 }, { unique: true });

const PollResponseModel = mongoose.model("PollResponse", Schema);

export default PollResponseModel;
