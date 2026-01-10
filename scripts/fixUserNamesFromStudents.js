import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";

import User from "../src/models/User.js";
import Student from "../src/models/Student.js";

// resolve paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// load .env from project root
dotenv.config({
  path: path.join(__dirname, "../.env"),
});

console.log("Using URI:", process.env.MONGO_URI);

async function run() {
  try {
    console.log("🚀 Connecting to database...");

    // Mongoose 7+ — no extra options
    await mongoose.connect(process.env.MONGO_URI);

    console.log("📚 Loading students...");
    const students = await Student.find();
    console.log(`🔍 Students found: ${students.length}`);

    let updated = 0;
    let skipped = 0;

    for (const s of students) {
      const user = await User.findOne({ linkedId: s._id });

      if (!user) {
        skipped++;
        continue;
      }

      const fullName = `${s?.student?.firstName || ""} ${s?.student?.lastName || ""}`.trim();

      if (!fullName) {
        skipped++;
        continue;
      }

      user.name = fullName;
      await user.save();

      updated++;
      console.log(`✅ ${user.username} → ${fullName}`);
    }

    console.log("\n🎉 DONE");
    console.log("✔️ Users updated:", updated);
    console.log("⏭️ Skipped:", skipped);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("🔥 Fatal script error:", err);
    process.exit(1);
  }
}

run();
