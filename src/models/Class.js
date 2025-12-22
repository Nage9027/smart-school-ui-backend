import mongoose from "mongoose";

const ClassSchema = new mongoose.Schema(
  {
    className: { type: String, required: true },
    sections: [{ type: String }],
  },
  { timestamps: true }
);

const ClassModel = mongoose.model("Class", ClassSchema);
export default ClassModel;
