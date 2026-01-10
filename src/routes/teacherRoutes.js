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

// All routes require authentication
router.use(protect);

// ===== PUBLIC ROUTES (for logged-in users) =====
router.get("/", getTeachers); // Anyone can view teachers
router.get("/:id", getTeacherById); // Anyone can view single teacher

// ===== ADMIN/OWNER ONLY ROUTES =====
router.post("/", authorize("admin", "owner"), createTeacher);
router.put("/:id", authorize("admin", "owner"), updateTeacher);
router.put("/:id/status", authorize("admin", "owner"), updateTeacherStatus);
router.put("/:id/assign-classes", authorize("admin", "owner"), assignClassesToTeacher);
router.delete("/:id", authorize("admin", "owner"), deleteTeacher);

export default router;