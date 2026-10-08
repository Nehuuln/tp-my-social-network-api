import mongoose from "mongoose";
import EventModel from "../models/event.mjs";
import GroupModel from "../models/group.mjs";
import { handleError } from "../utils/validation.mjs";
import { findUser, findUserIds } from "../utils/users.mjs";

const USER_FIELDS = "firstname lastname avatar";

const Events = class Events {
    constructor(app, authToken) {
        this.app = app;
        this.authToken = authToken;
        this.run();
    }

    notFound(res, message = "Event not found") {
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
            this.notFound(res);
            return null;
        }

        return event;
    }

    async createEvent(req, res, group) {
        const {
            name, description, start_date, end_date, location, cover, visibility,
            organizers, participants
        } = req.body || {};

        const organizerIds = await findUserIds(res, "organizers", organizers);
        if (!organizerIds) {
            return;
        }

        const participantIds = await findUserIds(res, "participants", participants);
        if (!participantIds) {
            return;
        }

        const allOrganizers = new Set([req.user.id, ...organizerIds]);
        const allParticipants = new Set([
            ...allOrganizers,
            ...participantIds,
            ...(group ? group.members.map((member) => String(member)) : [])
        ]);

        const addEvent = new EventModel({
            name, description, start_date, end_date, location, cover,
            visibility: group && group.type !== "public" ? "private" : visibility,
            organizers: [...allOrganizers],
            participants: [...allParticipants],
            group: group ? group._id : undefined
        });
        await addEvent.save();

        res.status(201).json(addEvent);
    }

    addEvent() {
        this.app.post("/events", this.authToken, async (req, res) => {
            try {
                await this.createEvent(req, res, null);
            } catch (error) {
                handleError(res, error, "POST /events");
            }
        });
    }

    addGroupEvent() {
        this.app.post("/groups/:id/events", this.authToken, async (req, res) => {
            try {
                const group = await GroupModel.findById(req.params.id);
                if (!group || (group.type === "secret" && !group.isMember(req.user.id))) {
                    return this.notFound(res, "Group not found");
                }

                if (!group.isMember(req.user.id)) {
                    return this.forbidden(res, "Only a member can create an event in this group");
                }

                if (!group.allow_members_to_create_events && !group.isAdministrator(req.user.id)) {
                    return this.forbidden(res, "Only an administrator can create an event in this group");
                }

                await this.createEvent(req, res, group);
            } catch (error) {
                handleError(res, error, "POST /groups/:id/events");
            }
        });
    }

    getEvents() {
        this.app.get("/events", this.authToken, async (req, res) => {
            try {
                const events = await EventModel.find({
                    $or: [
                        { visibility: "public" },
                        { participants: req.user.id }
                    ]
                }).select("-participants -organizers").sort({ start_date: 1 });

                res.status(200).json(events);
            } catch (error) {
                handleError(res, error, "GET /events");
            }
        });
    }

    getGroupEvents() {
        this.app.get("/groups/:id/events", this.authToken, async (req, res) => {
            try {
                const group = await GroupModel.findById(req.params.id);
                if (!group || (group.type === "secret" && !group.isMember(req.user.id))) {
                    return this.notFound(res, "Group not found");
                }

                const events = await EventModel.find({
                    group: group._id,
                    $or: [
                        { visibility: "public" },
                        { participants: req.user.id }
                    ]
                }).select("-participants -organizers").sort({ start_date: 1 });

                res.status(200).json(events);
            } catch (error) {
                handleError(res, error, "GET /groups/:id/events");
            }
        });
    }

    getEventById() {
        this.app.get("/events/:id", this.authToken, async (req, res) => {
            try {
                const event = await this.findEvent(req, res);
                if (!event) {
                    return;
                }

                await event.populate([
                    { path: "organizers", select: USER_FIELDS },
                    { path: "participants", select: USER_FIELDS },
                    { path: "group", select: "name type" }
                ]);

                res.status(200).json(event);
            } catch (error) {
                handleError(res, error, "GET /events/:id");
            }
        });
    }

    updateEvent() {
        this.app.put("/events/:id", this.authToken, async (req, res) => {
            try {
                const {
                    name, description, start_date, end_date, location, cover, visibility
                } = req.body || {};

                const event = await this.findEvent(req, res);
                if (!event) {
                    return;
                }

                if (!event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "Only an organizer can update this event");
                }

                if (visibility === "public" && event.group) {
                    const group = await GroupModel.findById(event.group);
                    if (group && group.type !== "public") {
                        return res.status(400).json({
                            code: 400,
                            message: "Validation failed",
                            errors: [{
                                field: "visibility",
                                message: "an event of a private or secret group must be private"
                            }]
                        });
                    }
                }

                const fields = { name, description, start_date, end_date, location, cover, visibility };
                for (const [key, value] of Object.entries(fields)) {
                    if (value !== undefined) {
                        event[key] = value;
                    }
                }
                await event.save();

                res.status(200).json(event);
            } catch (error) {
                handleError(res, error, "PUT /events/:id");
            }
        });
    }

    deleteEvent() {
        this.app.delete("/events/:id", this.authToken, async (req, res) => {
            try {
                const event = await this.findEvent(req, res);
                if (!event) {
                    return;
                }

                if (!event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "Only an organizer can delete this event");
                }

                await event.deleteOne();

                res.status(200).json({
                    code: 200,
                    message: "Event deleted successfully"
                });
            } catch (error) {
                handleError(res, error, "DELETE /events/:id");
            }
        });
    }

    joinEvent() {
        this.app.post("/events/:id/join", this.authToken, async (req, res) => {
            try {
                const event = await this.findEvent(req, res);
                if (!event) {
                    return;
                }

                if (event.isParticipant(req.user.id)) {
                    return res.status(409).json({
                        code: 409,
                        message: "You are already a participant of this event"
                    });
                }

                event.participants.push(req.user.id);
                await event.save();

                res.status(200).json(event);
            } catch (error) {
                handleError(res, error, "POST /events/:id/join");
            }
        });
    }

    addParticipant() {
        this.app.post("/events/:id/participants", this.authToken, async (req, res) => {
            try {
                const { user_id } = req.body || {};

                const event = await this.findEvent(req, res);
                if (!event) {
                    return;
                }

                if (!event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "Only an organizer can add participants to this event");
                }

                const user = await findUser(res, user_id);
                if (!user) {
                    return;
                }

                if (event.isParticipant(user._id)) {
                    return res.status(409).json({
                        code: 409,
                        message: "This user is already a participant of this event"
                    });
                }

                event.participants.push(user._id);
                await event.save();

                res.status(200).json(event);
            } catch (error) {
                handleError(res, error, "POST /events/:id/participants");
            }
        });
    }

    removeParticipant() {
        this.app.delete("/events/:id/participants/:userId", this.authToken, async (req, res) => {
            try {
                const { userId } = req.params;

                const event = await this.findEvent(req, res);
                if (!event) {
                    return;
                }

                if (userId !== req.user.id && !event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "Only an organizer can remove another participant");
                }

                if (!mongoose.isValidObjectId(userId) || !event.isParticipant(userId)) {
                    return this.notFound(res, "Participant not found");
                }

                if (event.isOrganizer(userId) && event.organizers.length === 1) {
                    return res.status(409).json({
                        code: 409,
                        message: "An event must keep at least 1 organizer"
                    });
                }

                event.participants.pull(userId);
                event.organizers.pull(userId);
                await event.save();

                res.status(200).json(event);
            } catch (error) {
                handleError(res, error, "DELETE /events/:id/participants/:userId");
            }
        });
    }

    addOrganizer() {
        this.app.post("/events/:id/organizers", this.authToken, async (req, res) => {
            try {
                const { user_id } = req.body || {};

                const event = await this.findEvent(req, res);
                if (!event) {
                    return;
                }

                if (!event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "Only an organizer can add organizers to this event");
                }

                const user = await findUser(res, user_id);
                if (!user) {
                    return;
                }

                if (event.isOrganizer(user._id)) {
                    return res.status(409).json({
                        code: 409,
                        message: "This user is already an organizer of this event"
                    });
                }

                event.organizers.push(user._id);
                event.participants.addToSet(user._id);
                await event.save();

                res.status(200).json(event);
            } catch (error) {
                handleError(res, error, "POST /events/:id/organizers");
            }
        });
    }

    removeOrganizer() {
        this.app.delete("/events/:id/organizers/:userId", this.authToken, async (req, res) => {
            try {
                const { userId } = req.params;

                const event = await this.findEvent(req, res);
                if (!event) {
                    return;
                }

                if (!event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "Only an organizer can remove organizers from this event");
                }

                if (!mongoose.isValidObjectId(userId) || !event.isOrganizer(userId)) {
                    return this.notFound(res, "Organizer not found");
                }

                if (event.organizers.length === 1) {
                    return res.status(409).json({
                        code: 409,
                        message: "An event must keep at least 1 organizer"
                    });
                }

                event.organizers.pull(userId);
                await event.save();

                res.status(200).json(event);
            } catch (error) {
                handleError(res, error, "DELETE /events/:id/organizers/:userId");
            }
        });
    }

    shareEvent() {
        this.app.get("/events/:id/share", this.authToken, async (req, res) => {
            try {
                const event = await this.findEvent(req, res);
                if (!event) {
                    return;
                }

                if (!event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "Only an organizer can share this event");
                }

                const group = event.group ? await GroupModel.findById(event.group) : null;
                if (event.visibility !== "public" || (group && group.type !== "public")) {
                    return this.forbidden(res, "Only a public event can be shared on other social networks");
                }

                const url = `${req.protocol}://${req.get("host")}/events/${event._id}`;

                res.status(200).json({
                    url,
                    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
                });
            } catch (error) {
                handleError(res, error, "GET /events/:id/share");
            }
        });
    }

    run() {
        this.getEvents();
        this.getGroupEvents();
        this.getEventById();
        this.addEvent();
        this.addGroupEvent();
        this.updateEvent();
        this.deleteEvent();
        this.joinEvent();
        this.addParticipant();
        this.removeParticipant();
        this.addOrganizer();
        this.removeOrganizer();
        this.shareEvent();
    }
}

export default Events;
