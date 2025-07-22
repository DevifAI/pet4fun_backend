import express from "express";
import {
  createConsultation,
  deleteConsultation,
  getAllConsultations,
  getConsultationById,
  updateConsultationStatus,
} from "../../controllers/clinic/vetConsult.controller.js";

const router = express.Router();

// Public routes
router.post("/", createConsultation);

// Admin routes (add admin middleware as needed)
router.get("/", getAllConsultations);
router.get("/:id", getConsultationById);
router.patch("/:id/status", updateConsultationStatus);
router.delete("/:id", deleteConsultation);

export default router;
