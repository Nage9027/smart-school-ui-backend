import express from "express";
import {
  searchStudents,
  getStudentFeeDetails,
  recordPayment,
  getPaymentByReceipt,
  getAllPayments,
  getPaymentSummary,
} from "../controllers/financeController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { authorize } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// ==================== STUDENT SEARCH & FEE DETAILS ====================
router.get(
  "/students/search",
  authorize("admin", "finance", "cashier", "owner"),
  searchStudents
);
router.get(
  "/students/:admissionNumber/fee-details",
  authorize("admin", "finance", "cashier", "owner"),
  getStudentFeeDetails
);

// ==================== PAYMENT ROUTES ====================
router.post(
  "/payments/record",
  authorize("admin", "finance", "cashier", "owner"),
  recordPayment
);
router.get(
  "/payments/receipt/:receiptNumber",
  authorize("admin", "finance", "cashier", "owner"),
  getPaymentByReceipt
);
router.get(
  "/payments",
  authorize("admin", "finance", "cashier", "owner"),
  getAllPayments
);
router.get(
  "/payments/summary",
  authorize("admin", "finance", "cashier", "owner"),
  getPaymentSummary
);

export default router;