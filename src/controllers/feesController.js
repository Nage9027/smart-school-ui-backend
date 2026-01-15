import asyncHandler from "../utils/asyncHandler.js";
import Payment from "../models/Payment.js";
import FeeStructure from "../models/FeeStructure.js";
import Receipt from "../models/Receipt.js";
import Student from "../models/Student.js";
import { convertToWords } from "../utils/numberToWords.js";mo
// @desc    Get all fee structures
// @route   GET /api/finance/fees/structures
// @access  Private (Admin/Finance)
export const getAllFeeStructures = asyncHandler(async (req, res) => {
  try {
    const { className, status, page = 1, limit = 20 } = req.query;

    const filter = {};

    if (className) filter.className = className;
    if (status) filter.overallStatus = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const feeStructures = await FeeStructure.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort("className")
      .select("admissionNumber studentName className section totalFee totalPaid totalDue overallStatus");

    const total = await FeeStructure.countDocuments(filter);

    res.status(200).json({
      success: true,
      feeStructures,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get fee defaulters (students with pending dues)
// @route   GET /api/finance/fees/defaulters
// @access  Private (Admin/Finance)
export const getFeeDefaulters = asyncHandler(async (req, res) => {
  try {
    const { minDue = 0, className } = req.query;

    const filter = {
      totalDue: { $gt: parseFloat(minDue) },
    };

    if (className) filter.className = className;

    const defaulters = await FeeStructure.find(filter)
      .sort("-totalDue")
      .select("admissionNumber studentName className section totalFee totalPaid totalDue")
      .limit(100);

    // Calculate summary
    const totalDue = defaulters.reduce((sum, defaulter) => sum + defaulter.totalDue, 0);
    const totalFee = defaulters.reduce((sum, defaulter) => sum + defaulter.totalFee, 0);
    const totalPaid = defaulters.reduce((sum, defaulter) => sum + defaulter.totalPaid, 0);

    res.status(200).json({
      success: true,
      defaulters,
      summary: {
        totalDefaulters: defaulters.length,
        totalDue,
        totalFee,
        totalPaid,
        averageDue: defaulters.length > 0 ? totalDue / defaulters.length : 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Update fee structure for a student
// @route   PUT /api/finance/fees/structures/:admissionNumber
// @access  Private (Admin/Finance)
export const updateFeeStructureForStudent = asyncHandler(async (req, res) => {
  try {
    const { admissionNumber } = req.params;
    const { feeComponents, discountApplied, discountReason } = req.body;

    const feeStructure = await FeeStructure.findOne({ admissionNumber });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: "Fee structure not found",
      });
    }

    // Update fee components if provided
    if (feeComponents && Array.isArray(feeComponents)) {
      feeStructure.feeComponents = feeComponents;
    }

    // Update discount if provided
    if (discountApplied !== undefined) {
      feeStructure.discountApplied = parseFloat(discountApplied);
    }

    if (discountReason !== undefined) {
      feeStructure.discountReason = discountReason;
    }

    // Recalculate total fee
    feeStructure.totalFee = feeStructure.feeComponents.reduce(
      (sum, component) => sum + component.amount,
      0
    );

    // Add transport fee if opted
    if (feeStructure.transportOpted) {
      feeStructure.totalFee += feeStructure.transportFee;
    }

    await feeStructure.save();

    res.status(200).json({
      success: true,
      message: "Fee structure updated successfully",
      feeStructure,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Create fee structure for multiple students (bulk)
// @route   POST /api/finance/fees/structures/bulk
// @access  Private (Admin/Finance)
export const createBulkFeeStructures = asyncHandler(async (req, res) => {
  try {
    const { students, academicYear, feeTemplate } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Students array is required",
      });
    }

    const feeStructures = [];
    const errors = [];

    for (const studentData of students) {
      try {
        const student = await Student.findOne({
          admissionNumber: studentData.admissionNumber,
          status: "active",
        });

        if (student) {
          // Check if fee structure already exists
          const existing = await FeeStructure.findOne({
            admissionNumber: student.admissionNumber,
          });

          if (!existing) {
            const baseFee = feeTemplate?.baseFee || 15000;
            const transportFee = student.transport === "yes" ? (feeTemplate?.transportFee || 6000) : 0;
            const activityFee = feeTemplate?.activityFee || 3500;
            const examFee = feeTemplate?.examFee || 5000;
            const totalFee = baseFee + transportFee + activityFee + examFee;

            const feeStructure = await FeeStructure.create({
              admissionNumber: student.admissionNumber,
              studentId: student._id,
              studentName: `${student.student.firstName} ${student.student.lastName}`,
              className: student.class.className,
              section: student.class.section,
              academicYear: academicYear || "2024-2025",
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

            feeStructures.push(feeStructure);
          }
        }
      } catch (error) {
        errors.push({
          admissionNumber: studentData.admissionNumber,
          error: error.message,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Fee structures created successfully",
      count: feeStructures.length,
      feeStructures,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get fee collection report
// @route   GET /api/finance/fees/reports/collection
// @access  Private (Admin/Finance)
export const getFeeCollectionReport = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    const matchStage = {
      status: "completed",
    };

    if (startDate || endDate) {
      matchStage.paymentDate = {};
      if (startDate) matchStage.paymentDate.$gte = new Date(startDate);
      if (endDate) matchStage.paymentDate.$lte = new Date(endDate);
    }

    let groupStage;
    if (groupBy === "day") {
      groupStage = {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" } },
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      };
    } else if (groupBy === "month") {
      groupStage = {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$paymentDate" } },
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      };
    } else if (groupBy === "class") {
      groupStage = {
        $group: {
          _id: "$className",
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      };
    } else {
      groupStage = {
        $group: {
          _id: "$paymentMethod",
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      };
    }

    const collectionReport = await Payment.aggregate([
      { $match: matchStage },
      groupStage,
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      collectionReport,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get fee summary for dashboard
// @route   GET /api/finance/fees/summary
// @access  Private (Admin/Finance)
export const getFeeSummary = asyncHandler(async (req, res) => {
  try {
    // Total fee collection
    const totalCollection = await Payment.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$netAmount" },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    // Total pending dues
    const pendingDues = await FeeStructure.aggregate([
      {
        $group: {
          _id: null,
          totalDue: { $sum: "$totalDue" },
          totalStudents: { $sum: 1 },
        },
      },
    ]);

    // Class-wise collection this month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const classWiseCollection = await Payment.aggregate([
      {
        $match: {
          status: "completed",
          paymentDate: { $gte: startOfMonth },
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
      summary: {
        totalCollection: totalCollection[0]?.totalAmount || 0,
        totalTransactions: totalCollection[0]?.totalTransactions || 0,
        totalPendingDues: pendingDues[0]?.totalDue || 0,
        totalStudentsWithDues: pendingDues[0]?.totalStudents || 0,
      },
      classWiseCollection,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});