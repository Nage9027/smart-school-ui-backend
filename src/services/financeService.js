import Payment from "../models/Payment.js";
import FeeStructure from "../models/FeeStructure.js";
import Receipt from "../models/Receipt.js";
import { convertToWords } from "../utils/numberToWords.js";

export class FinanceService {
  // Record payment with all details
  static async recordPayment(paymentData, user) {
    const {
      admissionNumber,
      studentId,
      paymentDate,
      paymentMethod,
      referenceNo,
      amount,
      discount = 0,
      discountReason = "",
      lateFee = 0,
      lateFeeReason = "",
      feesPaid = [],
      description = "",
      sendReceipt = true,
      sendSMS = true,
      sendEmail = true,
    } = paymentData;

    // Calculate net amount
    const netAmount = parseFloat(amount) - parseFloat(discount) + parseFloat(lateFee);

    const payment = await Payment.create({
      admissionNumber,
      studentId,
      paymentDate: paymentDate || new Date(),
      paymentMethod,
      referenceNo,
      amount: parseFloat(amount),
      discount: parseFloat(discount),
      discountReason,
      lateFee: parseFloat(lateFee),
      lateFeeReason,
      netAmount,
      feesPaid,
      description,
      sendReceipt,
      sendSMS,
      sendEmail,
      recordedBy: user._id,
      recordedByName: user.name || user.username,
    });

    // Update fee structure
    await this.updateFeeStructureAfterPayment(payment);

    // Generate receipt
    const receipt = await this.generateReceipt(payment);

    return { payment, receipt };
  }

  // Update fee structure after payment
  static async updateFeeStructureAfterPayment(payment) {
    const feeStructure = await FeeStructure.findOne({
      admissionNumber: payment.admissionNumber,
    });

    if (feeStructure) {
      feeStructure.totalPaid += payment.netAmount;

      // Update individual fee components if specified
      if (payment.feesPaid && payment.feesPaid.length > 0) {
        for (const paidFee of payment.feesPaid) {
          const component = feeStructure.feeComponents.find(
            (comp) => comp.componentName === paidFee.feeType
          );
          if (component) {
            component.paidAmount += paidFee.amount;
            if (component.paidAmount >= component.amount) {
              component.status = "paid";
            } else if (component.paidAmount > 0) {
              component.status = "partial";
            }
          }
        }
      }

      await feeStructure.save();
    }
  }

  // Generate receipt for payment
  static async generateReceipt(payment) {
    const amountInWords = convertToWords(payment.netAmount);

    const receipt = await Receipt.create({
      receiptNumber: payment.receiptNumber,
      paymentId: payment._id,
      studentDetails: {
        name: payment.studentName,
        admissionNumber: payment.admissionNumber,
        className: payment.className,
        section: payment.section,
        parentName: payment.parentName,
        parentPhone: payment.parentPhone,
        parentEmail: payment.parentEmail,
      },
      paymentDetails: {
        date: payment.paymentDate,
        method: payment.paymentMethod,
        reference: payment.referenceNo,
        bankName: payment.bankName,
        chequeNo: payment.chequeNo,
        transactionId: payment.transactionId,
      },
      amountDetails: {
        totalAmount: payment.amount,
        discount: payment.discount,
        discountReason: payment.discountReason,
        lateFee: payment.lateFee,
        lateFeeReason: payment.lateFeeReason,
        netAmount: payment.netAmount,
        amountInWords,
      },
      feesBreakdown: payment.feesPaid,
      schoolDetails: {
        name: "AI School ERP",
        address: "123 Education Street, Smart City, Karnataka 560001",
        phone: "+91 98765 43210",
        email: "accounts@aischoolerp.edu.in",
        principal: "Dr. S. Krishnan",
        registrationNo: "REG-EDU-2024-001",
        gstin: "29AAACI0000A1Z5",
      },
    });

    return receipt;
  }

  // Get payment summary for dashboard
  static async getDashboardSummary(startDate, endDate) {
    const matchStage = {
      status: "completed",
      paymentDate: {},
    };

    if (startDate) matchStage.paymentDate.$gte = new Date(startDate);
    if (endDate) matchStage.paymentDate.$lte = new Date(endDate);

    const summary = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$netAmount" },
          totalTransactions: { $sum: 1 },
          averageTransaction: { $avg: "$netAmount" },
          maxTransaction: { $max: "$netAmount" },
          minTransaction: { $min: "$netAmount" },
        },
      },
    ]);

    // Get payment method breakdown
    const methodBreakdown = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$paymentMethod",
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get class-wise collection
    const classBreakdown = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$className",
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      summary: summary[0] || {
        totalAmount: 0,
        totalTransactions: 0,
        averageTransaction: 0,
        maxTransaction: 0,
        minTransaction: 0,
      },
      methodBreakdown,
      classBreakdown,
    };
  }

  // Get fee defaulters
  static async getFeeDefaulters(minDue = 0, className = null) {
    const filter = {
      totalDue: { $gt: parseFloat(minDue) },
    };

    if (className) filter.className = className;

    const defaulters = await FeeStructure.find(filter)
      .sort("-totalDue")
      .limit(100);

    const summary = {
      totalDefaulters: defaulters.length,
      totalDue: defaulters.reduce((sum, defaulter) => sum + defaulter.totalDue, 0),
      averageDue: defaulters.length > 0 ? defaulters.reduce((sum, defaulter) => sum + defaulter.totalDue, 0) / defaulters.length : 0,
    };

    return { defaulters, summary };
  }
}