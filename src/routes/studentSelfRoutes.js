import express from "express";
import { getMyStudentProfile } from "../controllers/studentSelfController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Student fetches their own profile
router.get("/me", protect, getMyStudentProfile);

export default router;
