import Product from "../../models/product/product.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// Create Product
export const createProduct = asyncHandler(async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res
      .status(201)
      .json(new ApiResponse(201, product, "Product created successfully"));
  } catch (error) {
    console.error("Create Product Error:", error);
    res
      .status(500)
      .json(new ApiResponse(500, null, "Failed to create product"));
  }
});

// Get All Products
export const getAllProducts = asyncHandler(async (req, res) => {
  try {
    const { type, category, search } = req.query;
    const filter = {};

    if (type) filter.type = type;
    if (category) filter.category_id = category;
    if (search) filter.name = { $regex: search, $options: "i" };

    const products = await Product.find(filter).populate(
      "category_id subCategory_id"
    );
    res.json(new ApiResponse(200, products));
  } catch (error) {
    console.error("Get All Products Error:", error);
    res
      .status(500)
      .json(new ApiResponse(500, null, "Failed to fetch products"));
  }
});

// Get Single Product
export const getProductById = asyncHandler(async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "category_id subCategory_id relatedProducts"
    );
    if (!product) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Product not found"));
    }
    res.json(new ApiResponse(200, product));
  } catch (error) {
    console.error("Get Product By ID Error:", error);
    res.status(500).json(new ApiResponse(500, null, "Failed to fetch product"));
  }
});

// Update Product
export const updateProduct = asyncHandler(async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Product not found"));
    }
    res.json(new ApiResponse(200, updated, "Product updated successfully"));
  } catch (error) {
    console.error("Update Product Error:", error);
    res
      .status(500)
      .json(new ApiResponse(500, null, "Failed to update product"));
  }
});

// Delete Product
export const deleteProduct = asyncHandler(async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Product not found"));
    }
    res.json(new ApiResponse(200, null, "Product deleted successfully"));
  } catch (error) {
    console.error("Delete Product Error:", error);
    res
      .status(500)
      .json(new ApiResponse(500, null, "Failed to delete product"));
  }
});

// Update Stock
export const updateStock = asyncHandler(async (req, res) => {
  try {
    const { stock } = req.body;
    if (typeof stock !== "number" || stock < 0) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid stock value"));
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock },
      { new: true }
    );
    if (!product) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Product not found"));
    }
    res.json(new ApiResponse(200, product, "Stock updated"));
  } catch (error) {
    console.error("Update Stock Error:", error);
    res.status(500).json(new ApiResponse(500, null, "Failed to update stock"));
  }
});
