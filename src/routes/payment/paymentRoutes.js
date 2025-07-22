// routes/paymentRoutes.js
import express from "express";
import {
  initiatePayment,
  paymentCallback,
} from "../../controllers/payment/paymentController.js";

const router = express.Router();

router.post("/initiate", initiatePayment);
router.post("/callback", paymentCallback);

export default router;
