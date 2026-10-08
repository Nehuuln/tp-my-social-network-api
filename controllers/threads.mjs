import ThreadModel from "../models/thread.mjs";
import MessageModel from "../models/message.mjs";
import GroupModel from "../models/group.mjs";
import EventModel from "../models/event.mjs";
import { handleError } from "../utils/validation.mjs";

const USER_FIELDS = "firstname lastname avatar";

const Threads = class Threads {
    constructor(app, authToken) {
        this.app = app;
        this.authToken = authToken;
        this.run();
    }

    notFound(res, message = "Thread not found") {
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

    groupAccess(group, userId) {
        const isMember = group.isMember(userId);
        const isAdministrator = group.isAdministrator(userId);

        return {
            canRead: group.type === "public" || isMember,
            canPost: isMember && (group.allow_members_to_post || isAdministrator),
            canReply: isMember,
            isModerator: isAdministrator
        };
    }

    eventAccess(event, userId) {
        const isParticipant = event.isParticipant(userId);

        return {
            canRead: true,
            canPost: isParticipant,
            canReply: isParticipant,
            isModerator: event.isOrganizer(userId)
        };
    }

    async findThread(req, res) {
        const thread = await ThreadModel.findById(req.params.id);
        if (!thread) {
            this.notFound(res);
            return null;
        }

        let access = null;

        if (thread.group) {
            const group = await GroupModel.findById(thread.group);
            if (group && (group.type !== "secret" || group.isMember(req.user.id))) {
                access = this.groupAccess(group, req.user.id);
            }
        } else {
            const event = await EventModel.findById(thread.event);
            if (event && (event.visibility !== "private" || event.isParticipant(req.user.id))) {
                access = this.eventAccess(event, req.user.id);
            }
        }

        if (!access) {
            this.notFound(res);
            return null;
        }

        if (!access.canRead) {
            this.forbidden(res, "Only a member can read this thread");
            return null;
        }

        return { thread, access };
    }

    async findMessage(req, res, thread) {
        const message = await MessageModel.findOne({ _id: req.params.messageId, thread: thread._id });
        if (!message) {
            this.notFound(res, "Message not found");
            return null;
        }

        return message;
    }

    getGroupThread() {
        this.app.get("/groups/:id/thread", this.authToken, async (req, res) => {
            try {
                const group = await GroupModel.findById(req.params.id);
                if (!group || (group.type === "secret" && !group.isMember(req.user.id))) {
                    return this.notFound(res, "Group not found");
                }

                if (!this.groupAccess(group, req.user.id).canRead) {
                    return this.forbidden(res, "Only a member can read this thread");
                }

                const thread = await ThreadModel.findOneAndUpdate(
                    { group: group._id },
                    { $setOnInsert: { group: group._id } },
                    { new: true, upsert: true }
                );

                res.status(200).json(thread);
            } catch (error) {
                handleError(res, error, "GET /groups/:id/thread");
            }
        });
    }

    getEventThread() {
        this.app.get("/events/:id/thread", this.authToken, async (req, res) => {
            try {
                const event = await EventModel.findById(req.params.id);
                if (!event || (event.visibility === "private" && !event.isParticipant(req.user.id))) {
                    return this.notFound(res, "Event not found");
                }

                const thread = await ThreadModel.findOneAndUpdate(
                    { event: event._id },
                    { $setOnInsert: { event: event._id } },
                    { new: true, upsert: true }
                );

                res.status(200).json(thread);
            } catch (error) {
                handleError(res, error, "GET /events/:id/thread");
            }
        });
    }

    getMessages() {
        this.app.get("/threads/:id/messages", this.authToken, async (req, res) => {
            try {
                const found = await this.findThread(req, res);
                if (!found) {
                    return;
                }

                const messages = await MessageModel.find({ thread: found.thread._id })
                    .sort({ created_at: 1 })
                    .populate("author", USER_FIELDS);

                const replies = messages.filter((message) => message.parent);
                const result = messages
                    .filter((message) => !message.parent)
                    .map((message) => ({
                        ...message.toJSON(),
                        replies: replies.filter((reply) => reply.parent.equals(message._id))
                    }));

                res.status(200).json(result);
            } catch (error) {
                handleError(res, error, "GET /threads/:id/messages");
            }
        });
    }

    addMessage() {
        this.app.post("/threads/:id/messages", this.authToken, async (req, res) => {
            try {
                const { content } = req.body || {};

                const found = await this.findThread(req, res);
                if (!found) {
                    return;
                }

                if (!found.access.canPost) {
                    return this.forbidden(res, "You are not allowed to post in this thread");
                }

                const addMessage = new MessageModel({
                    thread: found.thread._id,
                    author: req.user.id,
                    content
                });
                await addMessage.save();

                res.status(201).json(addMessage);
            } catch (error) {
                handleError(res, error, "POST /threads/:id/messages");
            }
        });
    }

    addReply() {
        this.app.post("/threads/:id/messages/:messageId/replies", this.authToken, async (req, res) => {
            try {
                const { content } = req.body || {};

                const found = await this.findThread(req, res);
                if (!found) {
                    return;
                }

                if (!found.access.canReply) {
                    return this.forbidden(res, "You are not allowed to reply in this thread");
                }

                const message = await this.findMessage(req, res, found.thread);
                if (!message) {
                    return;
                }

                if (message.parent) {
                    return res.status(400).json({
                        code: 400,
                        message: "Validation failed",
                        errors: [{ field: "messageId", message: "you cannot reply to a reply" }]
                    });
                }

                const addReply = new MessageModel({
                    thread: found.thread._id,
                    author: req.user.id,
                    content,
                    parent: message._id
                });
                await addReply.save();

                res.status(201).json(addReply);
            } catch (error) {
                handleError(res, error, "POST /threads/:id/messages/:messageId/replies");
            }
        });
    }

    updateMessage() {
        this.app.put("/threads/:id/messages/:messageId", this.authToken, async (req, res) => {
            try {
                const { content } = req.body || {};

                const found = await this.findThread(req, res);
                if (!found) {
                    return;
                }

                const message = await this.findMessage(req, res, found.thread);
                if (!message) {
                    return;
                }

                if (!message.author.equals(req.user.id)) {
                    return this.forbidden(res, "You can only update your own messages");
                }

                message.content = content;
                message.updated_at = new Date();
                await message.save();

                res.status(200).json(message);
            } catch (error) {
                handleError(res, error, "PUT /threads/:id/messages/:messageId");
            }
        });
    }

    deleteMessage() {
        this.app.delete("/threads/:id/messages/:messageId", this.authToken, async (req, res) => {
            try {
                const found = await this.findThread(req, res);
                if (!found) {
                    return;
                }

                const message = await this.findMessage(req, res, found.thread);
                if (!message) {
                    return;
                }

                if (!message.author.equals(req.user.id) && !found.access.isModerator) {
                    return this.forbidden(res, "You can only delete your own messages");
                }

                await MessageModel.deleteMany({ parent: message._id });
                await message.deleteOne();

                res.status(200).json({
                    code: 200,
                    message: "Message deleted successfully"
                });
            } catch (error) {
                handleError(res, error, "DELETE /threads/:id/messages/:messageId");
            }
        });
    }

    run() {
        this.getGroupThread();
        this.getEventThread();
        this.getMessages();
        this.addMessage();
        this.addReply();
        this.updateMessage();
        this.deleteMessage();
    }
}

export default Threads;
