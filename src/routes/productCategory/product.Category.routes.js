import express from "express";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  getChildCategories,
  getChildrenByParentId,
  getParentCategories,
  updateCategory,
} from "../../controllers/category/category.controller.js";

const router = express.Router();

router.post("/create", createCategory);
router.get("/", getAllCategories);
router.get("/parents", getParentCategories);
router.get("/children", getChildCategories);
router.get("/children/:parentId", getChildrenByParentId); 
router.get("/:id", getCategoryById);
router.patch("/update/:id", updateCategory);
router.delete("/delete/:id", deleteCategory);

export default router;
