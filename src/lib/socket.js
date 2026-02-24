import { Server } from "socket.io";
import http from "http";

import express from "express";

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://chat-app-vite-js-fe-mongen2211s-projects.vercel.app", "https://chat-app-vite-js-m8xioyz3t-mongen2211s-projects.vercel.app"],
  },
});

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

export function getReceiverRoom(userId) {
  return userId?.toString();
}
// usẻ to store online users
const userSocketMap = {}; //{userId: socketId}

io.on("connection", (socket) => {

  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap[userId] = socket.id;

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("joinGroup", (groupId) => {
    if (!groupId) return;
    socket.join(groupId.toString());
  });

  socket.on("leaveGroup", (groupId) => {
    if (!groupId) return;
    socket.leave(groupId.toString());
  });

  socket.on("disconnect", () => {
    {

      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

export { io, app, server };
