import PollModel from "../models/poll.mjs";
import PollResponseModel from "../models/poll-response.mjs";
import EventModel from "../models/event.mjs";
import { handleError } from "../utils/validation.mjs";

const USER_FIELDS = "firstname lastname avatar";

const Polls = class Polls {
    constructor(app, authToken) {
        this.app = app;
        this.authToken = authToken;
        this.run();
    }

    notFound(res, message = "Poll not found") {
        return res.status(404).json({
            code: 404,
            message
        });
    }

    forbidden(res, message) {
        return res.status(403).json({
            code: 403,
            message
        });
    }

    async findEvent(req, res) {
        const event = await EventModel.findById(req.params.id);

        if (!event || (event.visibility === "private" && !event.isParticipant(req.user.id))) {
            this.notFound(res, "Event not found");
            return null;
        }

        return event;
    }

    async findPoll(req, res) {
        const poll = await PollModel.findById(req.params.id);
        const event = poll ? await EventModel.findById(poll.event) : null;

        if (!event || (event.visibility === "private" && !event.isParticipant(req.user.id))) {
            this.notFound(res);
            return null;
        }

        return { poll, event };
    }

    checkAnswers(res, poll, answers) {
        const invalid = (message) => {
            res.status(400).json({
                code: 400,
                message: "Validation failed",
                errors: [{ field: "answers", message }]
            });
            return null;
        };

        if (!Array.isArray(answers) || !answers.every((item) => item && typeof item === "object")) {
            return invalid("answers must be an array of { question, answer }");
        }

        const result = [];
        for (const question of poll.questions) {
            const chosen = answers.filter((item) => String(item.question) === String(question._id));
            if (chosen.length !== 1) {
                return invalid(`exactly 1 answer is required for the question ${question._id}`);
            }

            const answer = question.answers.find((item) => String(item._id) === String(chosen[0].answer));
            if (!answer) {
                return invalid(`the answer of the question ${question._id} is not one of its possible answers`);
            }

            result.push({ question: question._id, answer: answer._id });
        }

        if (answers.length !== result.length) {
            return invalid("answers must only contain questions of this poll");
        }

        return result;
    }

    addPoll() {
        this.app.post("/events/:id/polls", this.authToken, async (req, res) => {
            try {
                const { title, questions } = req.body || {};

                const event = await this.findEvent(req, res);
                if (!event) {
                    return;
                }

                if (!event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "Only an organizer can create a poll in this event");
                }

                const addPoll = new PollModel({
                    event: event._id,
                    title,
                    questions,
                    created_by: req.user.id
                });
                await addPoll.save();

                res.status(201).json(addPoll);
            } catch (error) {
                handleError(res, error, "POST /events/:id/polls");
            }
        });
    }

    getEventPolls() {
        this.app.get("/events/:id/polls", this.authToken, async (req, res) => {
            try {
                const event = await this.findEvent(req, res);
                if (!event) {
                    return;
                }

                const polls = await PollModel.find({ event: event._id }).sort({ created_at: 1 });

                res.status(200).json(polls);
            } catch (error) {
                handleError(res, error, "GET /events/:id/polls");
            }
        });
    }

    getPollById() {
        this.app.get("/polls/:id", this.authToken, async (req, res) => {
            try {
                const found = await this.findPoll(req, res);
                if (!found) {
                    return;
                }

                await found.poll.populate([
                    { path: "created_by", select: USER_FIELDS },
                    { path: "event", select: "name start_date end_date" }
                ]);

                res.status(200).json(found.poll);
            } catch (error) {
                handleError(res, error, "GET /polls/:id");
            }
        });
    }

    updatePoll() {
        this.app.put("/polls/:id", this.authToken, async (req, res) => {
            try {
                const { title, questions } = req.body || {};

                const found = await this.findPoll(req, res);
                if (!found) {
                    return;
                }

                if (!found.event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "Only an organizer can update this poll");
                }

                if (questions !== undefined && await PollResponseModel.exists({ poll: found.poll._id })) {
                    return res.status(409).json({
                        code: 409,
                        message: "The questions of a poll cannot be updated once it has been answered"
                    });
                }

                const fields = { title, questions };
                for (const [key, value] of Object.entries(fields)) {
                    if (value !== undefined) {
                        found.poll[key] = value;
                    }
                }
                await found.poll.save();

                res.status(200).json(found.poll);
            } catch (error) {
                handleError(res, error, "PUT /polls/:id");
            }
        });
    }

    deletePoll() {
        this.app.delete("/polls/:id", this.authToken, async (req, res) => {
            try {
                const found = await this.findPoll(req, res);
                if (!found) {
                    return;
                }

                if (!found.event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "Only an organizer can delete this poll");
                }

                await PollResponseModel.deleteMany({ poll: found.poll._id });
                await found.poll.deleteOne();

                res.status(200).json({
                    code: 200,
                    message: "Poll deleted successfully"
                });
            } catch (error) {
                handleError(res, error, "DELETE /polls/:id");
            }
        });
    }

    addResponse() {
        this.app.post("/polls/:id/responses", this.authToken, async (req, res) => {
            try {
                const { answers } = req.body || {};

                const found = await this.findPoll(req, res);
                if (!found) {
                    return;
                }

                if (!found.event.isParticipant(req.user.id)) {
                    return this.forbidden(res, "Only a participant can answer this poll");
                }

                if (await PollResponseModel.exists({ poll: found.poll._id, user: req.user.id })) {
                    return res.status(409).json({
                        code: 409,
                        message: "You have already answered this poll"
                    });
                }

                const checked = this.checkAnswers(res, found.poll, answers);
                if (!checked) {
                    return;
                }

                const addResponse = new PollResponseModel({
                    poll: found.poll._id,
                    user: req.user.id,
                    answers: checked
                });
                await addResponse.save();

                res.status(201).json(addResponse);
            } catch (error) {
                handleError(res, error, "POST /polls/:id/responses");
            }
        });
    }

    getMyResponse() {
        this.app.get("/polls/:id/responses/me", this.authToken, async (req, res) => {
            try {
                const found = await this.findPoll(req, res);
                if (!found) {
                    return;
                }

                const response = await PollResponseModel.findOne({ poll: found.poll._id, user: req.user.id });
                if (!response) {
                    return this.notFound(res, "Response not found");
                }

                res.status(200).json(response);
            } catch (error) {
                handleError(res, error, "GET /polls/:id/responses/me");
            }
        });
    }

    updateMyResponse() {
        this.app.put("/polls/:id/responses/me", this.authToken, async (req, res) => {
            try {
                const { answers } = req.body || {};

                const found = await this.findPoll(req, res);
                if (!found) {
                    return;
                }

                const response = await PollResponseModel.findOne({ poll: found.poll._id, user: req.user.id });
                if (!response) {
                    return this.notFound(res, "Response not found");
                }

                const checked = this.checkAnswers(res, found.poll, answers);
                if (!checked) {
                    return;
                }

                response.answers = checked;
                response.updated_at = new Date();
                await response.save();

                res.status(200).json(response);
            } catch (error) {
                handleError(res, error, "PUT /polls/:id/responses/me");
            }
        });
    }

    deleteMyResponse() {
        this.app.delete("/polls/:id/responses/me", this.authToken, async (req, res) => {
            try {
                const found = await this.findPoll(req, res);
                if (!found) {
                    return;
                }

                const response = await PollResponseModel.findOne({ poll: found.poll._id, user: req.user.id });
                if (!response) {
                    return this.notFound(res, "Response not found");
                }

                await response.deleteOne();

                res.status(200).json({
                    code: 200,
                    message: "Response deleted successfully"
                });
            } catch (error) {
                handleError(res, error, "DELETE /polls/:id/responses/me");
            }
        });
    }

    getResponses() {
        this.app.get("/polls/:id/responses", this.authToken, async (req, res) => {
            try {
                const found = await this.findPoll(req, res);
                if (!found) {
                    return;
                }

                if (!found.event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "Only an organizer can read the responses of this poll");
                }

                const responses = await PollResponseModel.find({ poll: found.poll._id })
                    .sort({ created_at: 1 })
                    .populate("user", USER_FIELDS);

                res.status(200).json(responses);
            } catch (error) {
                handleError(res, error, "GET /polls/:id/responses");
            }
        });
    }

    getResults() {
        this.app.get("/polls/:id/results", this.authToken, async (req, res) => {
            try {
                const found = await this.findPoll(req, res);
                if (!found) {
                    return;
                }

                const responses = await PollResponseModel.find({ poll: found.poll._id });
                const chosen = responses.flatMap((response) => response.answers);

                res.status(200).json({
                    _id: found.poll._id,
                    title: found.poll.title,
                    total_responses: responses.length,
                    questions: found.poll.questions.map((question) => ({
                        _id: question._id,
                        title: question.title,
                        answers: question.answers.map((answer) => ({
                            _id: answer._id,
                            label: answer.label,
                            votes: chosen.filter((item) => item.answer.equals(answer._id)).length
                        }))
                    }))
                });
            } catch (error) {
                handleError(res, error, "GET /polls/:id/results");
            }
        });
    }

    run() {
        this.getEventPolls();
        this.getPollById();
        this.addPoll();
        this.updatePoll();
        this.deletePoll();
        this.getResults();
        this.getResponses();
        this.getMyResponse();
        this.addResponse();
        this.updateMyResponse();
        this.deleteMyResponse();
    }
}

export default Polls;
