import express from 'express';
import {
  generateReport,
  getReportStatistics,
  getQuickCollectionReport,
  getQuickDefaulterReport,
  getRecentReports
} from '../controllers/reportController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Report Routes
router.post('/generate', protect, authorize('admin', 'finance'), generateReport);
router.get('/statistics', protect, authorize('admin', 'finance'), getReportStatistics);
router.get('/quick/collection', protect, authorize('admin', 'finance'), getQuickCollectionReport);
router.get('/quick/defaulters', protect, authorize('admin', 'finance'), getQuickDefaulterReport);
router.get('/recent', protect, authorize('admin', 'finance'), getRecentReports);

export default router;