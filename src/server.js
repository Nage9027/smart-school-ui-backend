import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import historyRoutes from './routes/historyRoutes.js';

/* =========================
   ROUTES IMPORTS
========================= */
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import studentSelfRoutes from "./routes/studentSelfRoutes.js";
import financeRouter from "./routes/financeRoutes.js";
import collectionsRouter from "./routes/collectionsRouter.js";
import reportRoutes from './routes/reportRoutes.js';
import feeDefaultersRoutes from './routes/feeDefaultersRoutes.js';
import transportRoutes from "./routes/transportRoutes.js";
import settingRoutes from "./routes/settingRoutes.js"; // ADDED SETTINGS ROUTES

/* =========================
   ENV & DB CONFIG
========================= */
dotenv.config();
connectDB();

/* =========================
   APP INITIALIZATION
========================= */
const app = express();
const server = http.createServer(app);

/* =========================
   SOCKET.IO CONFIGURATION (for real-time transport updates)
========================= */
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:8081",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  },
  pingTimeout: 60000,
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  // Join vehicle room for real-time tracking
  socket.on("join-vehicle", (vehicleId) => {
    socket.join(`vehicle-${vehicleId}`);
    console.log(`🚗 Socket ${socket.id} joined vehicle-${vehicleId}`);
  });

  // ADDED: Join settings room for real-time settings updates
  socket.on("join-settings", (schoolId) => {
    socket.join(`settings-${schoolId}`);
    console.log(`⚙️ Socket ${socket.id} joined settings-${schoolId}`);
  });

  // Leave vehicle room
  socket.on("leave-vehicle", (vehicleId) => {
    socket.leave(`vehicle-${vehicleId}`);
  });

  // Join driver room
  socket.on("join-driver", (driverId) => {
    socket.join(`driver-${driverId}`);
  });

  // Handle location updates from vehicles
  socket.on("vehicle-location-update", (data) => {
    const { vehicleId, location } = data;
    // Broadcast to all clients tracking this vehicle
    io.to(`vehicle-${vehicleId}`).emit("location-update", {
      vehicleId,
      location,
      timestamp: new Date().toISOString(),
    });
  });

  // ADDED: Handle settings updates
  socket.on("settings-updated", (data) => {
    const { schoolId, category, changes } = data;
    // Broadcast to all clients monitoring settings
    io.to(`settings-${schoolId}`).emit("settings-changed", {
      category,
      changes,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle fuel updates
  socket.on("vehicle-fuel-update", (data) => {
    const { vehicleId, fuelLevel } = data;
    io.to(`vehicle-${vehicleId}`).emit("fuel-update", {
      vehicleId,
      fuelLevel,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle maintenance alerts
  socket.on("maintenance-alert", (data) => {
    const { vehicleId, issue, priority } = data;
    // Broadcast to admin dashboard
    io.emit("maintenance-notification", {
      vehicleId,
      issue,
      priority,
      timestamp: new Date().toISOString(),
    });
  });

  // ADDED: Handle backup progress
  socket.on("backup-progress", (data) => {
    const { schoolId, progress, status } = data;
    io.to(`settings-${schoolId}`).emit("backup-status", {
      progress,
      status,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// Make io accessible in routes
app.set("io", io);

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
app.use("/api/student", studentSelfRoutes);

// ==================== FINANCE MODULE ROUTES ====================
app.use("/api/finance", financeRouter);
app.use("/api/finance/collections", collectionsRouter);
app.use("/api/finance/fee-defaulters", feeDefaultersRoutes);

// ==================== TRANSPORT MODULE ROUTES ====================
app.use("/api/transport", transportRoutes);

// ==================== SETTINGS MODULE ROUTES ====================
app.use("/api/settings", settingRoutes); // ADDED SETTINGS ROUTES

// ==================== OTHER ROUTES ====================
app.use('/api/history', historyRoutes);
app.use('/api/reports', reportRoutes);

/* =========================
   HEALTH ROUTES
========================= */
app.get("/", (req, res) => {
  res.json({
    message: "Smart School Management System API",
    version: "1.0.0",
    modules: {
      auth: "active",
      admin: "active",
      finance: "active",
      transport: "active",
      settings: "active", // ADDED SETTINGS MODULE
      reports: "active",
      academics: "active"
    },
    socket: io.engine.clientsCount > 0 ? "connected" : "idle",
    documentation: "Check /api-docs for endpoint details"
  });
});

app.get("/health", (req, res) => {
  const healthCheck = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: "connected",
    socket: {
      connections: io.engine.clientsCount,
      status: "active"
    }
  };

  res.status(200).json(healthCheck);
});

// API Documentation endpoint
app.get("/api-docs", (req, res) => {
  res.json({
    message: "API Documentation",
    endpoints: {
      auth: {
        login: "POST /api/auth/login",
        register: "POST /api/auth/register",
        profile: "GET /api/auth/profile"
      },
      settings: { // ADDED SETTINGS DOCUMENTATION
        getAll: "GET /api/settings",
        getByCategory: "GET /api/settings/:category",
        updateSchool: "PUT /api/settings/school",
        updateAcademic: "PUT /api/settings/academic",
        updateNotifications: "PUT /api/settings/notifications",
        updateSecurity: "PUT /api/settings/security",
        updateBilling: "PUT /api/settings/billing",
        updateAdvanced: "PUT /api/settings/advanced",
        createBackup: "POST /api/settings/backup",
        exportData: "POST /api/settings/export",
        getHealth: "GET /api/settings/health"
      },
      transport: {
        vehicles: {
          getAll: "GET /api/transport/vehicles",
          getOne: "GET /api/transport/vehicles/:id",
          create: "POST /api/transport/vehicles",
          update: "PUT /api/transport/vehicles/:id",
          delete: "DELETE /api/transport/vehicles/:id",
          stats: "GET /api/transport/vehicles-stats"
        },
        drivers: {
          getAll: "GET /api/transport/drivers",
          create: "POST /api/transport/drivers",
          update: "PUT /api/transport/drivers/:id",
          stats: "GET /api/transport/drivers-stats"
        },
        routes: {
          getAll: "GET /api/transport/routes",
          create: "POST /api/transport/routes",
          stats: "GET /api/transport/routes-stats"
        },
        maintenance: {
          getAll: "GET /api/transport/maintenance",
          create: "POST /api/transport/maintenance",
          update: "PATCH /api/transport/maintenance/:id/status",
          stats: "GET /api/transport/maintenance-stats"
        },
        fuel: {
          getAll: "GET /api/transport/fuel-logs",
          create: "POST /api/transport/fuel-logs",
          stats: "GET /api/transport/fuel-stats"
        },
        dashboard: "GET /api/transport/dashboard-stats",
        reports: "POST /api/transport/reports/generate"
      },
      finance: {
        payments: "GET /api/finance",
        collections: "GET /api/finance/collections",
        feeDefaulters: "GET /api/finance/fee-defaulters"
      }
    }
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

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║  🚀 SMART SCHOOL MANAGEMENT SYSTEM                                      ║
║                                                                          ║
║  🌐 Server: http://localhost:${PORT}                                    ║
║  📅 Started: ${new Date().toLocaleString()}                             ║
║  📊 Environment: ${process.env.NODE_ENV || "development"}               ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  📡 ACTIVE MODULES:                                                     ║
║                                                                          ║
║  🔑  Auth:        http://localhost:${PORT}/api/auth                    ║
║  👨‍💼  Admin:       http://localhost:${PORT}/api/admin                  ║
║  💰  Finance:     http://localhost:${PORT}/api/finance                 ║
║  🚌  Transport:   http://localhost:${PORT}/api/transport               ║
║  ⚙️   Settings:    http://localhost:${PORT}/api/settings               ║
║  📊  Reports:     http://localhost:${PORT}/api/reports                 ║
║  📚  Academics:   http://localhost:${PORT}/api/admin/students          ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  ⚙️  SETTINGS MODULE ENDPOINTS:                                         ║
║                                                                          ║
║  • School Profile:    PUT /api/settings/school                          ║
║  • Academic:         PUT /api/settings/academic                        ║
║  • Notifications:    PUT /api/settings/notifications                   ║
║  • Security:         PUT /api/settings/security                        ║
║  • Billing:          PUT /api/settings/billing                         ║
║  • Advanced:         PUT /api/settings/advanced                        ║
║  • System Health:    GET /api/settings/health                          ║
║  • Backup:           POST /api/settings/backup                         ║
║  • Export:           POST /api/settings/export                         ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  🚌 TRANSPORT MODULE ENDPOINTS:                                         ║
║                                                                          ║
║  • Vehicles:       http://localhost:${PORT}/api/transport/vehicles      ║
║  • Drivers:        http://localhost:${PORT}/api/transport/drivers       ║
║  • Routes:         http://localhost:${PORT}/api/transport/routes        ║
║  • Maintenance:    http://localhost:${PORT}/api/transport/maintenance   ║
║  • Dashboard:      http://localhost:${PORT}/api/transport/dashboard-stats║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  📡 REAL-TIME FEATURES:                                                 ║
║                                                                          ║
║  • Socket.IO:      Vehicle & Settings tracking enabled                 ║
║  • Live Updates:   Location, fuel, maintenance, settings alerts        ║
║  • Health Check:   http://localhost:${PORT}/health                      ║
║  • API Docs:       http://localhost:${PORT}/api-docs                    ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down...");
  server.close(() => {
    process.exit(0);
  });
});

export { app, server, io };