import express from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "../../controllers/cart/cart.controller.js";
import { authenticateUser } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateUser);
router.get("/", getCart);
router.delete("/clear", clearCart);
router.post("/", addToCart);
router.patch("/", updateCartItem);
router.delete("/:productId", removeFromCart);

export default router;
