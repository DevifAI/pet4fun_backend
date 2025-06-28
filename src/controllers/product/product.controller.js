import mongoose from "mongoose";
import Product from "../../models/product/product.model.js";
import Category from "../../models/productCategory/category.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import SubCategory from "../../models/productCategory/subcategory.model.js";
import ChildSubCategory from "../../models/productCategory/childSubCategory.model.js";

const validateCategories = async ({
  category_id,
  subCategory_id,
  childSubCategory_id,
}) => {
  if (!mongoose.Types.ObjectId.isValid(category_id)) {
    throw new ApiResponse(400, null, "Invalid category_id");
  }

  const category = await Category.findById(category_id);
  if (!category) {
    throw new ApiResponse(404, null, "Category not found");
  }

  // Validate subCategory
  if (subCategory_id) {
    if (!mongoose.Types.ObjectId.isValid(subCategory_id)) {
      throw new ApiResponse(400, null, "Invalid subCategory_id");
    }

    const subCategory = await SubCategory.findById(subCategory_id);
    if (!subCategory) {
      throw new ApiResponse(404, null, "Sub-category not found");
    }

    if (
      !subCategory.parentSubCategory ||
      !subCategory.parentSubCategory.equals(category._id)
    ) {
      throw new ApiResponse(
        400,
        null,
        "subCategory_id does not belong to the supplied category_id"
      );
    }

    // Validate childSubCategory
    if (childSubCategory_id) {
      if (!mongoose.Types.ObjectId.isValid(childSubCategory_id)) {
        throw new ApiResponse(400, null, "Invalid childSubCategory_id");
      }

      const childSubCategory = await ChildSubCategory.findById(
        childSubCategory_id
      );

      if (!childSubCategory) {
        throw new ApiResponse(404, null, "Child sub-category not found");
      }

      const isMatch = childSubCategory.parentSubCategories.some((id) =>
        id.equals(subCategory._id)
      );

      if (!isMatch) {
        throw new ApiResponse(
          400,
          null,
          "childSubCategory_id does not belong to the supplied subCategory_id"
        );
      }
    }
  }

  return true;
};

export const createProductInCategory = asyncHandler(async (req, res) => {
  try {
    await validateCategories(req.body);

    const product = await Product.create(req.body);

    res
      .status(201)
      .json(new ApiResponse(201, product, "Product created successfully"));
  } catch (err) {
    if (err instanceof ApiResponse) {
      return res.status(err.statusCode).json(err);
    }

    console.error("Create Product Error:", err);
    res
      .status(500)
      .json(new ApiResponse(500, null, "Failed to create product"));
  }
});

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

export const getFilteredProducts = asyncHandler(async (req, res) => {
  try {
    const {
      categorySlug,
      subCategorySlug,
      childSubCategorySlug,
      minPrice,
      maxPrice,
      brand,
      type,
      usage,
      page = 1,
      limit = 10,
    } = req.query;

    const match = { isDeleted: false, status: true };

    // Resolve category slugs to IDs
    const category = categorySlug
      ? await Category.findOne({ slug: categorySlug, isDeleted: false })
      : null;
    if (category) match.category_id = category._id;

    const subCategory = subCategorySlug
      ? await SubCategory.findOne({ slug: subCategorySlug, isDeleted: false })
      : null;
    if (subCategory) match.subCategory_id = subCategory._id;

    const childSubCategory = childSubCategorySlug
      ? await ChildSubCategory.findOne({
          slug: childSubCategorySlug,
          isDeleted: false,
        })
      : null;
    if (childSubCategory) match.childSubCategory_id = childSubCategory._id;

    // Price filter
    if (minPrice || maxPrice) {
      match.discountPrice = {};
      if (minPrice) match.discountPrice.$gte = Number(minPrice);
      if (maxPrice) match.discountPrice.$lte = Number(maxPrice);
    }

    // Additional filters
    if (brand) match["filterAttributes.brand"] = brand;
    if (type) match["filterAttributes.type"] = type;
    if (usage) match["filterAttributes.usage"] = usage;

    const skip = (Number(page) - 1) * Number(limit);

    // Aggregation pipeline
    const aggregationPipeline = [
      { $match: match },

      {
        $facet: {
          products: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
          ],

          totalCount: [{ $count: "count" }],

          filterCounts: [
            {
              $group: {
                _id: null,
                brands: { $addToSet: "$filterAttributes.brand" },
                types: { $addToSet: "$filterAttributes.type" },
                usages: { $addToSet: "$filterAttributes.usage" },
                species: { $addToSet: "$filterAttributes.species" },
                minPrice: { $min: "$discountPrice" },
                maxPrice: { $max: "$discountPrice" },
              },
            },
          ],

          brandBreakdown: [
            {
              $group: {
                _id: "$filterAttributes.brand",
                count: { $sum: 1 },
              },
            },
          ],

          speciesBreakdown: [
            {
              $group: {
                _id: "$filterAttributes.species",
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ];

    const result = await Product.aggregate(aggregationPipeline);

    const {
      products,
      totalCount,
      filterCounts,
      brandBreakdown,
      speciesBreakdown,
    } = result[0];

    const filters = {
      brands: brandBreakdown.map((b) => ({ name: b._id, count: b.count })),
      species: speciesBreakdown.map((s) => ({ name: s._id, count: s.count })),
      types: filterCounts[0]?.types || [],
      usages: filterCounts[0]?.usages || [],
      price: {
        min: filterCounts[0]?.minPrice || 0,
        max: filterCounts[0]?.maxPrice || 0,
      },
    };

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          products,
          total: totalCount[0]?.count || 0,
          page: Number(page),
          pages: Math.ceil((totalCount[0]?.count || 0) / limit),
          filters,
        },
        "Filtered products with breakdown"
      )
    );
  } catch (error) {
    console.error("Filter API Error:", error);
    return handleMongoErrors(error, res);
  }
});

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

// Add this to your product.controller.js
export const getRelatedProducts = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;
    const limit = parseInt(req.query.limit) || 4; // Default to 4 related products

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid product ID"));
    }

    // First get the current product to determine relation criteria
    const product = await Product.findById(productId).lean();
    if (!product) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Product not found"));
    }

    // Find related products based on:
    // 1. Same category
    // 2. Same subcategory (if exists)
    // 3. Similar tags (if exist)
    // 4. Same filter attributes (like brand, type, etc.)
    const relatedProducts = await Product.find({
      _id: { $ne: product._id }, // Exclude current product
      $or: [
        { category_id: product.category_id },
        { subCategory_id: product.subCategory_id },
        { tags: { $in: product.tags || [] } },
        ...(product.filterAttributes?.brand
          ? [{ "filterAttributes.brand": product.filterAttributes.brand }]
          : []),
      ],
      isDeleted: false,
      status: true,
    })
      .limit(limit)
      .populate("category_id subCategory_id")
      .lean();

    res.json(
      new ApiResponse(
        200,
        { products: relatedProducts },
        "Related products fetched"
      )
    );
  } catch (error) {
    console.error("Get Related Products Error:", error);
    res
      .status(500)
      .json(new ApiResponse(500, null, "Failed to fetch related products"));
  }
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const deleted = await Product.findByIdAndDelete(productId);
  if (!deleted)
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Product not found"));
  res.json(new ApiResponse(200, null, "Product deleted successfully"));
});
