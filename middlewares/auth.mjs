import jwt from "jsonwebtoken";

const authToken = (req, res, next) => {
    const header = req.headers.authorization;

    if (typeof header !== "string" || !header.startsWith("Bearer ")) {
        return res.status(401).json({
            code: 401,
            message: "Missing token"
        });
    }

    try {
        const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
        req.user = { id: payload.id, email: payload.email };
        next();
    } catch (error) {
        res.status(401).json({
            code: 401,
            message: "Invalid or expired token"
        });
    }
};

export default authToken;
