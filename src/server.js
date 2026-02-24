import express from "express";
import dotenv from "dotenv";

import authRoutes from "./routes/user.route.js";
import messageRoutes from "./routes/message.route.js";
import groupRoutes from "./routes/group.route.js";
import connectDb from "./lib/connectDb.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import { app, server } from "./lib/socket.js";

dotenv.config();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());
const allowedOrigins = [
  "http://localhost:3000",
  "https://chat-app-vite-js-fe-mongen2211s-projects.vercel.app",
	"https://chat-app-vite-js-m8xioyz3t-mongen2211s-projects.vercel.app",
];
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

const PORT = process.env.PORT;

app.use("/api/auth", authRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/group", groupRoutes);

server.listen(PORT, () => {
  console.log(`🚀 File server running at http://localhost:${PORT}`);
  connectDb();
});
