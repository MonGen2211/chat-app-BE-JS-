import { getReceiverSocketId, io } from "../lib/socket.js";
import Group from "../models/group.model.js";
import cryptoJS from "crypto-js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
export const createGroup = async (req, res) => {
  try {
    const myId = req.user._id.toString();
    const { member_ids, name, avatar } = req.body;
    if (!name?.trim() || !Array.isArray(member_ids)) {
      return res.status(422).json({ message: "Group name and member_ids are required" });
    }

    const newGroup = new Group({
      name,
      avatar,
      members: member_ids,
      admins: myId,
      createdBy: myId,
    });

    await newGroup.save();

    const receivers = Array.from(new Set([...newGroup.members, ...newGroup.admins]));
    receivers.forEach((userId) => {
      const sid = getReceiverSocketId(userId);
      if (sid) io.to(sid).emit("newGroup", newGroup);
    });

    res
      .status(200)
      .json({ message: "createGroup Successfully", data: newGroup });
  } catch (error) {
    console.log("Error in createGroup controller: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getGroup = async (req, res) => {
  try {
    const myId = req.user._id.toString();
    const groups = await Group.find({
      $or: [{ createdBy: myId }, { admins: myId }, { members: myId }],
    }).lean();
    res
      .status(200)
      .json({ message: "get Group Successfully", data: groups });
  } catch (error) {
    console.log("Error in getGroup controller: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const sendMessageGroup = async (req, res) => {
	try {
		const { text, image } = req.body;
		const groupId = req.params.id;
		const senderId = req.user._id.toString();
		const group = await Group.findById(groupId);
		if (!group || (!group.members.includes(senderId) && !group.admins.includes(senderId) && group.createdBy !== senderId)) {
			return res.status(403).json({ message: "You are not a member of this group" });
		}
		if (!text && !image) {
			return res.status(422).json({ message: "Message text or image is required" });
		}

		let hashText = "";
		let hashImage = "";
		let imageUrl = "";
		if (text) {
			hashText = cryptoJS.AES.encrypt(
				text,
				process.env.JWT_SECRETKEY_CRYPTOJS,
			).toString();
		}

		if (image) {
			const uploadResponse = await cloudinary.uploader.upload(image);
			imageUrl = uploadResponse.secure_url;
			hashImage = cryptoJS.AES.encrypt(
				imageUrl,
				process.env.JWT_SECRETKEY_CRYPTOJS,
			).toString();
		}

		let newMessage = new Message({
			senderId,
			groupId,
			chatType: "group",
			text: hashText || "",
			image: hashImage || "",
		});

		await newMessage.save();

		newMessage.text = text || "";
		newMessage.image = imageUrl;

    io.to(groupId).emit("newMessage", newMessage);

		res.status(200).json({ message: "SendMessage Successfully", newMessage });
	} catch (error) {
		console.log("Error in sendMessage controller: ", error);
		res.status(500).json({ message: "Internal Server Error" });
	}
};

export const getMessageGroup = async (req, res) => {
	try {
		const groupId = req.params.id;
		const senderId = req.user._id.toString();
		const group = await Group.findById(groupId);
		if (!group || (!group.members.includes(senderId) && !group.admins.includes(senderId) && group.createdBy !== senderId)) {
			return res.status(403).json({ message: "You are not a member of this group" });
		}

		const messages = await Message.find({
				groupId,
				softDeletedAt: null,
		}).sort({ createdAt: 1 });
		const decodeMessages = messages.map((message) => {
			const data = message.toObject();
			if (data.type === "call") return data;
			return {
				...data,
				text: cryptoJS.AES.decrypt(data.text, process.env.JWT_SECRETKEY_CRYPTOJS).toString(cryptoJS.enc.Utf8),
				image: cryptoJS.AES.decrypt(data.image, process.env.JWT_SECRETKEY_CRYPTOJS).toString(cryptoJS.enc.Utf8),
			};
		});

		res.status(200).json(decodeMessages);
	} catch (error) {
		console.log("error in getMessages Controller: ", error);
		res.status(500).json({ message: "Internal Server Error" });
	}
};
