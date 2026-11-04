import { Server } from "socket.io";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001",
  "https://chat-app-vite-js-fe-mongen2211s-projects.vercel.app",
  "https://chat-app-vite-js-m8xioyz3t-mongen2211s-projects.vercel.app",
];
const io = new Server(server, { cors: { origin: allowedOrigins, credentials: true } });

const userSockets = new Map();
const directCalls = new Map();
const groupCalls = new Map();

function getCookie(cookieHeader, name) {
  const entry = cookieHeader?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

io.use((socket, next) => {
  try {
    const token = getCookie(socket.handshake.headers.cookie, "jwt");
    if (!token) return next(new Error("Unauthorized"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = decoded.userId.toString();
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

export function getReceiverSocketId(userId) {
  return userId?.toString();
}

export function getReceiverRoom(userId) {
  return userId?.toString();
}

function emitOnlineUsers() {
  io.emit("getOnlineUsers", [...userSockets.keys()]);
}

async function getUserInfo(userId) {
  const user = await User.findById(userId).select("fullname profilefic").lean();
  return user ? { _id: userId, fullName: user.fullname, profilePic: user.profilefic } : { _id: userId };
}

function isGroupMember(group, userId) {
  return Boolean(group && (
    group.members.includes(userId) ||
    group.admins.includes(userId) ||
    group.createdBy === userId
  ));
}

function emitDirectStatus(call, status) {
  const payload = { ...call, status };
  if (status === "accepted" || status === "rejected") {
    io.to(call.fromUserId).emit("call:response", payload);
    return;
  }
  io.to(call.fromUserId).to(call.toUserId).emit("call:status", payload);
}

function directCallForUser(callId, userId) {
  const call = directCalls.get(callId);
  return call && (call.fromUserId === userId || call.toUserId === userId) ? call : null;
}

function groupCallForUser(callId, userId) {
  const call = groupCalls.get(callId);
  return call?.participants.has(userId) ? call : null;
}

async function updateCallMessage(recordId, updates, rooms) {
  const message = await Message.findByIdAndUpdate(
    recordId,
    { $set: updates },
    { new: true, runValidators: true },
  ).lean();
  if (message) {
    for (const room of rooms) io.to(room).emit("call:record-updated", message);
  }
  return message;
}

async function finishDirectCall(call, status) {
  const endedAt = new Date();
  const durationSeconds = status === "ended" && call.startedAt
    ? Math.max(0, Math.floor((endedAt - call.startedAt) / 1000))
    : 0;
  call.status = status;
  call.endedAt = endedAt;
  call.isActive = false;
  call.durationSeconds = durationSeconds;
  await updateCallMessage(call.recordId, {
    "call.status": status,
    "call.endedAt": endedAt,
    "call.durationSeconds": durationSeconds,
    "call.isActive": false,
  }, [call.fromUserId, call.toUserId]);
  emitDirectStatus(call, status);
}

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  socket.join(userId);
  const sockets = userSockets.get(userId) || new Set();
  sockets.add(socket.id);
  userSockets.set(userId, sockets);
  emitOnlineUsers();

  socket.on("joinGroup", async (groupId) => {
    if (!groupId) return;
    try {
      const group = await Group.findById(groupId).select("members admins createdBy");
      if (isGroupMember(group, userId)) socket.join(group._id.toString());
    } catch {}
  });

  socket.on("leaveGroup", (groupId) => {
    if (groupId) socket.leave(groupId.toString());
  });

  // 1:1 invitation and accept/decline flow.
  socket.on("call:invite", async ({ callId, toUserId, callType = "audio" } = {}, ack = () => {}) => {
    try {
      if (!callId || !toUserId || toUserId === userId) return ack({ ok: false, message: "Invalid call target" });
      if (!userSockets.has(toUserId)) return ack({ ok: false, message: "User is offline" });
      const callerInfo = await getUserInfo(userId);
      const receiverInfo = await getUserInfo(toUserId);
      const record = await Message.create({
        senderId: userId,
        receiveId: toUserId,
        chatType: "direct",
        type: "call",
        call: {
          callId,
          callType,
          status: "ringing",
          durationSeconds: 0,
          isActive: false,
        },
      });
      const call = {
        callId,
        messageId: callId,
        recordId: record._id.toString(),
        chatType: "direct",
        fromUserId: userId,
        toUserId,
        senderId: userId,
        receiveId: toUserId,
        caller: callerInfo,
        receiver: receiverInfo,
        callerInfo,
        callType,
        status: "ringing",
      };
      directCalls.set(callId, call);
      io.to(userId).to(toUserId).emit("newMessage", record);
      io.to(toUserId).emit("call:incoming", call);
      setTimeout(() => {
        const current = directCalls.get(callId);
        if (current?.status === "ringing") {
          directCalls.delete(callId);
          finishDirectCall(current, "missed").catch((error) => console.error("Failed to save missed call:", error.message));
        }
      }, 30000);
      ack({ ok: true, call });
    } catch (error) {
      ack({ ok: false, message: error.message });
    }
  });

  socket.on("call:respond", async ({ callId, action } = {}, ack = () => {}) => {
    const call = directCallForUser(callId, userId);
    if (!call || call.toUserId !== userId || call.status !== "ringing") {
      return ack({ ok: false, message: "Call is no longer available" });
    }
    const status = action === "accept" ? "accepted" : action === "reject" ? "rejected" : null;
    if (!status) return ack({ ok: false, message: "Invalid call response" });
    call.status = status;
    if (status === "accepted") {
      call.startedAt = new Date();
      call.isActive = true;
      await updateCallMessage(call.recordId, {
        "call.status": "accepted",
        "call.acceptedAt": call.startedAt,
        "call.startedAt": call.startedAt,
        "call.isActive": true,
      }, [call.fromUserId, call.toUserId]);
      emitDirectStatus(call, status);
    } else {
      directCalls.delete(callId);
      await finishDirectCall(call, "rejected");
    }
    ack({ ok: true, call });
  });

  socket.on("call:end", async ({ callId } = {}, ack = () => {}) => {
    const call = directCallForUser(callId, userId);
    if (!call) return ack({ ok: false, message: "Call not found" });
    directCalls.delete(callId);
    await finishDirectCall(call, call.status === "ringing" ? "cancelled" : "ended");
    ack({ ok: true });
  });

  socket.on("call:ready", ({ messageId } = {}) => {
    const call = directCallForUser(messageId, userId);
    if (!call || call.toUserId !== userId || call.status !== "accepted") return;
    io.to(call.fromUserId).emit("call:ready", { messageId: call.callId });
  });

  for (const eventName of ["call:offer", "call:answer", "call:ice"]) {
    socket.on(eventName, (payload = {}) => {
      const call = directCallForUser(payload.messageId, userId);
      if (!call || call.status !== "accepted") return;
      const target = call.fromUserId === userId ? call.toUserId : call.fromUserId;
      if (payload.to !== target) return;
      io.to(target).emit(eventName, { ...payload, from: userId });
    });
  }

  // Group call lifecycle: only group members can start, join, or signal.
  socket.on("call:group-start", async ({ callId, groupId, callType = "audio" } = {}, ack = () => {}) => {
    try {
      const group = await Group.findById(groupId);
      if (!isGroupMember(group, userId)) return ack({ ok: false, message: "You are not a member of this group" });
      if ([...groupCalls.values()].some((call) => call.groupId === groupId && !call.ended)) {
        return ack({ ok: false, message: "This group already has an active call" });
      }
      const initiatorInfo = await getUserInfo(userId);
      const memberIds = [...new Set([...group.members, ...group.admins, group.createdBy])];
      const startedAt = new Date();
      const record = await Message.create({
        senderId: userId,
        groupId: group._id,
        chatType: "group",
        type: "call",
        call: {
          callId,
          callType,
          status: "active",
          startedAt,
          durationSeconds: 0,
          isActive: true,
          participants: [userId],
        },
      });
      const call = {
        callId,
        recordId: record._id.toString(),
        groupId: group._id.toString(),
        groupName: group.name,
        groupAvatar: group.avatar,
        callType,
        initiatorId: userId,
        initiatorInfo,
        startedAt,
        memberIds,
        participants: new Map([[userId, initiatorInfo]]),
        ended: false,
      };
      groupCalls.set(callId, call);
      socket.join(`call:${callId}`);
      const payload = {
        callId,
        groupId: call.groupId,
        groupName: call.groupName,
        groupAvatar: call.groupAvatar,
        callType,
        messageId: callId,
        recordId: record._id.toString(),
        initiatorInfo,
        currentParticipants: [],
      };
      const recipientIds = new Set([...group.members, ...group.admins, group.createdBy]);
      for (const recipientId of recipientIds) io.to(recipientId).emit("newMessage", record);
      io.to(call.groupId).emit("newMessage", record);
      recipientIds.delete(userId);
      for (const recipientId of recipientIds) io.to(recipientId).emit("call:group-incoming", payload);
      ack({ ok: true, call: payload });
    } catch (error) {
      ack({ ok: false, message: error.message });
    }
  });

  socket.on("call:group-accept", async ({ callId } = {}, ack = () => {}) => {
    try {
      const call = groupCalls.get(callId);
      if (!call || call.ended) return ack({ ok: false, message: "Group call is no longer active" });
      const group = await Group.findById(call.groupId).select("members admins createdBy");
      if (!isGroupMember(group, userId)) return ack({ ok: false, message: "You are not a member of this group" });
      const currentParticipants = [...call.participants.entries()]
        .filter(([participantId]) => participantId !== userId)
        .map(([, info]) => info);
      ack({ ok: true, currentParticipants });
    } catch (error) {
      ack({ ok: false, message: error.message });
    }
  });

  socket.on("call:group-join", async ({ groupId, callId, userInfo } = {}) => {
    const call = groupCalls.get(callId);
    if (!call || call.ended || call.groupId !== groupId) return;
    const group = await Group.findById(groupId).select("members admins createdBy");
    if (!isGroupMember(group, userId)) return;
    const info = await getUserInfo(userId);
    const safeInfo = { ...info, ...(userInfo?.fullName ? { fullName: info.fullName } : {}) };
    const isNewParticipant = !call.participants.has(userId);
    call.participants.set(userId, safeInfo);
    socket.join(`call:${callId}`);
    socket.to(`call:${callId}`).emit("call:group-join", { callId, fromUserId: userId, userInfo: safeInfo });
    if (isNewParticipant) {
      await updateCallMessage(call.recordId, {
        "call.participants": [...call.participants.keys()],
      }, [call.groupId, ...call.memberIds]);
    }
  });

  for (const eventName of ["call:group-offer", "call:group-answer", "call:group-ice"]) {
    socket.on(eventName, (payload = {}) => {
      const call = groupCallForUser(payload.callId, userId);
      if (!call || call.groupId !== payload.groupId || !call.participants.has(payload.to)) return;
      io.to(payload.to).emit(eventName, { ...payload, from: userId });
    });
  }

  socket.on("call:group-leave", async ({ callId, groupId } = {}) => {
    const call = groupCallForUser(callId, userId);
    if (!call || call.groupId !== groupId) return;
    call.participants.delete(userId);
    io.to(`call:${callId}`).emit("call:group-leave", { callId, groupId, fromUserId: userId });
    if (call.participants.size > 0) {
      await updateCallMessage(call.recordId, {
        "call.participants": [...call.participants.keys()],
      }, [call.groupId, ...call.memberIds]);
    }
    if (call.participants.size === 0) {
      call.ended = true;
      const endedAt = new Date();
      await updateCallMessage(call.recordId, {
        "call.status": "ended",
        "call.isActive": false,
        "call.participants": [],
        "call.endedAt": endedAt,
        "call.durationSeconds": Math.max(0, Math.floor((endedAt - call.startedAt) / 1000)),
      }, [call.groupId, ...call.memberIds]);
      io.to(`call:${callId}`).emit("call:group-ended", { callId, groupId });
      groupCalls.delete(callId);
    }
    socket.leave(`call:${callId}`);
  });

  socket.on("call:group-decline", async ({ callId, groupId } = {}) => {
    const call = groupCalls.get(callId);
    if (!call || call.groupId !== groupId) return;
    try {
      const group = await Group.findById(groupId).select("members admins createdBy");
      if (isGroupMember(group, userId)) {
        io.to(call.initiatorId).emit("call:group-declined", { callId, groupId, fromUserId: userId });
      }
    } catch {}
  });

  socket.on("disconnect", async () => {
    const activeSockets = userSockets.get(userId);
    activeSockets?.delete(socket.id);
    if (activeSockets?.size === 0) {
      userSockets.delete(userId);
      for (const [callId, call] of directCalls) {
        if (call.fromUserId !== userId && call.toUserId !== userId) continue;
        directCalls.delete(callId);
        await finishDirectCall(call, call.status === "ringing" ? "missed" : "ended");
      }
      for (const [callId, call] of groupCalls) {
        if (!call.participants.has(userId)) continue;
        call.participants.delete(userId);
        io.to(`call:${callId}`).emit("call:group-leave", { callId, groupId: call.groupId, fromUserId: userId });
        if (call.participants.size === 0) {
          call.ended = true;
          const endedAt = new Date();
          await updateCallMessage(call.recordId, {
            "call.status": "ended",
            "call.isActive": false,
            "call.participants": [],
            "call.endedAt": endedAt,
            "call.durationSeconds": Math.max(0, Math.floor((endedAt - call.startedAt) / 1000)),
          }, [call.groupId, ...call.memberIds]);
          io.to(`call:${callId}`).emit("call:group-ended", { callId, groupId: call.groupId });
          groupCalls.delete(callId);
        } else {
          await updateCallMessage(call.recordId, {
            "call.participants": [...call.participants.keys()],
          }, [call.groupId, ...call.memberIds]);
        }
      }
    }
    emitOnlineUsers();
  });
});

export { io, app, server };
