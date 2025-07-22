import mongoose from "mongoose";
import SubCategory from "../../models/productCategory/subcategory.model.js";
import Category from "../../models/productCategory/category.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import handleMongoErrors from "../../utils/mongooseError.js";
import Product from "../../models/product/product.model.js";
// import { subCategoryQueue } from "../../queues/subCategory.queue.js";
import { checkIfProductsUsedInOrderOrCart } from "./../../handler/checkOrder&Cart.js";
import ChildSubCategory from "../../models/productCategory/childSubCategory.model.js";

// Create SubCategory
export const createSubCategory = asyncHandler(async (req, res) => {
  try {
    const { name, parentCategory, attributes = {} } = req.body;

    if (!name || !parentCategory) {
      return res
        .status(400)
        .json(
          new ApiResponse(400, null, "Name and parentCategory are required")
        );
    }

    if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
      return res
        .status(400)
        .json(
          new ApiResponse(400, null, `Invalid Category ID: ${parentCategory}`)
        );
    }

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

    const formattedParentName = parent.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const formattedName = name.trim().toLowerCase().replace(/\s+/g, "-");
    const finalSlug = `${formattedParentName}-${formattedName}`;

    const existing = await SubCategory.findOne({
      slug: finalSlug,
      parentCategory: parentCategory,
    });

    if (existing) {
      return res
        .status(409)
        .json(
          new ApiResponse(
            409,
            null,
            `SubCategory "${name}" already exists under "${parent.name}"`
          )
        );
    }

    const subCategory = await SubCategory.create({
      name,
      slug: finalSlug,
      parentCategory, // Changed from parentSubCategory to parentCategory
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
    const { name, slug, parentCategory } = req.body; // Changed from parentSubCategory to parentCategory

    // Validate parentCategory if provided
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

    // Fetch existing SubCategory
    const existingSubCategory = await SubCategory.findById(req.params.id);
    if (!existingSubCategory) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "SubCategory not found"));
    }

    // Generate slug if name is updated
    if (name) {
      const finalSlug =
        slug?.trim().toLowerCase().replace(/\s+/g, "-") ||
        name.trim().toLowerCase().replace(/\s+/g, "-");

      // Check if slug is already taken
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

    // Perform update
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
// Get deleted subcategories
export const getDeletedSubCategories = asyncHandler(async (req, res) => {
  try {
    const deletedSubs = await SubCategory.find({ isDeleted: true }).populate(
      "parentCategory"
    );
    return res.json(
      new ApiResponse(200, deletedSubs, "Fetched deleted subcategories")
    );
  } catch (error) {
    console.error("Get Deleted SubCategories Error:", error);
    return handleMongoErrors(error, res);
  }
});

// Improved Soft or Hard Delete SubCategory with Child Subcategory handling
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

    // Find all related products (including those in child subcategories)
    const childSubCategories = await ChildSubCategory.find({
      parentSubCategory: subCategoryId,
    }).select("_id");

    const childSubCategoryIds = childSubCategories.map((c) => c._id);

    const products = await Product.find({
      $or: [
        { subCategory_id: subCategoryId },
        { childSubCategory_id: { $in: childSubCategoryIds } },
      ],
    }).select("_id");

    const productIds = products.map((p) => p._id);

    if (mode === "hard") {
      // Enhanced check with detailed information
      const { used, productsInOrders, productsInCarts } =
        await checkIfProductsUsedInOrderOrCart(productIds);

      if (used) {
        return res.status(400).json(
          new ApiResponse(
            400,
            {
              productsInOrders,
              productsInCarts,
            },
            "Cannot hard delete - these products are in active orders or carts: " +
              `${productsInOrders.length} in orders, ${productsInCarts.length} in carts`
          )
        );
      }

      // Perform hard delete in transaction
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Delete products first
        await Product.deleteMany({
          $or: [
            { subCategory_id: subCategoryId },
            { childSubCategory_id: { $in: childSubCategoryIds } },
          ],
        }).session(session);

        // Then delete child subcategories
        await ChildSubCategory.deleteMany({
          parentSubCategory: subCategoryId,
        }).session(session);

        // Finally delete the subcategory itself
        await SubCategory.findByIdAndDelete(subCategoryId).session(session);

        await session.commitTransaction();

        return res.json(
          new ApiResponse(
            200,
            null,
            "Subcategory and all related data hard deleted successfully"
          )
        );
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } else {
      const { used } = await checkIfProductsUsedInOrderOrCart(productIds);

      if (used) {
        return res
          .status(400)
          .json(
            new ApiResponse(
              400,
              null,
              "Cannot delete product as it is being used in active orders or carts"
            )
          );
      }
      // Soft delete in transaction
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Update subcategory
        await SubCategory.findByIdAndUpdate(
          subCategoryId,
          { $set: { isDeleted: true } },
          { session }
        );

        // Update child subcategories
        await ChildSubCategory.updateMany(
          { parentSubCategory: subCategoryId },
          { $set: { isDeleted: true } },
          { session }
        );

        // Update products
        await Product.updateMany(
          {
            $or: [
              { subCategory_id: subCategoryId },
              { childSubCategory_id: { $in: childSubCategoryIds } },
            ],
          },
          { $set: { isDeleted: true, status: false } },
          { session }
        );

        await session.commitTransaction();

        return res.json(
          new ApiResponse(
            200,
            null,
            "Subcategory and all related data soft deleted successfully"
          )
        );
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    }
  } catch (error) {
    console.error("Delete SubCategory Error:", error);
    return handleMongoErrors(error, res);
  }
});

// Improved Restore SubCategory with Child Subcategory handling
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

    // Check if parent category is deleted
    const parentCategory = await Category.findById(subCategory.parentCategory);
    if (parentCategory && parentCategory.isDeleted) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            `Cannot restore subcategory. First restore its parent category: ${parentCategory.name}`
          )
        );
    }

    // Find all child subcategories
    const childSubCategories = await ChildSubCategory.find({
      parentSubCategory: subCategoryId,
    }).select("_id");

    const childSubCategoryIds = childSubCategories.map((c) => c._id);

    // Perform restore in transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Restore the subcategory
      await SubCategory.findByIdAndUpdate(
        subCategoryId,
        { $set: { isDeleted: false } },
        { session }
      );

      // Restore all child subcategories
      await ChildSubCategory.updateMany(
        { parentSubCategory: subCategoryId },
        { $set: { isDeleted: false } },
        { session }
      );

      // Restore all related products
      await Product.updateMany(
        {
          $or: [
            { subCategory: subCategoryId },
            { childSubCategory: { $in: childSubCategoryIds } },
          ],
        },
        { $set: { isDeleted: false } },
        { session }
      );

      await session.commitTransaction();

      return res.json(
        new ApiResponse(
          200,
          subCategory,
          "SubCategory and all related child subcategories restored"
        )
      );
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Restore SubCategory Error:", error);
    return handleMongoErrors(error, res);
  }
});
