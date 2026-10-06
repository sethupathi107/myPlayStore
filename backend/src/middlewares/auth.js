import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

function auth(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Access token required"
        });
    }


    const [type, token] = authHeader.split(" ");

    if (type !== "Bearer" || !token) {
        return res.status(401).json({
            message: "Invalid Authorization header"
        });
    }

    try {

        const decoded = jwt.verify(
            token,
            JWT_SECRET
        );
        req.user = decoded;
        next();

    } catch (error) {

        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

export default auth;