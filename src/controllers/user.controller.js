import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { generateToken } from "../lib/util.js";
import cloudinary from "../lib/cloudinary.js";

export const signup = async (req, res) => {
  const { fullname, email, password } = req.body;
  try {
    if (!fullname || !email || !password) {
      return res.status(422).json({ message: "Please fill all field" });
    }

    // check email
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      return res.status(400).json({ message: "Email has already exists" });
    }

    // check password
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "password must be at least 6 characters" });
    }

    // hash password
    const salt = 10;
    const hashPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullname,
      email: normalizedEmail,
      password: hashPassword,
    });

    await newUser.save();
    generateToken(newUser._id, res);
    const safeUser = newUser.toObject();
    delete safeUser.password;

    return res.status(201).json({ message: "Signup Successfully", user: safeUser });
  } catch (error) {
    console.log("error in signup contronller: ", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    // check field
    if (!email || !password) {
      return res.status(422).json({ message: "Please fill all field" });
    }
    // check email with database
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: "Email do not have in database" });
    }
    // check password with that email
    const isPassword = await bcrypt.compare(password, user.password);
    if (!isPassword) {
      return res.status(400).json({ message: "Wrong password." });
    }
    // create cookie
    generateToken(user._id, res);

    const safeUser = user.toObject();
    delete safeUser.password;
    return res.status(200).json({ message: "Login Successfully", user: safeUser });
  } catch (error) {
    console.log("error in login contronller: ", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = async (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0, httpOnly: true, secure: true, sameSite: "None" });
    return res.status(200).json({ message: "Logout Successfully" });
  } catch (error) {
    console.log("error in login contronller: ", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const check = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unthorized " });
    }
    const safeUser = user.toObject();
    delete safeUser.password;
    return res.status(200).json(safeUser);
  } catch (error) {
    console.log("error in check Controller: ", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilefic } = req.body;
    // console.log(profilefic);
    const user = req.user;
    const userId = user._id.toString();
    if (!profilefic) {
      return res.status(422).json({ message: "Profile image is required" });
    }
    const uploadResponse = await cloudinary.uploader.upload(profilefic);
    const imageUrl = uploadResponse.secure_url;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilefic: imageUrl },
      { new: true, runValidators: true }
    ).select("-password");

    res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.log("error in updateProfile Controller: ", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
