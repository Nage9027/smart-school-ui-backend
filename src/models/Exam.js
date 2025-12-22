import mongoose from "mongoose";

const ExamSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
    date: { type: Date },
  },
  { timestamps: true }
);

const Exam = mongoose.model("Exam", ExamSchema);
export default Exam;
