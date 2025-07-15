import express from "express";
import {
  createSubCategory,
  deleteSubCategory,
  getAllSubCategories,
  getSubCategoriesByParent,
  updateSubCategory,
  restoreSubCategory,
  getDeletedSubCategories, // eta controller a ase, route a add kora lagbe
} from "../../controllers/category/subcategory.controller.js";

const router = express.Router();

// Create a new subcategory
router.post("/create", createSubCategory);

// Get all subcategories (only not soft-deleted)
router.get("/", getAllSubCategories);
router.get("/deleted", getDeletedSubCategories);

// Get subcategories by parent category id
router.get("/parent/:parentId", getSubCategoriesByParent);

// Update subcategory by id
router.patch("/update/:id", updateSubCategory);

// Soft or hard delete subcategory by id
router.delete("/delete/:id", deleteSubCategory);

// Restore soft-deleted subcategory by id
router.patch("/restore/:id", restoreSubCategory);

export default router;
