import mongoose from "mongoose";

const FeeStructureSchema = new mongoose.Schema(
  {
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
    amount: { type: Number, required: true },
    description: { type: String },
  },
  { timestamps: true }
);

const FeeStructure = mongoose.model("FeeStructure", FeeStructureSchema);
export default FeeStructure;
