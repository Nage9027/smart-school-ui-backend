import express from "express";
import {
  createExam,
  getExams,
  submitExam,
  evaluateExam,
  getMyExams
} from "../controllers/examController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// create exam
router.post("/", protect, createExam);

// admin / teacher list exams
router.get("/", protect, getExams);

// ⭐ student get only their exams
router.get("/my-exams", protect, getMyExams);

// student submit exam
router.post("/:examId/submit", protect, submitExam);

// teacher evaluate exam
router.post("/:examId/evaluate", protect, evaluateExam);

export default router;
