import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    personal: {
      firstName: { type: String, required: true },
      lastName: { type: String },
      gender: { type: String, enum: ["Male", "Female", "Other"] },
      dob: { type: Date }
    },

    contact: {
      phone: { type: String, required: true },
      email: { type: String, required: true, unique: true }
    },

    professional: {
      department: { type: String, required: true },
      subjects: [{ type: String }],
      experienceYears: { type: Number, default: 0 },
      qualification: { type: String }
    },

    assignedClasses: [
      {
        className: String,
        section: String
      }
    ],

    attendance: {
      type: Number,
      default: 0
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("Teacher", teacherSchema);
