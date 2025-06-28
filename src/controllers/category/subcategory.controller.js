import mongoose from "mongoose";
import SubCategory from "../../models/productCategory/subcategory.model.js";
import Category from "../../models/productCategory/category.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import handleMongoErrors from "../../utils/mongooseError.js";
import Product from "../../models/product/product.model.js";
// import { subCategoryQueue } from "../../queues/subCategory.queue.js";
import { checkIfProductsUsedInOrderOrCart } from "./../../handler/checkOrder&Cart.js";

// Create SubCategory
export const createSubCategory = asyncHandler(async (req, res) => {
  try {
    const { name, parentCategory, attributes = {} } = req.body;

    if (!name || !parentCategory) {
      return res
        .status(400)
        .json(
          new ApiResponse(400, null, "Name and parentCategory is required")
        );
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
      return res
        .status(400)
        .json(
          new ApiResponse(400, null, `Invalid Category ID: ${parentCategory}`)
        );
    }

    // Get parent category
    const parent = await Category.findById(parentCategory);
    if (!parent || parent.isDeleted) {
      return res
        .status(404)
        .json(
          new ApiResponse(
            404,
            null,
            `Category ${parentCategory} not found or deleted`
          )
        );
    }

    // Generate compound slug (e.g., "dog-pharmacy")
    const formattedParentName = parent.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const formattedName = name.trim().toLowerCase().replace(/\s+/g, "-");
    const finalSlug = `${formattedParentName}-${formattedName}`;

    // Check for duplicate slug under same parent category
    const existing = await SubCategory.findOne({
      slug: finalSlug,
      parentSubCategory: parentCategory,
    });

    if (existing) {
      return res
        .status(409)
        .json(
          new ApiResponse(
            409,
            null,
            `SubCategory with name "${name}" already exists under "${parent.name}"`
          )
        );
    }

    // Create SubCategory
    const subCategory = await SubCategory.create({
      name,
      slug: finalSlug,
      parentSubCategory: parentCategory,
      attributes,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, subCategory, "SubCategory created"));
  } catch (error) {
    console.error("Create SubCategory Error:", error);
    return handleMongoErrors(error, res);
  }
});

// Get all and update as before...
export const getAllSubCategories = asyncHandler(async (req, res) => {
  try {
    const subs = await SubCategory.find({ isDeleted: { $ne: true } }).populate(
      "parentCategory"
    );
    return res.json(new ApiResponse(200, subs, "Fetched all subcategories"));
  } catch (error) {
    console.error("Get All SubCategories Error:", error);
    return handleMongoErrors(error, res);
  }
});

// Get SubCategory by By parent ID
export const getSubCategoriesByParent = asyncHandler(async (req, res) => {
  try {
    const { parentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid parent category ID"));
    }

    const children = await SubCategory.find({
      parentCategory: parentId,
      isDeleted: { $ne: true },
    });

    return res.json(
      new ApiResponse(200, children, "Fetched subcategories of the category")
    );
  } catch (error) {
    console.error("Get SubCategories By Parent Error:", error);
    return handleMongoErrors(error, res);
  }
});

// Update SubCategory
export const updateSubCategory = asyncHandler(async (req, res) => {
  try {
    const { name, slug, parentCategory } = req.body;

    // ✅ Validate parentCategory if provided
    if (parentCategory) {
      if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
        return res
          .status(400)
          .json(new ApiResponse(400, null, "Invalid parentCategory ID"));
      }

      const parentExists = await Category.findById(parentCategory);
      if (!parentExists || parentExists.isDeleted) {
        return res
          .status(404)
          .json(
            new ApiResponse(404, null, "Parent category not found or deleted")
          );
      }
    }

    // ✅ Fetch existing SubCategory
    const existingSubCategory = await SubCategory.findById(req.params.id);
    if (!existingSubCategory) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "SubCategory not found"));
    }

    // ✅ Generate slug if name is updated
    if (name) {
      const finalSlug =
        slug?.trim().toLowerCase().replace(/\s+/g, "-") ||
        name.trim().toLowerCase().replace(/\s+/g, "-");

      // ✅ Check if slug is already taken
      const slugExists = await SubCategory.findOne({
        slug: finalSlug,
        _id: { $ne: req.params.id },
      });

      if (slugExists) {
        return res
          .status(409)
          .json(
            new ApiResponse(
              409,
              null,
              "Slug already exists for another subcategory"
            )
          );
      }

      req.body.slug = finalSlug;
    }

    // ✅ Perform update
    const updated = await SubCategory.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    ).populate("parentCategory");

    return res.json(
      new ApiResponse(200, updated, "SubCategory updated successfully")
    );
  } catch (error) {
    console.error("Update SubCategory Error:", error);
    return handleMongoErrors(error, res);
  }
});

// Soft or Hard Delete SubCategory
export const deleteSubCategory = asyncHandler(async (req, res) => {
  const subCategoryId = req.params.id;
  const { mode = "soft" } = req.query;

  if (!mongoose.Types.ObjectId.isValid(subCategoryId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid subcategory ID"));
  }

  try {
    const subCategory = await SubCategory.findById(subCategoryId);
    if (!subCategory) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Subcategory not found"));
    }

    const products = await Product.find({ subCategory: subCategoryId }).select(
      "_id"
    );
    const productIds = products.map((p) => p._id);

    if (mode === "hard") {
      const { used } = await checkIfProductsUsedInOrderOrCart(productIds);

      if (used) {
        return res
          .status(400)
          .json(
            new ApiResponse(
              400,
              null,
              "Cannot hard delete subcategory — products exist in active orders or carts"
            )
          );
      }

      await Promise.all([
        Product.deleteMany({ subCategory: subCategoryId }),
        SubCategory.findByIdAndDelete(subCategoryId),
      ]);

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            null,
            "Subcategory and related products hard deleted"
          )
        );
    } else {
      await Promise.all([
        SubCategory.findByIdAndUpdate(subCategoryId, {
          $set: { isDeleted: true },
        }),
        Product.updateMany(
          { subCategory: subCategoryId },
          { $set: { isDeleted: true, status: false } }
        ),
      ]);

      return res
        .status(200)
        .json(new ApiResponse(200, null, "Subcategory soft deleted"));
    }
  } catch (error) {
    console.error("Delete SubCategory Error:", error);
    return handleMongoErrors(error, res);
  }
});

// Restore SubCategory
export const restoreSubCategory = asyncHandler(async (req, res) => {
  const { id: subCategoryId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(subCategoryId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid subcategory ID"));
  }

  try {
    const subCategory = await SubCategory.findById(subCategoryId);
    if (!subCategory) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "SubCategory not found"));
    }

    if (!subCategory.isDeleted) {
      return res.json(
        new ApiResponse(200, subCategory, "SubCategory already active")
      );
    }

    await SubCategory.findByIdAndUpdate(subCategoryId, {
      $set: { isDeleted: false },
    });

    await Product.updateMany(
      { subCategory: subCategoryId },
      { $set: { isDeleted: false } }
    );

    // await subCategoryQueue.add({ subCategoryId, mode: "restore" });

    return res.json(
      new ApiResponse(200, subCategory, "SubCategory restore job queued")
    );
  } catch (error) {
    console.error("Restore SubCategory Error:", error);
    return handleMongoErrors(error, res);
  }
});
