import express from "express";

import {
  createTeacher,
  getTeachers,
  getTeacherById,
  updateTeacher,
  updateTeacherStatus,
  deleteTeacher,
  assignClassesToTeacher
} from "../controllers/teacherController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { authorize } from "../middlewares/roleMiddleware.js";

const router = express.Router();

/* =========================================================
   ADMIN / OWNER PROTECTED ROUTES
========================================================= */
router.use(protect, authorize("admin", "owner"));

/* =========================================================
   TEACHER CRUD
========================================================= */

// Create Teacher
router.post("/", createTeacher);

// Get All Teachers
router.get("/", getTeachers);

// Get Single Teacher By ID
router.get("/:id", getTeacherById);

// Update Teacher
router.put("/:id", updateTeacher);

// Update Teacher Status (Active / Inactive)
router.put("/:id/status", updateTeacherStatus);

// Soft Delete Teacher
router.delete("/:id", deleteTeacher);

/* =========================================================
   TEACHER CLASS ASSIGNMENT
========================================================= */

// Assign Classes to Teacher
router.put("/:id/assign-classes", assignClassesToTeacher);

export default router;
