import mongoose from "mongoose";
const messageSchema = new mongoose.Schema(
  {
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
    softDeletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
  },
);

const Message = mongoose.model("Message", messageSchema);
export default Message;
