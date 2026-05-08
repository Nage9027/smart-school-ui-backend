import mongoose from "mongoose";
import Student from "../src/models/Student.js";
import User from "../src/models/User.js";

const MONGO_URI = "mongodb://127.0.0.1:27017/school_erp";

async function createStudentUsers() {
  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected");

  const students = await Student.find({ status: "active" });

  console.log(`Found ${students.length} students`);

  let created = 0;
  let skipped = 0;

  for (const student of students) {
    const admissionNumber = student.admissionNumber;

    const existingUser = await User.findOne({
      username: admissionNumber,
      role: "student",
    });

    if (existingUser) {
      skipped++;
      continue;
    }

    await User.create({
      name: `${student.student.firstName} ${student.student.lastName || ""}`,
      username: admissionNumber,
      password: "Student@123",
      role: "student",
      linkedId: student._id,
      forcePasswordChange: true,
      active: true,
    });

    created++;
  }

  console.log("=================================");
  console.log(`Users created: ${created}`);
  console.log(`Users skipped (already exist): ${skipped}`);
  console.log("=================================");

  process.exit();
}

createStudentUsers();
