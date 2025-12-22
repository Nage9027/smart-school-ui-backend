import express from "express";
import {
  createStudent,
  createBulkStudents, // <--- NEW: Import the new bulk controller function
  getStudents,
  getStudentById,
  updateStudent,
  updateStudentStatus,
  softDeleteStudent,
  getByAdmissionNumber
} from "../controllers/studentController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { authorize } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Apply global middleware for all student routes
router.use(protect, authorize("admin", "owner"));

// Primary CRUD Routes
router.get("/", getStudents);
router.post("/", createStudent); // Handles single student insert

// Bulk Insert Route (MUST use this endpoint for the array of students)
router.post("/bulk", createBulkStudents); // <--- NEW BULK ROUTE

// Specific Query and ID Routes
router.get("/by-admission/:admissionNumber", getByAdmissionNumber);

router.get("/:id", getStudentById);
router.put("/:id", updateStudent);
router.put("/:id/status", updateStudentStatus);
router.delete("/:id", softDeleteStudent);

export default router;