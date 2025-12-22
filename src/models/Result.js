import mongoose from "mongoose";

const ResultSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
    marks: [{ subjectId: String, marks: Number }],
    total: Number,
    grade: String,
  },
  { timestamps: true }
);

const Result = mongoose.model("Result", ResultSchema);
export default Result;
