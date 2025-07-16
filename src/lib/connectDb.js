import mongoose from "mongoose";

const connectDb = async (req, res) => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log("kết nối database thành công");
  } catch (error) {
    console.log("kết nối database thất bại", error);
  }
};

export default connectDb;
