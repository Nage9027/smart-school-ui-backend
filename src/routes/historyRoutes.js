import express from 'express';
import {
  getPaymentHistory,
  getPaymentStatistics,
  exportPaymentHistory,
  getReceiptByNumber
} from '../controllers/historyController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Payment History Routes
router.get('/payments', protect, authorize('admin', 'finance'), getPaymentHistory);
router.get('/statistics', protect, authorize('admin', 'finance'), getPaymentStatistics);
router.get('/export', protect, authorize('admin', 'finance'), exportPaymentHistory);
router.get('/receipt/:receiptNumber', protect, authorize('admin', 'finance'), getReceiptByNumber);

export default router;