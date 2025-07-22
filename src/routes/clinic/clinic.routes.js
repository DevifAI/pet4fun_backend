import express from "express";
import {
  createClinicAppointment,
  getAllClinicAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  deleteAppointment,
} from "../../controllers/clinic/clinic.controller.js";
// import { verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/", createClinicAppointment);

// Admin protected routes
router.get("/", getAllClinicAppointments);
router.get("/:id", getAppointmentById);
router.patch("/:id/status", updateAppointmentStatus);
router.delete("/:id", deleteAppointment);

export default router;
