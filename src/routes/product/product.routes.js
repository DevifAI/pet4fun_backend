import express from "express";
import {
  createProductInCategory,
  getProductsByCategory,
  getProductsByCategorySlug,
  updateProductInCategory,
  deleteProductInCategory,
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../../controllers/product/product.controller.js";

const router = express.Router();

// Category-based product routes
router.post("/categories/:categoryId/products", createProductInCategory);
router.get("/categories/:categoryId/products", getProductsByCategory);
router.get("/categories/slug/:slug/products", getProductsByCategorySlug);
router.patch(
  "/categories/:categoryId/products/:productId",
  updateProductInCategory
);
router.delete(
  "/categories/:categoryId/products/:productId",
  deleteProductInCategory
);

// General product routes
router.get("/", getAllProducts);
router.get("/:productId", getProductById);
router.post("/", createProduct);
router.patch("/:productId", updateProduct);
router.delete("/:productId", deleteProduct);

export default router;
