import asyncHandler from '../middleware/asyncHandler.js';
import userService from '../services/userService.js';

// @desc    Get all users (admin only)
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  // req.query is validated and cleaned by Joi middleware already
  const result = await userService.getUsers(req.query);
  
  res.status(200).json({
    success: true,
    data: result,
    message: 'Users retrieved successfully.'
  });
});

// @desc    Create a new user (admin only)
// @route   POST /api/admin/user
// @access  Private/Admin
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  
  const newUser = await userService.createUser({ name, email, password, role, phone });
  
  res.status(201).json({
    success: true,
    data: newUser,
    message: `User created successfully with role ${role}.`
  });
});

// @desc    Update user details (admin only)
// @route   PUT /api/admin/user/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  // req.body is validated and cleaned by Joi middleware already
  const updateData = req.body;

  const updatedUser = await userService.updateUser(userId, updateData);

  res.status(200).json({
    success: true,
    data: updatedUser,
    message: 'User updated successfully.'
  });
});

// @desc    Soft delete user (set active=false) (admin only)
// @route   DELETE /api/admin/user/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  const deletedUser = await userService.deleteUser(userId);

  res.status(200).json({
    success: true,
    data: deletedUser,
    message: `User ${deletedUser.email} deactivated successfully.`
  });
});

// @desc    Change user role (admin only)
// @route   PUT /api/admin/user/role/:id
// @access  Private/Admin
const changeUserRole = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const { role: newRole } = req.body; // Joi validated

  const updatedUser = await userService.changeUserRole(userId, newRole);

  res.status(200).json({
    success: true,
    data: updatedUser,
    message: `User role updated to ${updatedUser.role}.`
  });
});

export { 
  getUsers, 
  createUser, 
  updateUser, 
  deleteUser, 
  changeUserRole 
};