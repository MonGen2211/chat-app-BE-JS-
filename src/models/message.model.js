import mongoose from "mongoose";
const messageSchema = new mongoose.Schema(
  {
    receiveId: {
      type: String,
      required: true,
    },

    senderId: {
      type: String,
      required: true,
    },

    text: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Message = mongoose.model("Message", messageSchema);
export default Message;
