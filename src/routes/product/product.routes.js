import express from "express";
import {
  createProductInCategory,
  getProductsByCategory,
  getProductsByCategorySlug,
  updateProductInCategory,
  getAllProducts,
  getProductById,
  deleteProduct,
  getFilteredProducts,
  getRelatedProducts,
} from "../../controllers/product/product.controller.js";

const router = express.Router();

// Category-based product routes
router.post("/create", createProductInCategory);
router.get("/categories/:categoryId/products", getProductsByCategory);
router.get("/categories/slug/:slug/products", getProductsByCategorySlug);
router.patch(
  "/categories/:categoryId/products/:productId",
  updateProductInCategory
);

// General product routes
router.get("/", getAllProducts);
router.get("/filter", getFilteredProducts);
router.get("/:productId", getProductById);
// Add this to your product.routes.js
router.get("/:productId/related", getRelatedProducts);
router.delete("/delete/:productId", deleteProduct);

export default router;
