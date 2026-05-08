import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  reason: { type: String, required: true }, // e.g., "Christmas"
  isAcademicHoliday: { type: Boolean, default: true } 
}, { timestamps: true });

export default mongoose.model("Holiday", holidaySchema);