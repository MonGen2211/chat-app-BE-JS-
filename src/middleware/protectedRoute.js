import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
export const protectedRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(400).json({ message: "You need to Login first" });
    }

    // check verify
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: "Unthorized " });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log("error in check Controller: ", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
