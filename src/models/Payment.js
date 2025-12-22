import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["paid", "pending"], default: "pending" },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Payment = mongoose.model("Payment", PaymentSchema);
export default Payment;
