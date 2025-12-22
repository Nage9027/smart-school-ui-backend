import mongoose from "mongoose";
import Teacher from "../models/Teacher.js";

/* =========================================================
   CREATE TEACHER (ADMIN / OWNER)
========================================================= */
export const createTeacher = async (req, res) => {
  try {
    const { employeeId, contact } = req.body;

    // Validate required fields
    if (!employeeId || !contact || !contact.email) {
      return res.status(400).json({
        message: "Employee ID and contact email are required"
      });
    }

    // Check for duplicates
    const exists = await Teacher.findOne({
      $or: [
        { employeeId },
        { "contact.email": contact.email }
      ]
    });

    if (exists) {
      return res.status(400).json({
        message: "Teacher with same Employee ID or Email already exists"
      });
    }

    // Create the Teacher
    // FIX: Using req.user._id to satisfy the 'createdBy' schema requirement
    const teacher = await Teacher.create({
      ...req.body,
      status: "active",
      createdBy: req.user._id 
    });

    res.status(201).json({
      message: "Teacher created successfully",
      teacher
    });

  } catch (error) {
    console.error("Create Teacher Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   GET ALL TEACHERS
========================================================= */
export const getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find({ status: { $ne: "deleted" } })
      .sort({ createdAt: -1 });

    res.status(200).json(teachers);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   GET TEACHER BY ID
========================================================= */
export const getTeacherById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid teacher ID" });
    }

    const teacher = await Teacher.findById(id);

    if (!teacher || teacher.status === "deleted") {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json(teacher);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   UPDATE TEACHER DETAILS
========================================================= */
export const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    const teacher = await Teacher.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({
      message: "Teacher updated successfully",
      teacher
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   UPDATE TEACHER STATUS (ACTIVE / INACTIVE)
========================================================= */
export const updateTeacherStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        message: "Status must be either 'active' or 'inactive'"
      });
    }

    const teacher = await Teacher.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({
      message: "Teacher status updated successfully",
      teacher
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   ASSIGN CLASSES TO TEACHER
========================================================= */
export const assignClassesToTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    // Handle input from frontend ({ assignedClasses: [...] }) OR raw array
    const classesData = req.body.assignedClasses || req.body;

    // Validation: Ensure it is an array
    if (!Array.isArray(classesData)) {
      return res.status(400).json({
        message: "Invalid payload: assignedClasses must be an array"
      });
    }

    // Update the 'assignedClasses' field in MongoDB
    const teacher = await Teacher.findByIdAndUpdate(
      id,
      { assignedClasses: classesData },
      { new: true, runValidators: true }
    );

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({
      message: "Classes assigned successfully",
      teacher
    });

  } catch (error) {
    console.error("Assign Classes Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   SOFT DELETE TEACHER
========================================================= */
export const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    const teacher = await Teacher.findByIdAndUpdate(
      id,
      { status: "deleted" },
      { new: true }
    );

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({
      message: "Teacher deleted successfully (soft delete)"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};