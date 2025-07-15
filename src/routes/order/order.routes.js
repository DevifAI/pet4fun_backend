import express from "express";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getOrderByTrackingNumber,
  cancelOrder,
} from "../../controllers/order/order.controller.js";
import { authenticateUser } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Apply authentication to all order routes
router.use(authenticateUser);

// User order routes
router.post("/", createOrder);
router.get("/me", getMyOrders);
router.get("/:orderId", getOrderById);
router.get("/tracking/:trackingNumber", getOrderByTrackingNumber);
router.patch("/:orderId/cancel", cancelOrder);

// // Admin-only routes
// router.use(authorizeAdmin);
// router.get("/", getAllOrders);
// router.patch("/:orderId/status", updateOrderStatus);
// router.patch("/:orderId/payment-status", updatePaymentStatus);
// router.patch("/:orderId/tracking", updateTrackingNumber);

export default router;
