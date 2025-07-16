import cryptoJS from "crypto-js";
import Message from "../models/message.model.js";
import cryptoJs from "crypto-js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const receiveId = req.params.id;
    const senderId = req.user._id.toString();

    let hashText = "";
    let hashImage = "";
    if (text) {
      hashText = cryptoJS.AES.encrypt(
        text,
        process.env.JWT_SECRETKEY_CRYPTOJS
      ).toString();
    }

    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      const imageUrl = uploadResponse.secure_url;
      hashImage = cryptoJS.AES.encrypt(
        imageUrl,
        process.env.JWT_SECRETKEY_CRYPTOJS
      ).toString();
    }

    let newMessage = new Message({
      senderId,
      receiveId,
      text: hashText || "",
      image: hashImage || "",
    });

    await newMessage.save();

    newMessage.text = text;
    newMessage.image = image;

    const receiveSoceketId = getReceiverSocketId(receiveId);
    if (receiveSoceketId) {
      io.to(receiveSoceketId).emit("newMessage", newMessage);
    }

    res.status(200).json({ message: "SendMessage Successfully", newMessage });
  } catch (error) {
    console.log("Error in sendMessage controller: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMessage = async (req, res) => {
  try {
    const receiveId = req.params.id;
    const senderId = req.user._id.toString();

    const messages = await Message.find({
      $or: [
        // message: me => you
        { senderId: senderId, receiveId: receiveId },
        // message: you => me
        { senderId: receiveId, receiveId: senderId },
      ],
    });

    const decodeMessages = messages.map((message) => ({
      ...message._doc,
      text: cryptoJs.AES.decrypt(
        message.text,
        process.env.JWT_SECRETKEY_CRYPTOJS
      ).toString(cryptoJs.enc.Utf8),

      image: cryptoJs.AES.decrypt(
        message.image,
        process.env.JWT_SECRETKEY_CRYPTOJS
      ).toString(cryptoJs.enc.Utf8),
    }));

    res.status(200).json(decodeMessages);
  } catch (error) {
    console.log("error in getMessages Controller: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUsers = async (req, res) => {
  try {
    const myId = req.user._id.toString();

    const users = await User.find({ _id: { $ne: myId } });

    res.status(200).json(users);
  } catch (error) {
    console.log("error in getMessages Controller: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
