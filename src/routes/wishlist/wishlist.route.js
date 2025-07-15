import express from "express";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  checkProductInWishlist,
} from "../../controllers/wishlist/wishlist.controller.js";
import { authenticateUser } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateUser);

router.route("/").get(getWishlist).post(addToWishlist).delete(clearWishlist);

router
  .route("/:productId")
  .delete(removeFromWishlist)
  .get(checkProductInWishlist);

export default router;
