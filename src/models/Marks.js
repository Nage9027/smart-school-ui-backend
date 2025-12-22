import mongoose from "mongoose";

const MarksSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
    marksObtained: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
  },
  { timestamps: true }
);

const Marks = mongoose.model("Marks", MarksSchema);
export default Marks;
