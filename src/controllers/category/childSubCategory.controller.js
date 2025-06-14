import mongoose from "mongoose";
import ChildSubCategory from "../../models/productCategory/childSubCategory.model.js";
import SubCategory from "../../models/productCategory/subcategory.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import handleMongoErrors from "../../utils/mongooseError.js";
import Product from "../../models/product/product.model.js";
import { checkIfProductsUsedInOrderOrCart } from "../../handler/checkOrder&Cart.js";

// Create a new child sub-category
export const createChildSubCategory = asyncHandler(async (req, res) => {
  try {
    const { name, parentSubCategories = [], slug, attributes = {} } = req.body;

    if (!name || !parentSubCategories.length) {
      return res
        .status(400)
        .json(
          new ApiResponse(400, null, "Name & parentSubCategories are required")
        );
    }

    // Validate each parentSubCategory ID
    for (const subCatId of parentSubCategories) {
      if (!mongoose.Types.ObjectId.isValid(subCatId)) {
        return res
          .status(400)
          .json(
            new ApiResponse(400, null, `Invalid SubCategory ID: ${subCatId}`)
          );
      }

      const exists = await SubCategory.findById(subCatId);
      if (!exists || exists.isDeleted) {
        return res
          .status(404)
          .json(
            new ApiResponse(
              404,
              null,
              `SubCategory ${subCatId} not found or deleted`
            )
          );
      }
    }

    const finalSlug =
      slug?.trim().toLowerCase().replace(/\s+/g, "-") ||
      name.trim().toLowerCase().replace(/\s+/g, "-");

    const existing = await ChildSubCategory.findOne({ slug: finalSlug });
    if (existing) {
      return res
        .status(409)
        .json(
          new ApiResponse(
            409,
            null,
            "Child SubCategory with this slug already exists"
          )
        );
    }

    const child = await ChildSubCategory.create({
      name,
      slug: finalSlug,
      parentSubCategories,
      attributes,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, child, "ChildSubCategory created"));
  } catch (error) {
    console.error("Create ChildSubCategory Error:", error);
    return handleMongoErrors(error, res);
  }
});

// Get all child sub-categories
export const getAllChildSubCategories = asyncHandler(async (_req, res) => {
  try {
    const list = await ChildSubCategory.find({ isDeleted: { $ne: true } })
      .populate({
        path: "parentSubCategory",
        populate: { path: "parentCategory" },
      })
      .lean();
    return res.json(
      new ApiResponse(200, list, "Fetched all child‑sub‑categories")
    );
  } catch (error) {
    console.error("Get All ChildSubCategories Error:", error);
    return handleMongoErrors(error, res);
  }
});

//  GET BY PARENT (SubCategory)

export const getChildSubByParent = asyncHandler(async (req, res) => {
  try {
    const { parentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid parentSubCategory ID"));
    }

    const items = await ChildSubCategory.find({
      parentSubCategory: parentId,
      isDeleted: { $ne: true },
    });
    return res.json(
      new ApiResponse(200, items, "Fetched child‑sub‑categories of parent")
    );
  } catch (error) {
    console.error("Get ChildSubCategories By Parent Error:", error);
    return handleMongoErrors(error, res);
  }
});

//  UPDATE
export const updateChildSubCategory = asyncHandler(async (req, res) => {
  try {
    const { name, slug, parentSubCategory } = req.body;

    // ✅ Validate parentSubCategory if provided
    if (parentSubCategory) {
      if (!mongoose.Types.ObjectId.isValid(parentSubCategory)) {
        return res
          .status(400)
          .json(new ApiResponse(400, null, "Invalid parentSubCategory ID"));
      }
      const exists = await SubCategory.findById(parentSubCategory);
      if (!exists || exists.isDeleted) {
        return res
          .status(404)
          .json(new ApiResponse(404, null, "Parent sub‑category not found"));
      }
    }

    // ✅ Fetch existing ChildSubCategory
    const existingChild = await ChildSubCategory.findById(req.params.id);
    if (!existingChild) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "ChildSubCategory not found"));
    }

    // ✅ Handle slug generation from name (if name updated)
    if (name) {
      const finalSlug =
        slug?.trim().toLowerCase().replace(/\s+/g, "-") ||
        name.trim().toLowerCase().replace(/\s+/g, "-");

      // Check if slug already exists in another document
      const slugExists = await ChildSubCategory.findOne({
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
              "Slug already exists for another child subcategory"
            )
          );
      }

      req.body.slug = finalSlug;
    }

    // ✅ Perform update
    const updated = await ChildSubCategory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate({
      path: "parentSubCategory",
      populate: { path: "parentCategory" },
    });

    return res.json(
      new ApiResponse(200, updated, "ChildSubCategory updated successfully")
    );
  } catch (error) {
    console.error("Update ChildSubCategory Error:", error);
    return handleMongoErrors(error, res);
  }
});

//  DELETE  (soft | hard)
export const deleteChildSubCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { mode = "soft" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid childSubCategory ID"));
    }

    const child = await ChildSubCategory.findById(id);
    if (!child) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "ChildSubCategory not found"));
    }

    const productDocs = await Product.find({
      childSubCategory_id: id,
    }).select("_id");

    const productIds = productDocs.map((p) => p._id);

    if (mode === "hard") {
      const { used } = await checkIfProductsUsedInOrderOrCart(productIds);
      if (used) {
        return res
          .status(400)
          .json(
            new ApiResponse(
              400,
              null,
              "Cannot hard delete—products exist in active orders/carts"
            )
          );
      }

      await Promise.all([
        Product.deleteMany({ childSubCategory_id: id }),
        ChildSubCategory.findByIdAndDelete(id),
      ]);

      return res.json(
        new ApiResponse(200, null, "ChildSubCategory & products hard‑deleted")
      );
    }

    // soft delete
    await Promise.all([
      ChildSubCategory.findByIdAndUpdate(id, { $set: { isDeleted: true } }),
      Product.updateMany(
        { childSubCategory_id: id },
        { $set: { isDeleted: true, status: false } }
      ),
    ]);

    return res.json(
      new ApiResponse(200, null, "ChildSubCategory soft‑deleted")
    );
  } catch (error) {
    console.error("Delete ChildSubCategory Error:", error);
    return handleMongoErrors(error, res);
  }
});

//  RESTORE
export const restoreChildSubCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid childSubCategory ID"));
    }

    const child = await ChildSubCategory.findById(id);
    if (!child) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "ChildSubCategory not found"));
    }

    if (!child.isDeleted) {
      return res.json(
        new ApiResponse(200, child, "ChildSubCategory already active")
      );
    }

    await ChildSubCategory.findByIdAndUpdate(id, {
      $set: { isDeleted: false },
    });

    await Product.updateMany(
      { childSubCategory_id: id },
      { $set: { isDeleted: false } }
    );

    return res.json(
      new ApiResponse(200, child, "ChildSubCategory restored successfully")
    );
  } catch (error) {
    console.error("Restore ChildSubCategory Error:", error);
    return handleMongoErrors(error, res);
  }
});
