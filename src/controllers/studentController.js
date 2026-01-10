import Student from "../models/Student.js";
import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import mongoose from "mongoose";

const createStudentUser = async (student) => {
  try {
    const exists = await User.findOne({
      username: student.admissionNumber
    });

    if (!exists) {
      await User.create({
        name: `${student.student.firstName} ${student.student.lastName || ""}`,
        username: student.admissionNumber,
        password: "Student@123",
        role: "student",
        linkedId: student._id,
        forcePasswordChange: true,
        active: true
      });
    }
  } catch (error) {
    console.error("Student login creation failed:", error.message);
  }
};

export const createStudent = async (req, res) => {
  if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      message: "Invalid request body. Expected a single Student JSON object."
    });
  }

  try {
    const exists = await Student.findOne({
      admissionNumber: req.body.admissionNumber,
      status: { $ne: "deleted" }
    });

    if (exists) {
      return res.status(400).json({
        message: `Admission number '${req.body.admissionNumber}' already exists.`
      });
    }

    const student = await Student.create({
      ...req.body,
      status: "active",
      createdBy: req.user.id
    });

    await createStudentUser(student);

    res.status(201).json({
      success: true,
      message: "Student created successfully",
      student
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Student validation failed.",
        errors: Object.values(error.errors).map(v => v.message)
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        message: "Duplicate admission number."
      });
    }

    res.status(500).json({
      message: "Server error during student creation."
    });
  }
};

export const createBulkStudents = async (req, res) => {
  const studentsToInsert = req.body;

  if (!Array.isArray(studentsToInsert) || studentsToInsert.length === 0) {
    return res.status(400).json({
      message: "Invalid request body. Expected a non-empty array."
    });
  }

  const documentsWithDefaults = studentsToInsert.map(doc => ({
    ...doc,
    status: "active",
    createdBy: req.user.id
  }));

  try {
    const insertedStudents = await Student.insertMany(documentsWithDefaults, {
      ordered: true
    });

    for (const student of insertedStudents) {
      await createStudentUser(student);
    }

    res.status(201).json({
      success: true,
      message: "Students created successfully",
      count: insertedStudents.length
    });
  } catch (error) {
    res.status(400).json({
      message: "Bulk insert failed"
    });
  }
};

export const getStudents = async (req, res) => {
  try {
    const students = await Student.aggregate([
      { $match: { status: { $ne: "deleted" } } },
      {
        $lookup: {
          from: "attendances",
          localField: "_id",
          foreignField: "studentId",
          as: "attendanceRecords"
        }
      },
      {
        $addFields: {
          attendance: {
            $let: {
              vars: {
                totalSessions: { $multiply: [{ $size: "$attendanceRecords" }, 2] },
                presentCount: {
                  $sum: {
                    $map: {
                      input: "$attendanceRecords",
                      as: "rec",
                      in: {
                        $add: [
                          {
                            $cond: [
                              {
                                $or: [
                                  { $eq: ["$$rec.sessions.morning", true] },
                                  { $eq: ["$$rec.sessions.morning", "true"] }
                                ]
                              },
                              1,
                              0
                            ]
                          },
                          {
                            $cond: [
                              {
                                $or: [
                                  { $eq: ["$$rec.sessions.afternoon", true] },
                                  { $eq: ["$$rec.sessions.afternoon", "true"] }
                                ]
                              },
                              1,
                              0
                            ]
                          }
                        ]
                      }
                    }
                  }
                }
              },
              in: {
                $cond: [
                  { $eq: ["$$totalSessions", 0] },
                  0,
                  {
                    $round: [
                      {
                        $multiply: [
                          { $divide: ["$$presentCount", "$$totalSessions"] },
                          100
                        ]
                      },
                      0
                    ]
                  }
                ]
              }
            }
          }
        }
      },
      { $project: { attendanceRecords: 0 } },
      { $sort: { createdAt: -1 } }
    ]);

    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const student = await Student.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.params.id),
          status: { $ne: "deleted" }
        }
      },
      {
        $lookup: {
          from: "attendances",
          localField: "_id",
          foreignField: "studentId",
          as: "attendanceRecords"
        }
      },
      {
        $addFields: {
          attendance: {
            $let: {
              vars: {
                totalSessions: { $multiply: [{ $size: "$attendanceRecords" }, 2] },
                presentCount: {
                  $sum: {
                    $map: {
                      input: "$attendanceRecords",
                      as: "rec",
                      in: {
                        $add: [
                          {
                            $cond: [
                              {
                                $or: [
                                  { $eq: ["$$rec.sessions.morning", true] },
                                  { $eq: ["$$rec.sessions.morning", "true"] }
                                ]
                              },
                              1,
                              0
                            ]
                          },
                          {
                            $cond: [
                              {
                                $or: [
                                  { $eq: ["$$rec.sessions.afternoon", true] },
                                  { $eq: ["$$rec.sessions.afternoon", "true"] }
                                ]
                              },
                              1,
                              0
                            ]
                          }
                        ]
                      }
                    }
                  }
                }
              },
              in: {
                $cond: [
                  { $eq: ["$$totalSessions", 0] },
                  0,
                  {
                    $round: [
                      {
                        $multiply: [
                          { $divide: ["$$presentCount", "$$totalSessions"] },
                          100
                        ]
                      },
                      0
                    ]
                  }
                ]
              }
            }
          }
        }
      },
      { $project: { attendanceRecords: 0 } }
    ]);

    if (!student.length) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json(student[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getByAdmissionNumber = async (req, res) => {
  try {
    const student = await Student.aggregate([
      {
        $match: {
          admissionNumber: req.params.admissionNumber,
          status: { $ne: "deleted" }
        }
      },
      {
        $lookup: {
          from: "attendances",
          localField: "_id",
          foreignField: "studentId",
          as: "attendanceRecords"
        }
      },
      {
        $addFields: {
          attendance: {
            $let: {
              vars: {
                totalSessions: { $multiply: [{ $size: "$attendanceRecords" }, 2] },
                presentCount: {
                  $sum: {
                    $map: {
                      input: "$attendanceRecords",
                      as: "rec",
                      in: {
                        $add: [
                          {
                            $cond: [
                              {
                                $or: [
                                  { $eq: ["$$rec.sessions.morning", true] },
                                  { $eq: ["$$rec.sessions.morning", "true"] }
                                ]
                              },
                              1,
                              0
                            ]
                          },
                          {
                            $cond: [
                              {
                                $or: [
                                  { $eq: ["$$rec.sessions.afternoon", true] },
                                  { $eq: ["$$rec.sessions.afternoon", "true"] }
                                ]
                              },
                              1,
                              0
                            ]
                          }
                        ]
                      }
                    }
                  }
                }
              },
              in: {
                $cond: [
                  { $eq: ["$$totalSessions", 0] },
                  0,
                  {
                    $round: [
                      {
                        $multiply: [
                          { $divide: ["$$presentCount", "$$totalSessions"] },
                          100
                        ]
                      },
                      0
                    ]
                  }
                ]
              }
            }
          }
        }
      },
      { $project: { attendanceRecords: 0 } }
    ]);

    if (!student.length) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json(student[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateStudent = async (req, res) => {
  const updateData = { ...req.body };
  delete updateData.status;

  try {
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: "deleted" } },
      updateData,
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ message: "Student updated successfully", student });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateStudentStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        message: "Status must be 'active' or 'inactive'"
      });
    }

    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: "deleted" } },
      { status },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ message: "Student status updated successfully", student });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const softDeleteStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: "deleted" } },
      { status: "deleted" },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
