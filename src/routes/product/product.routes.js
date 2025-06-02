import express from "express";
import { createProduct, deleteProduct, getAllProducts, getProductById, updateProduct, updateStock } from "../../controllers/product/product.controller.js";


const router = express.Router();

router.post("/create", createProduct);
router.get("/", getAllProducts);
router.get("/:id", getProductById);
router.patch("/update/:id", updateProduct);
router.delete("/update/:id", deleteProduct);
router.patch("/update/:id/stock", updateStock);

export default router;
