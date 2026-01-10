import User from "../models/User.js";
import Student from "../models/Student.js";

export const getMyStudentProfile = async (req, res) => {
  try {
    // User from token
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access this endpoint",
      });
    }

    // find student (linked)
    const student =
      (await Student.findById(user.linkedId)) ||
      (await Student.findOne({ userId: user._id })) ||
      (await Student.findOne({ admissionNumber: user.username.toUpperCase() }));

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    // -----------------------------
    // NAME from your schema format
    // -----------------------------
    const fullName = `${student?.student?.firstName || ""} ${student?.student?.lastName || ""}`.trim();

    return res.status(200).json({
      success: true,
      message: "Student profile fetched successfully",

      data: {
        // BASIC
        userId: user._id,
        studentId: student._id,
        username: user.username,
        admissionNumber: student.admissionNumber,

        // STUDENT NAME
        name: fullName,

        // GENDER & DOB
        gender: student?.student?.gender,
        dob: student?.student?.dob,

        // CLASS DETAILS
        className: student?.class?.className,
        section: student?.class?.section,
        academicYear: student?.class?.academicYear,

        // PARENTS
        fatherName: student?.parents?.father?.name,
        motherName: student?.parents?.mother?.name,

        fatherPhone: student?.parents?.father?.phone,
        motherPhone: student?.parents?.mother?.phone,

        fatherEmail: student?.parents?.father?.email,
        motherEmail: student?.parents?.mother?.email,

        // ADDRESS
        address: {
          street: student?.address?.street,
          city: student?.address?.city,
          state: student?.address?.state,
          pincode: student?.address?.pincode,
        },

        // STATUS
        status: student?.status,
      },
    });
  } catch (error) {
    console.error("getMyStudentProfile error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching student profile",
    });
  }
};
