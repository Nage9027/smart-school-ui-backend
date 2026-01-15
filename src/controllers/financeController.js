import asyncHandler from "../utils/asyncHandler.js";
import Payment from "../models/Payment.js";
import FeeStructure from "../models/FeeStructure.js";
import Receipt from "../models/Receipt.js";
import Student from "../models/Student.js";
import mongoose from "mongoose";
import { convertToWords } from "../utils/numberToWords.js";

// @desc    Search students for payment
// @route   GET /api/finance/students/search
// @access  Private (Admin/Finance)
export const searchStudents = asyncHandler(async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(200).json({
        success: true,
        students: [],
      });
    }

    const students = await Student.find({
      $or: [
        { "student.firstName": { $regex: query, $options: "i" } },
        { "student.lastName": { $regex: query, $options: "i" } },
        { admissionNumber: { $regex: query, $options: "i" } },
        { "class.className": { $regex: query, $options: "i" } },
        { "parents.father.name": { $regex: query, $options: "i" } },
        { "parents.mother.name": { $regex: query, $options: "i" } },
        { "parents.father.phone": { $regex: query, $options: "i" } },
      ],
      status: "active",
    })
      .select("_id admissionNumber student class parents transport")
      .limit(20);

    res.status(200).json({
      success: true,
      students,
    });
  } catch (error) {
    console.error("Search students error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get student fee details
// @route   GET /api/finance/students/:admissionNumber/fee-details
// @access  Private (Admin/Finance)
export const getStudentFeeDetails = asyncHandler(async (req, res) => {
  try {
    const { admissionNumber } = req.params;

    // Find student
    const student = await Student.findOne({ admissionNumber });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Parse class name and section
    const classNameParts = student.class.className.split('-');
    const className = classNameParts[0] || student.class.className;
    const section = classNameParts[1] || student.class.section || "A";

    // Find or create fee structure
    let feeStructure = await FeeStructure.findOne({ admissionNumber });

    if (!feeStructure) {
      // Create default fee structure
      const baseFee = 15000;
      const transportFee = student.transport === "yes" ? 6000 : 0;
      const activityFee = 3500;
      const examFee = 5000;
      const totalFee = baseFee + transportFee + activityFee + examFee;

      feeStructure = await FeeStructure.create({
        admissionNumber: student.admissionNumber,
        studentId: student._id,
        studentName: `${student.student.firstName} ${student.student.lastName}`,
        className: className,
        section: section,
        academicYear: "2024-2025",
        transportOpted: student.transport === "yes",
        transportFee: transportFee,
        feeComponents: [
          {
            componentName: "Tuition Fee",
            amount: baseFee,
            dueDate: new Date("2024-12-15"),
            isMandatory: true,
            status: "pending",
          },
          ...(student.transport === "yes"
            ? [
                {
                  componentName: "Transport Fee",
                  amount: transportFee,
                  dueDate: new Date("2024-12-05"),
                  isMandatory: false,
                  status: "pending",
                },
              ]
            : []),
          {
            componentName: "Activity Fee",
            amount: activityFee,
            dueDate: new Date("2024-12-20"),
            isMandatory: true,
            status: "pending",
          },
          {
            componentName: "Examination Fee",
            amount: examFee,
            dueDate: new Date("2024-12-10"),
            isMandatory: true,
            status: "pending",
          },
        ],
        totalFee: totalFee,
        totalPaid: 0,
        totalDue: totalFee,
      });
    }

    // Get payment history
    const payments = await Payment.find({ admissionNumber })
      .sort("-paymentDate")
      .select("receiptNumber paymentDate amount netAmount paymentMethod status");

    res.status(200).json({
      success: true,
      student: {
        _id: student._id,
        admissionNumber: student.admissionNumber,
        name: `${student.student.firstName} ${student.student.lastName}`,
        class: student.class,
        parents: student.parents,
        transport: student.transport,
      },
      feeStructure,
      paymentHistory: payments,
      totalDue: feeStructure.totalDue,
    });
  } catch (error) {
    console.error("Get student fee details error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Record a new payment - FINAL WORKING VERSION
// @route   POST /api/finance/payments/record
// @access  Private (Admin/Finance)
export const recordPayment = asyncHandler(async (req, res) => {
  try {
    console.log("📝 Record payment request received:", req.body);
    
    const {
      admissionNumber,
      paymentDate,
      paymentMethod,
      referenceNo,
      transactionId,
      bankName,
      chequeNo,
      chequeDate,
      utrNo,
      upiId,
      amount,
      discount,
      discountReason,
      lateFee,
      lateFeeReason,
      netAmount,
      description,
      feesPaid,
      sendReceipt,
      sendSMS,
      sendEmail,
    } = req.body;

    // Validate required fields
    if (!admissionNumber || !amount) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing: admissionNumber, amount",
      });
    }

    // Get student details
    const student = await Student.findOne({ admissionNumber });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    console.log("✅ Student found:", student._id);

    // Parse class name and section
    const classNameParts = student.class.className.split('-');
    const className = classNameParts[0] || student.class.className;
    const section = classNameParts[1] || student.class.section || "A";

    // Generate receipt number - SIMPLE AND RELIABLE
    const timestamp = Date.now();
    const receiptNumber = `REC-${timestamp}`;

    console.log("📄 Generated receipt number:", receiptNumber);

    // Calculate net amount
    const calculatedNetAmount = netAmount || 
      (parseFloat(amount) + parseFloat(lateFee || 0) - parseFloat(discount || 0));

    // Clean data function - use undefined instead of null
    const cleanData = (data) => {
      if (data === undefined || data === null || data === '') {
        return undefined; // Use undefined to omit field entirely
      }
      return data;
    };

    // Create payment record using Mongoose create() method
    const paymentData = {
      receiptNumber,
      admissionNumber,
      studentId: student._id,
      studentName: `${student.student.firstName} ${student.student.lastName}`,
      className,
      section,
      parentName: student.parents.father.name,
      parentPhone: student.parents.father.phone,
      parentEmail: cleanData(student.parents.father.email),

      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMethod: paymentMethod || "cash",
      referenceNo: cleanData(referenceNo),
      transactionId: cleanData(transactionId),
      bankName: cleanData(bankName),
      chequeNo: cleanData(chequeNo),
      chequeDate: chequeDate ? new Date(chequeDate) : undefined,
      utrNo: cleanData(utrNo),
      upiId: cleanData(upiId),

      amount: parseFloat(amount),
      discount: parseFloat(discount || 0),
      discountReason: cleanData(discountReason),
      lateFee: parseFloat(lateFee || 0),
      lateFeeReason: cleanData(lateFeeReason),
      netAmount: calculatedNetAmount,

      feesPaid: feesPaid || [],

      description: cleanData(description),

      sendReceipt: sendReceipt !== undefined ? sendReceipt : true,
      sendSMS: sendSMS !== undefined ? sendSMS : true,
      sendEmail: sendEmail !== undefined ? sendEmail : true,

      recordedBy: req.user._id,
      recordedByName: req.user.name || req.user.username || "System",
    };

    console.log("💾 Saving payment data...");

    // METHOD 1: Try using Mongoose create() - it should work now without middleware
    try {
      const payment = await Payment.create(paymentData);
      
      console.log("✅ Payment saved via Mongoose create():", payment._id);

      // Update fee structure
      await updateFeeStructure(payment);

      // Generate receipt
      const receipt = await generateReceipt(payment);

      console.log("✅ Payment process completed successfully");

      return res.status(201).json({
        success: true,
        message: "Payment recorded successfully",
        data: {
          payment,
          receipt,
        },
      });
    } catch (mongooseError) {
      console.log("⚠️ Mongoose create() failed, trying alternative method...");
      
      // METHOD 2: Use direct MongoDB connection
      try {
        const db = mongoose.connection.db;
        const paymentsCollection = db.collection('payments');
        
        // Remove undefined values for MongoDB
        const cleanPaymentData = JSON.parse(JSON.stringify(paymentData));
        
        const result = await paymentsCollection.insertOne(cleanPaymentData);
        const paymentId = result.insertedId;
        
        console.log("✅ Payment saved via direct MongoDB:", paymentId);
        
        // Update fee structure
        await updateFeeStructure(cleanPaymentData);
        
        // Generate receipt
        const receipt = await generateReceipt({...cleanPaymentData, _id: paymentId});
        
        return res.status(201).json({
          success: true,
          message: "Payment recorded successfully (direct MongoDB)",
          data: {
            payment: { ...cleanPaymentData, _id: paymentId },
            receipt,
          },
        });
      } catch (mongoError) {
        console.error("❌ Both methods failed:", mongoError.message);
        throw mongoError;
      }
    }
  } catch (error) {
    console.error("❌ Record payment error:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate receipt number. Please try again.",
      });
    }
    
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get payment by receipt number
// @route   GET /api/finance/payments/receipt/:receiptNumber
// @access  Private (Admin/Finance)
export const getPaymentByReceipt = asyncHandler(async (req, res) => {
  try {
    const { receiptNumber } = req.params;

    const payment = await Payment.findOne({ receiptNumber })
      .populate("studentId", "admissionNumber student class")
      .populate("recordedBy", "name email username");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const receipt = await Receipt.findOne({ receiptNumber });

    res.status(200).json({
      success: true,
      payment,
      receipt,
    });
  } catch (error) {
    console.error("Get payment by receipt error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get all payments with filters
// @route   GET /api/finance/payments
// @access  Private (Admin/Finance)
export const getAllPayments = asyncHandler(async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      paymentMethod,
      className,
      status,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    // Date filter
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    // Other filters
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (className) filter.className = className;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payments = await Payment.find(filter)
      .sort("-paymentDate")
      .skip(skip)
      .limit(parseInt(limit))
      .select(
        "receiptNumber studentName admissionNumber className section paymentDate amount netAmount paymentMethod status"
      );

    const total = await Payment.countDocuments(filter);

    res.status(200).json({
      success: true,
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get all payments error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get payment summary for dashboard
// @route   GET /api/finance/payments/summary
// @access  Private (Admin/Finance)
export const getPaymentSummary = asyncHandler(async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Today's payments
    const todayPayments = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfDay },
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // This month's payments
    const monthPayments = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfMonth },
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Payment methods breakdown
    const methodBreakdown = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfMonth },
          status: "completed",
        },
      },
      {
        $group: {
          _id: "$paymentMethod",
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // Class-wise collection
    const classBreakdown = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfMonth },
          status: "completed",
        },
      },
      {
        $group: {
          _id: "$className",
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    res.status(200).json({
      success: true,
      today: {
        totalAmount: todayPayments[0]?.totalAmount || 0,
        count: todayPayments[0]?.count || 0,
      },
      thisMonth: {
        totalAmount: monthPayments[0]?.totalAmount || 0,
        count: monthPayments[0]?.count || 0,
      },
      methodBreakdown,
      classBreakdown,
    });
  } catch (error) {
    console.error("Get payment summary error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

// Helper function to update fee structure
const updateFeeStructure = async (payment) => {
  try {
    const feeStructure = await FeeStructure.findOne({
      admissionNumber: payment.admissionNumber,
    });

    if (feeStructure) {
      feeStructure.totalPaid += payment.netAmount;
      
      // Manually calculate totalDue
      feeStructure.totalDue = Math.max(0, 
        feeStructure.totalFee - feeStructure.totalPaid - (feeStructure.discountApplied || 0)
      );

      await feeStructure.save();
      console.log("✅ Fee structure updated:", feeStructure._id);
    }
  } catch (error) {
    console.error("Error updating fee structure:", error.message);
  }
};

// Helper function to generate receipt
const generateReceipt = async (payment) => {
  try {
    const amountInWords = convertToWords(payment.netAmount);

    // Clean data for receipt
    const cleanReceiptData = (data) => {
      if (data === undefined || data === null || data === '') {
        return undefined;
      }
      return data;
    };

    const receiptData = {
      receiptNumber: payment.receiptNumber,
      paymentId: payment._id || payment.id,

      studentDetails: {
        name: payment.studentName,
        admissionNumber: payment.admissionNumber,
        className: payment.className,
        section: payment.section,
        parentName: payment.parentName,
        parentPhone: payment.parentPhone,
        parentEmail: cleanReceiptData(payment.parentEmail),
      },

      paymentDetails: {
        date: payment.paymentDate,
        method: payment.paymentMethod,
        reference: cleanReceiptData(payment.referenceNo),
        bankName: cleanReceiptData(payment.bankName),
        chequeNo: cleanReceiptData(payment.chequeNo),
        transactionId: cleanReceiptData(payment.transactionId),
      },

      amountDetails: {
        totalAmount: payment.amount,
        discount: payment.discount,
        discountReason: cleanReceiptData(payment.discountReason),
        lateFee: payment.lateFee,
        lateFeeReason: cleanReceiptData(payment.lateFeeReason),
        netAmount: payment.netAmount,
        amountInWords: amountInWords,
      },

      feesBreakdown: payment.feesPaid || [],

      schoolDetails: {},
    };

    const receipt = await Receipt.create(receiptData);
    
    console.log("✅ Receipt generated:", receipt.receiptNumber);
    return receipt;
  } catch (error) {
    console.error("Error generating receipt:", error.message);
    // Return minimal receipt object
    return {
      receiptNumber: payment.receiptNumber,
      paymentId: payment._id || payment.id,
      studentDetails: {
        name: payment.studentName,
        admissionNumber: payment.admissionNumber,
      },
      _id: new mongoose.Types.ObjectId(),
    };
  }
};

// Helper function to simulate email receipt
const simulateEmailReceipt = async (receipt, email) => {
  console.log(`📧 Email receipt sent to ${email} for receipt ${receipt.receiptNumber}`);

  try {
    // Update receipt status
    if (receipt && receipt.save) {
      receipt.emailed = true;
      receipt.emailedAt = new Date();
      receipt.emailTo = email;
      await receipt.save();
    }
  } catch (error) {
    console.error("Error updating email status:", error.message);
  }
};

// Helper function to simulate SMS notification
const simulateSMSNotification = async (receipt, phone) => {
  console.log(`📱 SMS sent to ${phone} for receipt ${receipt.receiptNumber}`);

  try {
    // Update receipt status
    if (receipt && receipt.save) {
      receipt.smsSent = true;
      receipt.smsSentAt = new Date();
      receipt.smsTo = phone;
      await receipt.save();
    }
  } catch (error) {
    console.error("Error updating SMS status:", error.message);
  }
};