import express from "express";
import dotenv from "dotenv";

import authRoutes from "./routes/user.route.js";
import messageRoutes from "./routes/message.route.js";
import connectDb from "./lib/connectDb.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import { app, server } from "./lib/socket.js";

dotenv.config();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
const PORT = process.env.PORT;

app.use("/api/auth", authRoutes);
app.use("/api/message", messageRoutes);

server.listen(PORT, () => {
  console.log(`🚀 File server running at http://localhost:${PORT}`);
  connectDb();
});
