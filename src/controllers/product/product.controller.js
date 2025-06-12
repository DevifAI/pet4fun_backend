import mongoose from "mongoose";
import Product from "../../models/product/product.model.js";
import Category from "../../models/productCategory/category.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/* -------------------------------------------------- *
 * Helper: validate & return category + subCategory   *
 * -------------------------------------------------- */
const validateCategories = async ({ category_id, subCategory_id }) => {
  // Make sure both IDs are valid ObjectIds
  if (!mongoose.Types.ObjectId.isValid(category_id))
    throw new ApiResponse(400, null, "Invalid category_id");

  const category = await Category.findById(category_id);
  if (!category) throw new ApiResponse(404, null, "Category not found");

  if (subCategory_id) {
    if (!mongoose.Types.ObjectId.isValid(subCategory_id))
      throw new ApiResponse(400, null, "Invalid subCategory_id");

    const subCategory = await Category.findById(subCategory_id);
    if (!subCategory)
      throw new ApiResponse(404, null, "Sub-category not found");

    // Ensure sub-category really belongs to the parent
    if (
      !subCategory.parentCategory ||
      !subCategory.parentCategory.equals(category._id)
    ) {
      throw new ApiResponse(
        400,
        null,
        "subCategory_id does not belong to the supplied category_id"
      );
    }
  }
  return true;
};

/* ==================================================
   CREATE  — POST /api/v1/categories/:categoryId/products
   ================================================== */
export const createProductInCategory = asyncHandler(async (req, res) => {
  try {
    // Inject the categoryId param into the body (allows nested route)
    req.body.category_id = req.params.categoryId;

    await validateCategories(req.body);
    const product = await Product.create(req.body);

    res
      .status(201)
      .json(new ApiResponse(201, product, "Product created successfully"));
  } catch (err) {
    if (err instanceof ApiResponse) return res.status(err.statusCode).json(err);
    console.error("Create Product Error:", err);
    res
      .status(500)
      .json(new ApiResponse(500, null, "Failed to create product"));
  }
});

/* ==================================================
   READ  — GET products by a single category (and its children)
   GET /api/v1/categories/:categoryId/products
   query ?deep=true  ➜ include all descendant sub-categories
   ================================================== */
export const getProductsByCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const { deep } = req.query;

  if (!mongoose.Types.ObjectId.isValid(categoryId))
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid category ID"));

  // Build a list of category IDs to search in
  let categoryIds = [categoryId];

  if (deep === "true") {
    const descendants = await Category.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(categoryId) } },
      {
        $graphLookup: {
          from: "categories", // collection name (lower-case!)
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parentCategory",
          as: "descendants",
        },
      },
      { $project: { _id: 0, descendants: "$descendants._id" } },
    ]);

    if (descendants.length) {
      categoryIds = categoryIds.concat(descendants[0].descendants);
    }
  }

  const products = await Product.find({ category_id: { $in: categoryIds } })
    .populate("category_id subCategory_id")
    .lean();

  res.json(new ApiResponse(200, products, "Fetched products"));
});

/* ==================================================
   READ  — GET products by category slug
   GET /api/v1/categories/slug/:slug/products
   ================================================== */
export const getProductsByCategorySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const category = await Category.findOne({ slug });

  if (!category)
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Category not found"));

  // Re-use the controller above by faking params
  req.params.categoryId = category._id;
  return getProductsByCategory(req, res);
});

/* ==================================================
   UPDATE  (same validation, but keeps existing category unless changed)
   PUT /api/v1/categories/:categoryId/products/:productId
   ================================================== */
export const updateProductInCategory = asyncHandler(async (req, res) => {
  try {
    // Ensure product actually belongs to the category in the URL
    const { categoryId, productId } = req.params;

    const product = await Product.findOne({
      _id: productId,
      category_id: categoryId,
    });

    if (!product)
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Product not found in this category"));

    // If caller wants to move product to another category, validate it
    if (req.body.category_id || req.body.subCategory_id)
      await validateCategories({
        category_id: req.body.category_id || categoryId,
        subCategory_id: req.body.subCategory_id,
      });

    const updated = await Product.findByIdAndUpdate(productId, req.body, {
      new: true,
    });

    res.json(new ApiResponse(200, updated, "Product updated successfully"));
  } catch (err) {
    if (err instanceof ApiResponse) return res.status(err.statusCode).json(err);
    console.error("Update Product Error:", err);
    res
      .status(500)
      .json(new ApiResponse(500, null, "Failed to update product"));
  }
});

/* ==================================================
   READ  — GET all products (with optional pagination & filtering)
   GET /api/v1/products?limit=10&page=1&search=dog&type=pet&minPrice=2000&maxPrice=5000&petType=dog&breed=bull%20dog&gender=male&color=white&category_id=...
   ================================================== */
export const getAllProducts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;

  // Build filter object
  const filter = {};

  // Only add filter if value is non-empty
  if (req.query.search && req.query.search.trim() !== "") {
    filter.name = { $regex: req.query.search, $options: "i" };
  }
  if (req.query.breed && req.query.breed.trim() !== "") {
    filter.breed = { $regex: req.query.breed, $options: "i" };
  }
  if (req.query.type && req.query.type.trim() !== "") {
    filter.type = req.query.type;
  }
  if (req.query.petType && req.query.petType.trim() !== "") {
    filter.petType = req.query.petType;
  }
  if (req.query.gender && req.query.gender.trim() !== "") {
    filter.gender = req.query.gender;
  }
  if (req.query.color && req.query.color.trim() !== "") {
    filter.color = { $regex: req.query.color, $options: "i" };
  }
  if (req.query.category_id && req.query.category_id.trim() !== "") {
    filter.category_id = req.query.category_id;
  }
  if (req.query.subCategory_id && req.query.subCategory_id.trim() !== "") {
    filter.subCategory_id = req.query.subCategory_id;
  }
  // Optional: filter by location if present and not empty
  if (req.query.location && req.query.location.trim() !== "") {
    filter.location = { $regex: req.query.location, $options: "i" };
  }
  // Filter by price range
  if (
    (req.query.minPrice && req.query.minPrice !== "") ||
    (req.query.maxPrice && req.query.maxPrice !== "")
  ) {
    filter.price = {};
    if (req.query.minPrice && req.query.minPrice !== "")
      filter.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice && req.query.maxPrice !== "")
      filter.price.$lte = Number(req.query.maxPrice);
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category_id subCategory_id")
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.json(
    new ApiResponse(
      200,
      { products, total, page, pages: Math.ceil(total / limit) },
      "Fetched all products"
    )
  );
});

/* ==================================================
   READ  — GET product by ID (with related products)
   GET /api/v1/products/:productId
   ================================================== */
export const getProductById = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId))
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid product ID"));

  const product = await Product.findById(productId)
    .populate("category_id subCategory_id")
    .populate({
      path: "relatedProducts",
      populate: { path: "category_id subCategory_id" },
    })
    .lean();

  if (!product)
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Product not found"));

  res.json(new ApiResponse(200, product, "Fetched product"));
});

/* ==================================================
   DELETE  — DELETE /api/v1/products/:productId
   ================================================== */
export const deleteProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const deleted = await Product.findByIdAndDelete(productId);
  if (!deleted)
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Product not found"));
  res.json(new ApiResponse(200, null, "Product deleted successfully"));
});
