import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import dotenv from "dotenv";

// load env
dotenv.config();

// === IMPORT YOUR MODELS ===
import Student from "../src/models/Student.js";
import User from "../src/models/User.js";
import connectDB from "../src/config/db.js";

await connectDB();

const DEFAULT_PASSWORD = "student@123";

const migrate = async () => {
  console.log("🚀 Student → User migration started...");

  const students = await Student.find();

  console.log(`📚 Total students found: ${students.length}`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const s of students) {
    try {
      // If already linked, skip
      if (s.userId) {
        skippedCount++;
        continue;
      }

      // ---------- NAME FIX ----------
      const fullName =
        `${s?.personal?.firstName || ""} ${s?.personal?.lastName || ""}`.trim() ||
        `Student ${s._id.toString().slice(-6)}`;

      // ---------- EMAIL FIX ----------
      const email =
        s?.contact?.email ||
        `student_${s._id.toString().slice(-6)}@school.local`;

      // ---------- USERNAME AUTO GENERATE ----------
      const username =
        s?.admissionNumber ||
        s?.rollNumber ||
        `STD-${s._id.toString().slice(-6)}`;

      // does user already exist?
      let existingUser = await User.findOne({ $or: [{ email }, { username }] });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        existingUser = await User.create({
          name: fullName,
          username: username,
          email: email,
          phone: s?.contact?.phone || "0000000000",
          role: "student",
          password: hashedPassword,
          active: true,
          forcePasswordChange: true,
          linkedId: s._id
        });

        createdCount++;
        console.log(`✅ Created user: ${fullName} (${username})`);
      } else {
        console.log(`ℹ️ Existing user mapped for ${email}`);
      }

      // link user back to student
      s.userId = existingUser._id;
      await s.save();
    } catch (err) {
      console.error(`❌ Error migrating student ${s._id}: ${err.message}`);
    }
  }

  console.log("🎉 Migration Completed");
  console.log(`👤 Users created: ${createdCount}`);
  console.log(`⏭️ Skipped (already linked): ${skippedCount}`);

  process.exit();
};

migrate();
