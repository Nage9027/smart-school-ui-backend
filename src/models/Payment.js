import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
    },
    admissionNumber: {
      type: String,
      required: true,
      ref: "Student",
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Student",
    },
    studentName: {
      type: String,
      required: true,
    },
    className: {
      type: String,
      required: true,
    },
    section: {
      type: String,
      required: true,
    },
    parentName: {
      type: String,
      required: true,
    },
    parentPhone: {
      type: String,
      required: true,
    },
    parentEmail: {
      type: String,
      default: null,
    },

    // Payment Details
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["cash", "cheque", "bank_transfer", "upi", "card", "online"],
      default: "cash",
    },
    referenceNo: {
      type: String,
      default: null,
    },
    transactionId: {
      type: String,
      default: null,
    },
    bankName: {
      type: String,
      default: null,
    },
    chequeNo: {
      type: String,
      default: null,
    },
    chequeDate: {
      type: Date,
      default: null,
    },
    utrNo: {
      type: String,
      default: null,
    },
    upiId: {
      type: String,
      default: null,
    },

    // Amount Details
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountReason: {
      type: String,
      default: null,
    },
    lateFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    lateFeeReason: {
      type: String,
      default: null,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Fee Breakdown
    feesPaid: [
      {
        feeType: String,
        amount: Number,
        dueDate: Date,
        description: String,
      },
    ],

    // Additional Info
    description: {
      type: String,
      default: null,
    },
    academicYear: {
      type: String,
      default: "2024-2025",
    },

    // Receipt Options
    sendReceipt: {
      type: Boolean,
      default: true,
    },
    sendSMS: {
      type: Boolean,
      default: true,
    },
    sendEmail: {
      type: Boolean,
      default: true,
    },
    printed: {
      type: Boolean,
      default: false,
    },

    // Status
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled", "refunded"],
      default: "completed",
    },

    // Audit Trail
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recordedByName: String,
  },
  { 
    timestamps: true,
    // This prevents Mongoose from setting empty strings
    minimize: false 
  }
);

// ABSOLUTELY NO PRE-SAVE MIDDLEWARE!
// Don't add any schema.pre() functions!

export default mongoose.model("Payment", paymentSchema);