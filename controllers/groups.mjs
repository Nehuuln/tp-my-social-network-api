import mongoose from "mongoose";
import GroupModel from "../models/group.mjs";
import { handleError } from "../utils/validation.mjs";
import { findUser } from "../utils/users.mjs";

const USER_FIELDS = "firstname lastname avatar";

const Groups = class Groups {
    constructor(app, authToken) {
        this.app = app;
        this.authToken = authToken;
        this.run();
    }

    notFound(res) {
        return res.status(404).json({
            code: 404,
            message: "Group not found"
        });
    }

    forbidden(res, message) {
        return res.status(403).json({
            code: 403,
            message
        });
    }

    addGroup() {
        this.app.post("/groups", this.authToken, async (req, res) => {
            try {
                const {
                    name, description, icon, cover, type,
                    allow_members_to_post, allow_members_to_create_events
                } = req.body || {};

                const addGroup = new GroupModel({
                    name, description, icon, cover, type,
                    allow_members_to_post, allow_members_to_create_events,
                    administrators: [req.user.id],
                    members: [req.user.id]
                });
                await addGroup.save();

                res.status(201).json(addGroup);
            } catch (error) {
                handleError(res, error, "POST /groups");
            }
        });
    }

    getGroups() {
        this.app.get("/groups", this.authToken, async (req, res) => {
            try {
                const groups = await GroupModel.find({
                    $or: [
                        { type: { $in: ["public", "private"] } },
                        { members: req.user.id }
                    ]
                }).select("-members -administrators");

                res.status(200).json(groups);
            } catch (error) {
                handleError(res, error, "GET /groups");
            }
        });
    }

    getGroupById() {
        this.app.get("/groups/:id", this.authToken, async (req, res) => {
            try {
                const group = await GroupModel.findById(req.params.id);
                const isMember = group && group.isMember(req.user.id);

                if (!group || (group.type === "secret" && !isMember)) {
                    return this.notFound(res);
                }

                if (group.type === "private" && !isMember) {
                    const { members, administrators, ...publicGroup } = group.toJSON();
                    return res.status(200).json(publicGroup);
                }

                await group.populate([
                    { path: "members", select: USER_FIELDS },
                    { path: "administrators", select: USER_FIELDS }
                ]);

                res.status(200).json(group);
            } catch (error) {
                handleError(res, error, "GET /groups/:id");
            }
        });
    }

    updateGroup() {
        this.app.put("/groups/:id", this.authToken, async (req, res) => {
            try {
                const {
                    name, description, icon, cover, type,
                    allow_members_to_post, allow_members_to_create_events
                } = req.body || {};

                const group = await GroupModel.findById(req.params.id);
                if (!group || (group.type === "secret" && !group.isMember(req.user.id))) {
                    return this.notFound(res);
                }

                if (!group.isAdministrator(req.user.id)) {
                    return this.forbidden(res, "Only an administrator can update this group");
                }

                const fields = {
                    name, description, icon, cover, type,
                    allow_members_to_post, allow_members_to_create_events
                };
                for (const [key, value] of Object.entries(fields)) {
                    if (value !== undefined) {
                        group[key] = value;
                    }
                }
                await group.save();

                res.status(200).json(group);
            } catch (error) {
                handleError(res, error, "PUT /groups/:id");
            }
        });
    }

    deleteGroup() {
        this.app.delete("/groups/:id", this.authToken, async (req, res) => {
            try {
                const group = await GroupModel.findById(req.params.id);
                if (!group || (group.type === "secret" && !group.isMember(req.user.id))) {
                    return this.notFound(res);
                }

                if (!group.isAdministrator(req.user.id)) {
                    return this.forbidden(res, "Only an administrator can delete this group");
                }

                await group.deleteOne();

                res.status(200).json({
                    code: 200,
                    message: "Group deleted successfully"
                });
            } catch (error) {
                handleError(res, error, "DELETE /groups/:id");
            }
        });
    }

    joinGroup() {
        this.app.post("/groups/:id/join", this.authToken, async (req, res) => {
            try {
                const group = await GroupModel.findById(req.params.id);
                if (!group || (group.type === "secret" && !group.isMember(req.user.id))) {
                    return this.notFound(res);
                }

                if (group.isMember(req.user.id)) {
                    return res.status(409).json({
                        code: 409,
                        message: "You are already a member of this group"
                    });
                }

                if (group.type !== "public") {
                    return this.forbidden(res, "Only an administrator can add members to this group");
                }

                group.members.push(req.user.id);
                await group.save();

                res.status(200).json(group);
            } catch (error) {
                handleError(res, error, "POST /groups/:id/join");
            }
        });
    }

    addMember() {
        this.app.post("/groups/:id/members", this.authToken, async (req, res) => {
            try {
                const { user_id } = req.body || {};

                const group = await GroupModel.findById(req.params.id);
                if (!group || (group.type === "secret" && !group.isMember(req.user.id))) {
                    return this.notFound(res);
                }

                if (!group.isAdministrator(req.user.id)) {
                    return this.forbidden(res, "Only an administrator can add members to this group");
                }

                const user = await findUser(res, user_id);
                if (!user) {
                    return;
                }

                if (group.isMember(user._id)) {
                    return res.status(409).json({
                        code: 409,
                        message: "This user is already a member of this group"
                    });
                }

                group.members.push(user._id);
                await group.save();

                res.status(200).json(group);
            } catch (error) {
                handleError(res, error, "POST /groups/:id/members");
            }
        });
    }

    removeMember() {
        this.app.delete("/groups/:id/members/:userId", this.authToken, async (req, res) => {
            try {
                const { id, userId } = req.params;

                const group = await GroupModel.findById(id);
                if (!group || (group.type === "secret" && !group.isMember(req.user.id))) {
                    return this.notFound(res);
                }

                if (userId !== req.user.id && !group.isAdministrator(req.user.id)) {
                    return this.forbidden(res, "Only an administrator can remove another member");
                }

                if (!mongoose.isValidObjectId(userId) || !group.isMember(userId)) {
                    return res.status(404).json({
                        code: 404,
                        message: "Member not found"
                    });
                }

                if (group.isAdministrator(userId) && group.administrators.length === 1) {
                    return res.status(409).json({
                        code: 409,
                        message: "A group must keep at least 1 administrator"
                    });
                }

                group.members.pull(userId);
                group.administrators.pull(userId);
                await group.save();

                res.status(200).json(group);
            } catch (error) {
                handleError(res, error, "DELETE /groups/:id/members/:userId");
            }
        });
    }

    addAdministrator() {
        this.app.post("/groups/:id/administrators", this.authToken, async (req, res) => {
            try {
                const { user_id } = req.body || {};

                const group = await GroupModel.findById(req.params.id);
                if (!group || (group.type === "secret" && !group.isMember(req.user.id))) {
                    return this.notFound(res);
                }

                if (!group.isAdministrator(req.user.id)) {
                    return this.forbidden(res, "Only an administrator can add administrators to this group");
                }

                const user = await findUser(res, user_id);
                if (!user) {
                    return;
                }

                if (!group.isMember(user._id)) {
                    return res.status(409).json({
                        code: 409,
                        message: "This user must be a member of the group first"
                    });
                }

                if (group.isAdministrator(user._id)) {
                    return res.status(409).json({
                        code: 409,
                        message: "This user is already an administrator of this group"
                    });
                }

                group.administrators.push(user._id);
                await group.save();

                res.status(200).json(group);
            } catch (error) {
                handleError(res, error, "POST /groups/:id/administrators");
            }
        });
    }

    removeAdministrator() {
        this.app.delete("/groups/:id/administrators/:userId", this.authToken, async (req, res) => {
            try {
                const { id, userId } = req.params;

                const group = await GroupModel.findById(id);
                if (!group || (group.type === "secret" && !group.isMember(req.user.id))) {
                    return this.notFound(res);
                }

                if (!group.isAdministrator(req.user.id)) {
                    return this.forbidden(res, "Only an administrator can remove administrators from this group");
                }

                if (!mongoose.isValidObjectId(userId) || !group.isAdministrator(userId)) {
                    return res.status(404).json({
                        code: 404,
                        message: "Administrator not found"
                    });
                }

                if (group.administrators.length === 1) {
                    return res.status(409).json({
                        code: 409,
                        message: "A group must keep at least 1 administrator"
                    });
                }

                group.administrators.pull(userId);
                await group.save();

                res.status(200).json(group);
            } catch (error) {
                handleError(res, error, "DELETE /groups/:id/administrators/:userId");
            }
        });
    }

    run() {
        this.getGroups();
        this.getGroupById();
        this.addGroup();
        this.updateGroup();
        this.deleteGroup();
        this.joinGroup();
        this.addMember();
        this.removeMember();
        this.addAdministrator();
        this.removeAdministrator();
    }
}

export default Groups;
