import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({
  questionId: String,
  selectedOptions: [Number],
  textAnswer: String,
  codeAnswer: String,
  marksAwarded: Number
});

const submissionSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  status: {
    type: String,
    enum: ["in-progress", "submitted", "evaluated"],
    default: "submitted"
  },

  answers: [answerSchema],
  totalMarksObtained: Number,
  rank: Number
}, { timestamps: true });

export default mongoose.model("Submission", submissionSchema);
