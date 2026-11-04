import mongoose from "mongoose";
const messageSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["message", "call"], default: "message", index: true },
    receiveId: {
      type: String,
    },
    senderId: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      default: "",
    },
    chatType: { type: String, enum: ["direct", "group"], required: true },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
      index: true,
    },
    image: {
      type: String,
      default: "",
    },
    call: {
      callId: { type: String, index: true },
      callType: { type: String, enum: ["audio", "video"], default: "audio" },
      status: { type: String, enum: ["ringing", "accepted", "active", "rejected", "missed", "cancelled", "ended"] },
      startedAt: Date,
      acceptedAt: Date,
      endedAt: Date,
      durationSeconds: { type: Number, default: 0 },
      isActive: { type: Boolean, default: false },
      participants: { type: [String], default: [] },
    },
    softDeletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
  },
);

const Message = mongoose.model("Message", messageSchema);
export default Message;
