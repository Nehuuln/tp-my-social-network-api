import TicketTypeModel from "../models/ticket-type.mjs";
import TicketModel from "../models/ticket.mjs";
import EventModel from "../models/event.mjs";
import { handleError } from "../utils/validation.mjs";

const Tickets = class Tickets {
    constructor(app, authToken) {
        this.app = app;
        this.authToken = authToken;
        this.run();
    }

    notFound(res, message = "Ticket type not found") {
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

    conflict(res, message) {
        return res.status(409).json({
            code: 409,
            message
        });
    }

    async findPublicEvent(res, eventId) {
        const event = await EventModel.findById(eventId);

        if (!event || event.visibility !== "public") {
            this.notFound(res, "Event not found");
            return null;
        }

        return event;
    }

    async findOrganizedEvent(req, res, eventId, message) {
        const event = await EventModel.findById(eventId);

        if (!event || (event.visibility === "private" && !event.isParticipant(req.user.id))) {
            this.notFound(res, "Event not found");
            return null;
        }

        if (!event.isOrganizer(req.user.id)) {
            this.forbidden(res, message);
            return null;
        }

        return event;
    }

    async findOrganizedTicketType(req, res, message) {
        const ticketType = await TicketTypeModel.findById(req.params.id);
        const event = ticketType ? await EventModel.findById(ticketType.event) : null;

        if (!event || (event.visibility === "private" && !event.isParticipant(req.user.id))) {
            this.notFound(res);
            return null;
        }

        if (!event.isOrganizer(req.user.id)) {
            this.forbidden(res, message);
            return null;
        }

        return ticketType;
    }

    async findOrganizedTicket(req, res, message) {
        const ticket = await TicketModel.findById(req.params.id);
        const event = ticket ? await EventModel.findById(ticket.event) : null;

        if (!event || (event.visibility === "private" && !event.isParticipant(req.user.id))) {
            this.notFound(res, "Ticket not found");
            return null;
        }

        if (!event.isOrganizer(req.user.id)) {
            this.forbidden(res, message);
            return null;
        }

        return ticket;
    }

    addTicketType() {
        this.app.post("/events/:id/ticket-types", this.authToken, async (req, res) => {
            try {
                const { name, amount, quantity } = req.body || {};

                const event = await this.findOrganizedEvent(
                    req, res, req.params.id, "Only an organizer can create a ticket type in this event"
                );
                if (!event) {
                    return;
                }

                if (event.visibility !== "public") {
                    return this.conflict(res, "Only a public event can have a ticketing");
                }

                const addTicketType = new TicketTypeModel({ event: event._id, name, amount, quantity });
                await addTicketType.save();

                res.status(201).json(addTicketType);
            } catch (error) {
                handleError(res, error, "POST /events/:id/ticket-types");
            }
        });
    }

    getEventTicketTypes() {
        this.app.get("/events/:id/ticket-types", async (req, res) => {
            try {
                const event = await this.findPublicEvent(res, req.params.id);
                if (!event) {
                    return;
                }

                const ticketTypes = await TicketTypeModel.find({ event: event._id }).sort({ created_at: 1 });

                res.status(200).json(ticketTypes);
            } catch (error) {
                handleError(res, error, "GET /events/:id/ticket-types");
            }
        });
    }

    getTicketTypeById() {
        this.app.get("/ticket-types/:id", async (req, res) => {
            try {
                const ticketType = await TicketTypeModel.findById(req.params.id);
                if (!ticketType) {
                    return this.notFound(res);
                }

                const event = await EventModel.findById(ticketType.event);
                if (!event || event.visibility !== "public") {
                    return this.notFound(res);
                }

                await ticketType.populate("event", "name start_date end_date location");

                res.status(200).json(ticketType);
            } catch (error) {
                handleError(res, error, "GET /ticket-types/:id");
            }
        });
    }

    updateTicketType() {
        this.app.put("/ticket-types/:id", this.authToken, async (req, res) => {
            try {
                const { name, amount, quantity } = req.body || {};

                const ticketType = await this.findOrganizedTicketType(
                    req, res, "Only an organizer can update this ticket type"
                );
                if (!ticketType) {
                    return;
                }

                const fields = { name, amount, quantity };
                for (const [key, value] of Object.entries(fields)) {
                    if (value !== undefined) {
                        ticketType[key] = value;
                    }
                }
                await ticketType.save();

                res.status(200).json(ticketType);
            } catch (error) {
                handleError(res, error, "PUT /ticket-types/:id");
            }
        });
    }

    deleteTicketType() {
        this.app.delete("/ticket-types/:id", this.authToken, async (req, res) => {
            try {
                const ticketType = await this.findOrganizedTicketType(
                    req, res, "Only an organizer can delete this ticket type"
                );
                if (!ticketType) {
                    return;
                }

                if (await TicketModel.exists({ ticket_type: ticketType._id })) {
                    return this.conflict(res, "A ticket type with sold tickets cannot be deleted");
                }

                await ticketType.deleteOne();

                res.status(200).json({
                    code: 200,
                    message: "Ticket type deleted successfully"
                });
            } catch (error) {
                handleError(res, error, "DELETE /ticket-types/:id");
            }
        });
    }

    buyTicket() {
        this.app.post("/ticket-types/:id/tickets", async (req, res) => {
            try {
                const { lastname, firstname, email, address } = req.body || {};

                const ticketType = await TicketTypeModel.findById(req.params.id);
                if (!ticketType) {
                    return this.notFound(res);
                }

                const event = await EventModel.findById(ticketType.event);
                if (!event || event.visibility !== "public") {
                    return this.notFound(res);
                }

                const { street, zip_code, city, country } = address && typeof address === "object" ? address : {};
                const addTicket = new TicketModel({
                    event: event._id,
                    ticket_type: ticketType._id,
                    lastname,
                    firstname,
                    email,
                    address: { street, zip_code, city, country }
                });
                await addTicket.validate();

                if (await TicketModel.exists({ event: event._id, email: addTicket.email })) {
                    return this.conflict(res, "A person can only get 1 ticket for this event");
                }

                const reserved = await TicketTypeModel.findOneAndUpdate(
                    { _id: ticketType._id, $expr: { $lt: ["$sold", "$quantity"] } },
                    { $inc: { sold: 1 } }
                );
                if (!reserved) {
                    return this.conflict(res, "This ticket type is sold out");
                }

                try {
                    await addTicket.save();
                } catch (error) {
                    await TicketTypeModel.updateOne({ _id: ticketType._id }, { $inc: { sold: -1 } });

                    if (error.code === 11000) {
                        return this.conflict(res, "A person can only get 1 ticket for this event");
                    }
                    throw error;
                }

                res.status(201).json(addTicket);
            } catch (error) {
                handleError(res, error, "POST /ticket-types/:id/tickets");
            }
        });
    }

    getEventTickets() {
        this.app.get("/events/:id/tickets", this.authToken, async (req, res) => {
            try {
                const event = await this.findOrganizedEvent(
                    req, res, req.params.id, "Only an organizer can read the tickets of this event"
                );
                if (!event) {
                    return;
                }

                const tickets = await TicketModel.find({ event: event._id })
                    .sort({ purchased_at: 1 })
                    .populate("ticket_type", "name amount");

                res.status(200).json(tickets);
            } catch (error) {
                handleError(res, error, "GET /events/:id/tickets");
            }
        });
    }

    getTicketById() {
        this.app.get("/tickets/:id", this.authToken, async (req, res) => {
            try {
                const ticket = await this.findOrganizedTicket(req, res, "Only an organizer can read this ticket");
                if (!ticket) {
                    return;
                }

                await ticket.populate([
                    { path: "ticket_type", select: "name amount" },
                    { path: "event", select: "name start_date end_date location" }
                ]);

                res.status(200).json(ticket);
            } catch (error) {
                handleError(res, error, "GET /tickets/:id");
            }
        });
    }

    deleteTicket() {
        this.app.delete("/tickets/:id", this.authToken, async (req, res) => {
            try {
                const ticket = await this.findOrganizedTicket(req, res, "Only an organizer can cancel this ticket");
                if (!ticket) {
                    return;
                }

                await ticket.deleteOne();
                await TicketTypeModel.updateOne({ _id: ticket.ticket_type }, { $inc: { sold: -1 } });

                res.status(200).json({
                    code: 200,
                    message: "Ticket cancelled successfully"
                });
            } catch (error) {
                handleError(res, error, "DELETE /tickets/:id");
            }
        });
    }

    run() {
        this.getEventTicketTypes();
        this.getTicketTypeById();
        this.addTicketType();
        this.updateTicketType();
        this.deleteTicketType();
        this.buyTicket();
        this.getEventTickets();
        this.getTicketById();
        this.deleteTicket();
    }
}

export default Tickets;
