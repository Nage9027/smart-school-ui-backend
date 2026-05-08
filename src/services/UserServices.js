import userRepo from '../repositories/userRepo.js';
import User from '../models/User.js'; // To check for existing user during creation

/**
 * Business logic to create a new user.
 * @param {object} userData - Raw user data from controller (name, email, password, role, phone).
 * @returns {Promise<object>} - The newly created user object (excluding sensitive data).
 */
const createUser = async ({ name, email, password, role, phone }) => {
  const userExists = await User.findOne({ email });

  if (userExists) {
    throw new Error('User already exists with this email.');
  }
  
  const userData = {
    name,
    email,
    passwordHash: password, // The model's pre-save hook handles hashing this
    role,
    phone,
  };

  const newUser = await userRepo.createUser(userData);

  // Return safe data
  const { passwordHash, refreshTokens, ...safeUser } = newUser;
  return safeUser;
};

/**
 * Business logic to fetch users with filtering and pagination.
 * @param {object} query - The validated query parameters (role, active, page, limit).
 * @returns {Promise<object>} - Paginated list of users.
 */
const getUsers = async (query) => {
  const { role, active, page, limit } = query;
  
  const filters = {};
  if (role) {
    filters.role = role;
  }
  if (active !== undefined) {
    filters.active = active;
  }

  const result = await userRepo.getUsersPaginated(filters, page, limit);
  return result;
};

/**
 * Business logic to update user details.
 * @param {string} userId - ID of the user to update.
 * @param {object} updateData - Data containing name, phone, or active status.
 * @returns {Promise<User>} - The updated user object.
 */
const updateUser = async (userId, updateData) => {
  const updatedUser = await userRepo.updateUserById(userId, updateData);
  
  if (!updatedUser) {
    throw new Error('User not found.');
  }

  return updatedUser;
};

/**
 * Business logic to soft delete a user (set active=false).
 * @param {string} userId - ID of the user to delete.
 * @returns {Promise<User>} - The deleted user object.
 */
const deleteUser = async (userId) => {
  const deletedUser = await userRepo.softDeleteUser(userId);

  if (!deletedUser) {
    throw new Error('User not found.');
  }
  
  return deletedUser;
};

/**
 * Business logic to change a user's role.
 * @param {string} userId - ID of the user to update.
 * @param {string} newRole - The new role to assign.
 * @returns {Promise<User>} - The updated user object.
 */
const changeUserRole = async (userId, newRole) => {
  const user = await userRepo.findUserById(userId);

  if (!user) {
    throw new Error('User not found.');
  }

  // Prevent changing a user's role to the highest role (owner) unless authorized
  // NOTE: Assuming the currently logged-in admin cannot elevate roles above their own,
  // but for simplicity here, we allow admin to change role unless they target 'owner' (optional protection)
  if (newRole === 'owner' && user.role !== 'owner') {
     // Optional business rule: prevent arbitrary creation of 'owner' role
     // For now, we rely on Joi validation for allowed roles, which should exclude 'owner' for non-owners.
  }
  
  const updatedUser = await userRepo.updateUserById(userId, { role: newRole });
  
  return updatedUser;
};

export default {
  createUser,
  getUsers,
  updateUser,
  deleteUser,
  changeUserRole,
};