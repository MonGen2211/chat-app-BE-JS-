import { response } from "express";
import jwt from "jsonwebtoken";
export const generateToken = async (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: true, // ⚠️ Bắt buộc nếu domain dùng HTTPS
    sameSite: "None",     // ⚠️ Bắt buộc để cookie hoạt động cross-domain
    process: process.env.NODE_ENV || "development",
  });
  return token;
};
