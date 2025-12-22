import mongoose from "mongoose";

const SyllabusSchema = new mongoose.Schema(
  {
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
    chapters: [{ title: String, description: String }],
  },
  { timestamps: true }
);

const Syllabus = mongoose.model("Syllabus", SyllabusSchema);
export default Syllabus;
