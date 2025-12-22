import express from 'express';
import { 
    markAttendance, 
    getAttendanceByClass, 
    getAttendanceSummary 
} from '../controllers/attendanceController.js';

// ✅ FIX 1: Import 'protect' from authMiddleware
import { protect } from '../middlewares/authMiddleware.js';

// ✅ FIX 2: Import 'authorize' from roleMiddleware (This is where it lives)
import { authorize } from '../middlewares/roleMiddleware.js';

const router = express.Router();

// Route: /api/admin/attendance/mark
router.post('/mark', protect, authorize('admin', 'owner'), markAttendance);

// Route: /api/admin/attendance/by-class
router.get('/by-class', protect, authorize('admin', 'owner'), getAttendanceByClass);

// Route: /api/admin/attendance/summary
router.get('/summary', protect, authorize('admin', 'owner'), getAttendanceSummary);

export default router;