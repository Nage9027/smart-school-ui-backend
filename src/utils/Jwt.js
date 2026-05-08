import jwt from 'jsonwebtoken';
import 'dotenv/config';

/**
 * Generates a JSON Web Token (JWT) for a user.
 * @param {string} userId - The MongoDB ObjectId of the user.
 * @param {string} role - The role of the user ('admin', 'teacher', 'student', etc.).
 * @returns {string} The generated JWT.
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role }, 
    process.env.JWT_SECRET, 
    {
      expiresIn: process.env.JWT_LIFETIME,
    }
  );
};

export default generateToken;