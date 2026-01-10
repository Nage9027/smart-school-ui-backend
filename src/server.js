import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";

/* =========================
   ROUTES IMPORTS
========================= */
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import examRoutes from "./routes/examRoutes.js";

// 👇 NEW – student self profile route
import studentSelfRoutes from "./routes/studentSelfRoutes.js";

/* =========================
   ENV & DB CONFIG
========================= */
dotenv.config();
connectDB();

/* =========================
   APP INITIALIZATION
========================= */
const app = express();

/* =========================
   BODY PARSER
========================= */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* =========================
   CORS
========================= */
app.use(
  cors({
    origin: [
      "http://localhost:8081",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

/* =========================
   LOGGER
========================= */
app.use(morgan("dev"));

/* =========================
   API ROUTES
========================= */
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/students", studentRoutes);
app.use("/api/admin/teachers", teacherRoutes);
app.use("/api/admin/attendance", attendanceRoutes);
app.use("/api/exams", examRoutes);

// 👇 NEW — Student dashboard self API
app.use("/api/student", studentSelfRoutes);

/* =========================
   HEALTH ROUTES
========================= */
app.get("/", (req, res) => {
  res.send("API is running...");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is healthy and running",
  });
});

/* =========================
   GLOBAL ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
