import express from "express";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  getCategoryTree,
  getDeletedCategories,
  restoreCategory,
  updateCategory,
} from "../../controllers/category/category.controller.js";

const router = express.Router();

// Create a new category
router.post("/create", createCategory);

// Get all categories (excluding soft-deleted ones)
router.get("/", getAllCategories);
router.get("/deleted", getDeletedCategories);


// Get category tree structure
router.get("/tree", getCategoryTree);

// Get a single category by ID
router.get("/:id", getCategoryById);

// Update a category by ID
router.patch("/update/:id", updateCategory);

// Restore a soft-deleted category by ID
router.patch("/restore/:id", restoreCategory);

// Delete a category by ID (soft or hard delete based on query param)
router.delete("/delete/:id", deleteCategory);

export default router;
