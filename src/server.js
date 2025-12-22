import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";

/* =========================
   ROUTE IMPORTS
========================= */
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";

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
   MIDDLEWARE: BODY PARSER
========================= */
// Increased limit to handle image uploads if necessary
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* =========================
   MIDDLEWARE: CORS (CRITICAL FIX)
========================= */
app.use(
  cors({
    origin: [
      "http://localhost:8081", // Your current frontend port
      "http://localhost:5173", // Standard Vite port (just in case)
      "http://localhost:3000", // Standard React port
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Allows cookies/headers to be sent
  })
);

/* =========================
   MIDDLEWARE: LOGGING
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

/* =========================
   HEALTH CHECK ROUTE
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
  console.error(`❌ Error Stack: ${err.stack}`);
  console.error(`❌ Error Message: ${err.message}`);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});