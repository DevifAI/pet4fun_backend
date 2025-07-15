import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import User from "../../models/user/user.model.js";

// Helper to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// Register
export const createAccount = asyncHandler(async (req, res) => {
  const { name, email, password, phone, address } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json(
        new ApiResponse(400, null, "Name, Email, and Password are required")
      );
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res
      .status(409)
      .json(new ApiResponse(409, null, "Email already registered"));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    phone,
    address,
  });

  const token = generateToken(user._id);

  res
    .status(201)
    .json(
      new ApiResponse(201, { user, token }, "Account created successfully")
    );
});

// Login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res
      .status(401)
      .json(new ApiResponse(401, null, "Invalid email or password"));
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res
      .status(401)
      .json(new ApiResponse(401, null, "Invalid email or password"));
  }

  const token = generateToken(user._id);

  res.json(new ApiResponse(200, { user, token }, "Logged in successfully"));
});

// Logout
export const logout = asyncHandler(async (req, res) => {
  // For JWT, logout is handled on frontend (delete token). Optionally, use a token blacklist.
  res.json(new ApiResponse(200, null, "Logged out successfully"));
});

// Get profile
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  res.json(new ApiResponse(200, user, "Fetched profile"));
});
