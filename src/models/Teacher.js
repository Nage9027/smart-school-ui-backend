import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    personal: {
      firstName: { 
        type: String, 
        required: true,
        trim: true
      },
      lastName: { 
        type: String,
        trim: true
      },
      gender: { 
        type: String, 
        enum: ["Male", "Female", "Other"],
        default: "Male"
      },
      dob: { 
        type: Date 
      },
      address: {
        type: String,
        trim: true
      },
      emergencyContact: {
        type: String,
        trim: true
      },
      joiningDate: {
        type: Date,
        default: Date.now
      }
    },

    contact: {
      phone: { 
        type: String, 
        trim: true
      },
      email: { 
        type: String, 
        required: true,
        trim: true
      }
    },

    professional: {
      department: { 
        type: String, 
        required: true,
        trim: true
      },
      subjects: [{ 
        type: String,
        trim: true
      }],
      experienceYears: { 
        type: Number, 
        default: 0
      },
      qualification: { 
        type: String,
        trim: true
      }
    },

    assignedClasses: [
      {
        className: { 
          type: String,
          trim: true
        },
        section: { 
          type: String,
          trim: true
        }
      }
    ],

    attendance: {
      type: Number,
      default: 0
    },

    status: {
      type: String,
      enum: ["active", "inactive", "deleted"],
      default: "active"
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { 
    timestamps: true
  }
);

export default mongoose.model("Teacher", teacherSchema);