import express from "express";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getOrderByTrackingNumber,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
  updateTrackingNumber,
} from "../../controllers/order/order.controller.js";
import { authenticateUser } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Apply authentication to all order routes
// router.use(authenticateUser);

// User order routes
router.post("/", authenticateUser, createOrder);
router.get("/me", authenticateUser, getMyOrders);
router.get("/:orderId", authenticateUser, getOrderById);
router.get("/tracking/:trackingNumber", authenticateUser, getOrderByTrackingNumber);
router.patch("/:orderId/cancel", authenticateUser, cancelOrder);

// // Admin-only routes
// router.use(authorizeAdmin);
router.get("/", getAllOrders);
router.patch("/status/:orderId", updateOrderStatus);
router.patch("/payment-status/:orderId", updatePaymentStatus);
router.patch("/:orderId/tracking", updateTrackingNumber);

export default router;
