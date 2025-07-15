// routes/childSubCategory.routes.js
import express from "express";
import { createChildSubCategory, deleteChildSubCategory, getAllChildSubCategories, getChildSubByParent, getDeletedChildSubCategories, restoreChildSubCategory, updateChildSubCategory } from "../../controllers/category/childSubCategory.controller.js";


const router = express.Router();

router.post("/create", createChildSubCategory);
router.get("/", getAllChildSubCategories);
router.get("/deleted", getDeletedChildSubCategories);
router.get("/parent/:parentId", getChildSubByParent);
router.patch("/update/:id", updateChildSubCategory);
router.delete("/delete/:id", deleteChildSubCategory);
router.patch("/restore/:id", restoreChildSubCategory);

export default router;
