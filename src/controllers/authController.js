import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/User.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs"; // Import bcrypt for manual comparison

/* =========================
   GENERATE JWT TOKEN
========================= */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      linkedId: user.linkedId || null
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

/* =========================
   REGISTER
========================= */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({
      success: false,
      message: "All fields are required"
    });
  }

  // Validate role
  if (!["admin", "owner", "teacher", "parent"].includes(role)) {
    return res.status(400).json({
      success: false,
      message: "Invalid role for registration"
    });
  }

  // Check for existing user
  const existingUser = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { username: email.toLowerCase() }]
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: "User already exists"
    });
  }

  // Create user (password will be auto-hashed by pre-save middleware)
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    username: email.toLowerCase().trim(),
    password: password,
    role: role.toLowerCase(),
    phone: phone || "",
    active: true,
    forcePasswordChange: role !== "admin" // Admin doesn't need to change password
  });

  const token = generateToken(user);

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    token,
    role: user.role,
    name: user.name,
    forcePasswordChange: user.forcePasswordChange
  });
});

/* =========================
   LOGIN
========================= */
export const login = asyncHandler(async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({
      success: false,
      message: "Username, password and role are required"
    });
  }

  // Find user by username/email and role
  const user = await User.findOne({
    role: role.toLowerCase(),
    active: true,
    $or: [
      { username: username.trim().toLowerCase() },
      { email: username.trim().toLowerCase() }
    ]
  });

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials"
    });
  }

  // Check password - using bcrypt directly in case matchPassword method fails
  let isMatch;
  try {
    // Try the instance method first
    if (typeof user.matchPassword === 'function') {
      isMatch = await user.matchPassword(password);
    } else {
      // Fallback: use bcrypt directly
      isMatch = await bcrypt.compare(password, user.password);
    }
  } catch (error) {
    console.error("Password check error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error"
    });
  }

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials"
    });
  }

  // Fetch additional role-specific data
  let additionalData = {};
  
  if (role.toLowerCase() === 'teacher') {
    const teacherProfile = await Teacher.findOne({ 
      $or: [
        { "contact.email": username.trim().toLowerCase() },
        { user: user._id }
      ] 
    }).lean();
    
    if (teacherProfile) {
      additionalData.assignedClasses = teacherProfile.assignedClasses || [];
      additionalData.teacherId = teacherProfile._id;
    }
  }

  if (role.toLowerCase() === 'parent') {
    const children = await Student.find({ 
      "parentInfo.email": username.trim().toLowerCase(),
      status: { $ne: "deleted" }
    }).lean();
    
    additionalData.children = children.map(child => ({
      id: child._id,
      name: `${child.personal?.firstName || ''} ${child.personal?.lastName || ''}`.trim(),
      class: child.academic?.class || '',
      section: child.academic?.section || ''
    }));
  }

  // Generate token
  const token = generateToken(user);

  res.status(200).json({
    success: true,
    token,
    role: user.role,
    name: user.name,
    userId: user._id,
    linkedId: user.linkedId,
    forcePasswordChange: user.forcePasswordChange,
    ...additionalData
  });
});

/* =========================
   CHANGE PASSWORD
========================= */
export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Old password and new password are required"
    });
  }

  // Find user
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  // Check old password
  let isMatch;
  try {
    if (typeof user.matchPassword === 'function') {
      isMatch = await user.matchPassword(oldPassword);
    } else {
      isMatch = await bcrypt.compare(oldPassword, user.password);
    }
  } catch (error) {
    console.error("Password check error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error"
    });
  }

  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: "Old password is incorrect"
    });
  }

  // Update password
  user.password = newPassword;
  user.forcePasswordChange = false;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password updated successfully"
  });
});

/* =========================
   FORGOT PASSWORD (Optional)
========================= */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required"
    });
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
    active: true
  });

  if (!user) {
    // Return generic message for security
    return res.status(200).json({
      success: true,
      message: "If an account exists, a password reset link will be sent"
    });
  }

  // Generate reset token (simple version)
  const resetToken = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET + user.password,
    { expiresIn: '15m' }
  );

  // In a real app, you would send an email here
  // For now, return the token (in development only)
  if (process.env.NODE_ENV === 'development') {
    return res.status(200).json({
      success: true,
      message: "Password reset initiated",
      resetToken: resetToken,
      userId: user._id
    });
  }

  res.status(200).json({
    success: true,
    message: "Password reset instructions sent to your email"
  });
});