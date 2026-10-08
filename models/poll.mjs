import mongoose from "mongoose";

const AnswerSchema = new mongoose.Schema({
    label: {
        type: String,
        required: [true, "label is required"],
        trim: true,
        maxLength: [200, "label must be at most 200 characters"]
    }
});

const QuestionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "title is required"],
        trim: true,
        maxLength: [300, "title must be at most 300 characters"]
    },
    answers: {
        type: [AnswerSchema],
        validate: {
            validator: (value) => value.length > 1,
            message: "a question must have at least 2 answers"
        }
    }
});

const Schema = new mongoose.Schema({
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    title: {
        type: String,
        required: [true, "title is required"],
        trim: true,
        minLength: [2, "title must be at least 2 characters"],
        maxLength: [200, "title must be at most 200 characters"]
    },
    questions: {
        type: [QuestionSchema],
        validate: {
            validator: (value) => value.length > 0,
            message: "a poll must have at least 1 question"
        }
    },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    created_at: { type: Date, default: Date.now }
}, {
    collection: "polls",
    minimize: false,
    versionKey: false
});

Schema.index({ event: 1, created_at: 1 });

const PollModel = mongoose.model("Poll", Schema);

export default PollModel;
