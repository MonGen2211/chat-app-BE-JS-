import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: "" },

    members: [{ type: String, required: true, index: true }],
    admins: [{ type: String, default: [] }],
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

const Group = mongoose.model("Group", groupSchema);
export default Group;
