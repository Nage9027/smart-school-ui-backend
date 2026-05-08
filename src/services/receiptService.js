import Receipt from "../models/Receipt.js";
import { generateReceiptHTML } from "../utils/receiptGenerator.js";

export class ReceiptService {
  // Get receipt by number
  static async getReceipt(receiptNumber) {
    return await Receipt.findOne({ receiptNumber });
  }

  // Generate receipt HTML for printing
  static async generateReceiptHTML(receiptNumber) {
    const receipt = await Receipt.findOne({ receiptNumber });
    if (!receipt) {
      throw new Error("Receipt not found");
    }

    // Get associated payment
    const Payment = (await import("../models/Payment.js")).default;
    const payment = await Payment.findOne({ receiptNumber });

    return generateReceiptHTML(payment, receipt);
  }

  // Mark receipt as printed
  static async markAsPrinted(receiptNumber, userId) {
    return await Receipt.findOneAndUpdate(
      { receiptNumber },
      {
        printed: true,
        printedAt: new Date(),
        printedBy: userId,
      },
      { new: true }
    );
  }

  // Send receipt via email (simulated)
  static async sendEmailReceipt(receiptNumber, email) {
    const receipt = await Receipt.findOneAndUpdate(
      { receiptNumber },
      {
        emailed: true,
        emailedAt: new Date(),
        emailTo: email,
      },
      { new: true }
    );

    console.log(`📧 Simulated email sent to ${email} for receipt ${receiptNumber}`);
    return receipt;
  }

  // Send receipt via SMS (simulated)
  static async sendSMSReceipt(receiptNumber, phone) {
    const receipt = await Receipt.findOneAndUpdate(
      { receiptNumber },
      {
        smsSent: true,
        smsSentAt: new Date(),
        smsTo: phone,
      },
      { new: true }
    );

    console.log(`📱 Simulated SMS sent to ${phone} for receipt ${receiptNumber}`);
    return receipt;
  }

  // Get all receipts with filters
  static async getAllReceipts(filters = {}, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const receipts = await Receipt.find(filters)
      .skip(skip)
      .limit(limit)
      .sort("-createdAt");

    const total = await Receipt.countDocuments(filters);

    return {
      receipts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}