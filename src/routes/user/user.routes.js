import express from "express";
import {
  createAccount,
  login,
  logout,
  getProfile,
} from "../../controllers/user/user.controller.js";
import { authenticateUser } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", createAccount);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", authenticateUser, getProfile);

export default router;
