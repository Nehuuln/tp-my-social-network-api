import AlbumModel from "../models/album.mjs";
import PhotoModel from "../models/photo.mjs";
import CommentModel from "../models/comment.mjs";
import EventModel from "../models/event.mjs";
import { handleError } from "../utils/validation.mjs";

const USER_FIELDS = "firstname lastname avatar";

const Albums = class Albums {
    constructor(app, authToken) {
        this.app = app;
        this.authToken = authToken;
        this.run();
    }

    notFound(res, message = "Album not found") {
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

    async findAlbum(req, res) {
        const album = await AlbumModel.findById(req.params.id);
        const event = album ? await EventModel.findById(album.event) : null;

        if (!event || (event.visibility === "private" && !event.isParticipant(req.user.id))) {
            this.notFound(res);
            return null;
        }

        return { album, event };
    }

    async findPhoto(req, res, album) {
        const photo = await PhotoModel.findOne({ _id: req.params.photoId, album: album._id });
        if (!photo) {
            this.notFound(res, "Photo not found");
            return null;
        }

        return photo;
    }

    async findComment(req, res, photo) {
        const comment = await CommentModel.findOne({ _id: req.params.commentId, photo: photo._id });
        if (!comment) {
            this.notFound(res, "Comment not found");
            return null;
        }

        return comment;
    }

    addAlbum() {
        this.app.post("/events/:id/albums", this.authToken, async (req, res) => {
            try {
                const { name, description } = req.body || {};

                const event = await this.findEvent(req, res);
                if (!event) {
                    return;
                }

                if (!event.isParticipant(req.user.id)) {
                    return this.forbidden(res, "Only a participant can create an album in this event");
                }

                const addAlbum = new AlbumModel({
                    event: event._id,
                    name,
                    description,
                    created_by: req.user.id
                });
                await addAlbum.save();

                res.status(201).json(addAlbum);
            } catch (error) {
                handleError(res, error, "POST /events/:id/albums");
            }
        });
    }

    getEventAlbums() {
        this.app.get("/events/:id/albums", this.authToken, async (req, res) => {
            try {
                const event = await this.findEvent(req, res);
                if (!event) {
                    return;
                }

                const albums = await AlbumModel.find({ event: event._id })
                    .sort({ created_at: 1 })
                    .populate("created_by", USER_FIELDS);

                res.status(200).json(albums);
            } catch (error) {
                handleError(res, error, "GET /events/:id/albums");
            }
        });
    }

    getAlbumById() {
        this.app.get("/albums/:id", this.authToken, async (req, res) => {
            try {
                const found = await this.findAlbum(req, res);
                if (!found) {
                    return;
                }

                await found.album.populate([
                    { path: "created_by", select: USER_FIELDS },
                    { path: "event", select: "name start_date end_date" }
                ]);

                const photos = await PhotoModel.find({ album: found.album._id })
                    .sort({ created_at: 1 })
                    .populate("author", USER_FIELDS);

                res.status(200).json({
                    ...found.album.toJSON(),
                    photos
                });
            } catch (error) {
                handleError(res, error, "GET /albums/:id");
            }
        });
    }

    updateAlbum() {
        this.app.put("/albums/:id", this.authToken, async (req, res) => {
            try {
                const { name, description } = req.body || {};

                const found = await this.findAlbum(req, res);
                if (!found) {
                    return;
                }

                if (!found.album.created_by.equals(req.user.id) && !found.event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "Only the creator or an organizer can update this album");
                }

                const fields = { name, description };
                for (const [key, value] of Object.entries(fields)) {
                    if (value !== undefined) {
                        found.album[key] = value;
                    }
                }
                await found.album.save();

                res.status(200).json(found.album);
            } catch (error) {
                handleError(res, error, "PUT /albums/:id");
            }
        });
    }

    deleteAlbum() {
        this.app.delete("/albums/:id", this.authToken, async (req, res) => {
            try {
                const found = await this.findAlbum(req, res);
                if (!found) {
                    return;
                }

                if (!found.album.created_by.equals(req.user.id) && !found.event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "Only the creator or an organizer can delete this album");
                }

                const photoIds = await PhotoModel.find({ album: found.album._id }).distinct("_id");
                await CommentModel.deleteMany({ photo: { $in: photoIds } });
                await PhotoModel.deleteMany({ album: found.album._id });
                await found.album.deleteOne();

                res.status(200).json({
                    code: 200,
                    message: "Album deleted successfully"
                });
            } catch (error) {
                handleError(res, error, "DELETE /albums/:id");
            }
        });
    }

    addPhoto() {
        this.app.post("/albums/:id/photos", this.authToken, async (req, res) => {
            try {
                const { url, caption } = req.body || {};

                const found = await this.findAlbum(req, res);
                if (!found) {
                    return;
                }

                if (!found.event.isParticipant(req.user.id)) {
                    return this.forbidden(res, "Only a participant can post a photo in this album");
                }

                const addPhoto = new PhotoModel({
                    album: found.album._id,
                    author: req.user.id,
                    url,
                    caption
                });
                await addPhoto.save();

                res.status(201).json(addPhoto);
            } catch (error) {
                handleError(res, error, "POST /albums/:id/photos");
            }
        });
    }

    getPhotos() {
        this.app.get("/albums/:id/photos", this.authToken, async (req, res) => {
            try {
                const found = await this.findAlbum(req, res);
                if (!found) {
                    return;
                }

                const photos = await PhotoModel.find({ album: found.album._id })
                    .sort({ created_at: 1 })
                    .populate("author", USER_FIELDS);

                res.status(200).json(photos);
            } catch (error) {
                handleError(res, error, "GET /albums/:id/photos");
            }
        });
    }

    getPhotoById() {
        this.app.get("/albums/:id/photos/:photoId", this.authToken, async (req, res) => {
            try {
                const found = await this.findAlbum(req, res);
                if (!found) {
                    return;
                }

                const photo = await this.findPhoto(req, res, found.album);
                if (!photo) {
                    return;
                }

                await photo.populate("author", USER_FIELDS);

                const comments = await CommentModel.find({ photo: photo._id })
                    .sort({ created_at: 1 })
                    .populate("author", USER_FIELDS);

                res.status(200).json({
                    ...photo.toJSON(),
                    comments
                });
            } catch (error) {
                handleError(res, error, "GET /albums/:id/photos/:photoId");
            }
        });
    }

    updatePhoto() {
        this.app.put("/albums/:id/photos/:photoId", this.authToken, async (req, res) => {
            try {
                const { caption } = req.body || {};

                const found = await this.findAlbum(req, res);
                if (!found) {
                    return;
                }

                const photo = await this.findPhoto(req, res, found.album);
                if (!photo) {
                    return;
                }

                if (!photo.author.equals(req.user.id)) {
                    return this.forbidden(res, "You can only update your own photos");
                }

                if (caption !== undefined) {
                    photo.caption = caption;
                }
                await photo.save();

                res.status(200).json(photo);
            } catch (error) {
                handleError(res, error, "PUT /albums/:id/photos/:photoId");
            }
        });
    }

    deletePhoto() {
        this.app.delete("/albums/:id/photos/:photoId", this.authToken, async (req, res) => {
            try {
                const found = await this.findAlbum(req, res);
                if (!found) {
                    return;
                }

                const photo = await this.findPhoto(req, res, found.album);
                if (!photo) {
                    return;
                }

                if (!photo.author.equals(req.user.id) && !found.event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "You can only delete your own photos");
                }

                await CommentModel.deleteMany({ photo: photo._id });
                await photo.deleteOne();

                res.status(200).json({
                    code: 200,
                    message: "Photo deleted successfully"
                });
            } catch (error) {
                handleError(res, error, "DELETE /albums/:id/photos/:photoId");
            }
        });
    }

    getComments() {
        this.app.get("/albums/:id/photos/:photoId/comments", this.authToken, async (req, res) => {
            try {
                const found = await this.findAlbum(req, res);
                if (!found) {
                    return;
                }

                const photo = await this.findPhoto(req, res, found.album);
                if (!photo) {
                    return;
                }

                const comments = await CommentModel.find({ photo: photo._id })
                    .sort({ created_at: 1 })
                    .populate("author", USER_FIELDS);

                res.status(200).json(comments);
            } catch (error) {
                handleError(res, error, "GET /albums/:id/photos/:photoId/comments");
            }
        });
    }

    addComment() {
        this.app.post("/albums/:id/photos/:photoId/comments", this.authToken, async (req, res) => {
            try {
                const { content } = req.body || {};

                const found = await this.findAlbum(req, res);
                if (!found) {
                    return;
                }

                if (!found.event.isParticipant(req.user.id)) {
                    return this.forbidden(res, "Only a participant can comment a photo of this album");
                }

                const photo = await this.findPhoto(req, res, found.album);
                if (!photo) {
                    return;
                }

                const addComment = new CommentModel({
                    photo: photo._id,
                    author: req.user.id,
                    content
                });
                await addComment.save();

                res.status(201).json(addComment);
            } catch (error) {
                handleError(res, error, "POST /albums/:id/photos/:photoId/comments");
            }
        });
    }

    updateComment() {
        this.app.put("/albums/:id/photos/:photoId/comments/:commentId", this.authToken, async (req, res) => {
            try {
                const { content } = req.body || {};

                const found = await this.findAlbum(req, res);
                if (!found) {
                    return;
                }

                const photo = await this.findPhoto(req, res, found.album);
                if (!photo) {
                    return;
                }

                const comment = await this.findComment(req, res, photo);
                if (!comment) {
                    return;
                }

                if (!comment.author.equals(req.user.id)) {
                    return this.forbidden(res, "You can only update your own comments");
                }

                comment.content = content;
                comment.updated_at = new Date();
                await comment.save();

                res.status(200).json(comment);
            } catch (error) {
                handleError(res, error, "PUT /albums/:id/photos/:photoId/comments/:commentId");
            }
        });
    }

    deleteComment() {
        this.app.delete("/albums/:id/photos/:photoId/comments/:commentId", this.authToken, async (req, res) => {
            try {
                const found = await this.findAlbum(req, res);
                if (!found) {
                    return;
                }

                const photo = await this.findPhoto(req, res, found.album);
                if (!photo) {
                    return;
                }

                const comment = await this.findComment(req, res, photo);
                if (!comment) {
                    return;
                }

                if (!comment.author.equals(req.user.id) && !found.event.isOrganizer(req.user.id)) {
                    return this.forbidden(res, "You can only delete your own comments");
                }

                await comment.deleteOne();

                res.status(200).json({
                    code: 200,
                    message: "Comment deleted successfully"
                });
            } catch (error) {
                handleError(res, error, "DELETE /albums/:id/photos/:photoId/comments/:commentId");
            }
        });
    }

    run() {
        this.getEventAlbums();
        this.getAlbumById();
        this.addAlbum();
        this.updateAlbum();
        this.deleteAlbum();
        this.getPhotos();
        this.getPhotoById();
        this.addPhoto();
        this.updatePhoto();
        this.deletePhoto();
        this.getComments();
        this.addComment();
        this.updateComment();
        this.deleteComment();
    }
}

export default Albums;
