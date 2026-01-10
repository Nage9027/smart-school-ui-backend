import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  type: { type: String, required: true },
  text: String,
  marks: Number,
  negativeMarks: Number,
  difficulty: String,
  options: [String],
  correctAnswers: [Number],
  correctAnswer: mongoose.Schema.Types.Mixed,
  image: String,
  explanation: String,
  timeLimit: Number
});

const subjectGroupSchema = new mongoose.Schema({
  subjectName: String,
  totalMarks: Number,
  passingMarks: Number,
  questions: [questionSchema]
});

const classTargetSchema = new mongoose.Schema({
  className: String,
  sections: [String],
  totalStudents: Number
});

const examSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    // ⭐ NEW — SIMPLE FILTER FIELDS FOR STUDENTS ⭐
    className: { type: String },     // <-- important
    section: { type: String },       // <-- important

    subject: String,
    description: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    pattern: String,

    status: {
      type: String,
      enum: ["draft", "scheduled", "live", "completed", "archived"],
      default: "scheduled"
    },

    date: String,
    examDate: Date,
    startTime: String,
    endTime: String,
    duration: Number,
    durationMinutes: Number,

    // ⭐ ADVANCED MULTI-CLASS SUPPORT (kept)
    classTargets: [classTargetSchema],
    subjectGroups: [subjectGroupSchema],

    shuffleQuestions: Boolean,
    shuffleOptions: Boolean,
    allowReview: Boolean,
    showMarksImmediately: Boolean,
    proctoringMode: String,
    maxAttempts: Number,

    instructions: [String]
  },
  {
    timestamps: true
  }
);

export default mongoose.model("Exam", examSchema);
