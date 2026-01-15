import mongoose from "mongoose";

const feeStructureSchema = new mongoose.Schema(
  {
    admissionNumber: {
      type: String,
      required: true,
      unique: true,
      ref: "Student",
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Student",
    },
    studentName: String,
    className: String,
    section: String,

    academicYear: {
      type: String,
      required: true,
    },

    // Fee Components
    feeComponents: [
      {
        componentName: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        dueDate: Date,
        isMandatory: {
          type: Boolean,
          default: true,
        },
        isRecurring: {
          type: Boolean,
          default: false,
        },
        frequency: {
          type: String,
          enum: ["one-time", "monthly", "quarterly", "half-yearly", "yearly"],
          default: "one-time",
        },
        status: {
          type: String,
          enum: ["pending", "paid", "partial", "overdue"],
          default: "pending",
        },
        paidAmount: {
          type: Number,
          default: 0,
        },
      },
    ],

    // Transport
    transportOpted: {
      type: Boolean,
      default: false,
    },
    transportFee: {
      type: Number,
      default: 0,
    },

    // Total Calculations
    totalFee: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDue: {
      type: Number,
      min: 0,
    },

    // Discounts
    discountApplied: {
      type: Number,
      default: 0,
    },
    discountReason: String,

    // Payment Schedule
    paymentSchedule: [
      {
        installmentNo: Number,
        dueDate: Date,
        amount: Number,
        status: {
          type: String,
          enum: ["pending", "paid", "overdue"],
          default: "pending",
        },
        paidDate: Date,
        receiptNo: String,
      },
    ],

    // Status
    overallStatus: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Pre-save middleware to calculate totalDue
feeStructureSchema.pre("save", function (next) {
  this.totalDue = Math.max(0, this.totalFee - this.totalPaid - (this.discountApplied || 0));
  next();
});

export default mongoose.model("FeeStructure", feeStructureSchema);