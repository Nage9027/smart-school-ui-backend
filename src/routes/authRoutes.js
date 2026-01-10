import express from "express";
import {
  login,
  register,
  changePassword
} from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/change-password", protect, changePassword);

export default router;
