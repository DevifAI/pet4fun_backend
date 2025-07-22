import mongoose from "mongoose";
import ChildSubCategory from "../../models/productCategory/childSubCategory.model.js";
import SubCategory from "../../models/productCategory/subcategory.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import handleMongoErrors from "../../utils/mongooseError.js";
import Product from "../../models/product/product.model.js";
import { checkIfProductsUsedInOrderOrCart } from "../../handler/checkOrder&Cart.js";
import Category from "../../models/productCategory/category.model.js";

// Create a new child sub-category
export const createChildSubCategory = asyncHandler(async (req, res) => {
  try {
    const {
      name,
      parentCategory,
      parentSubCategory,
      attributes = {},
    } = req.body;

    if (!name || !parentCategory || !parentSubCategory) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            "Name, parentCategory and parentSubCategory are required"
          )
        );
    }

    // Validate parentCategory
    if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
      return res
        .status(400)
        .json(
          new ApiResponse(400, null, `Invalid Category ID: ${parentCategory}`)
        );
    }

    const parentCat = await Category.findById(parentCategory);
    if (!parentCat || parentCat.isDeleted) {
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

    // Validate parentSubCategory
    if (!mongoose.Types.ObjectId.isValid(parentSubCategory)) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            `Invalid SubCategory ID: ${parentSubCategory}`
          )
        );
    }

    const parentSubCat = await SubCategory.findOne({
      _id: parentSubCategory,
      parentCategory: parentCategory,
    });

    if (!parentSubCat || parentSubCat.isDeleted) {
      return res
        .status(404)
        .json(
          new ApiResponse(
            404,
            null,
            `SubCategory ${parentSubCategory} not found or doesn't belong to this category`
          )
        );
    }

    // Generate compound slug
    const formattedParentCat = parentCat.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const formattedParentSub = parentSubCat.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const formattedName = name.trim().toLowerCase().replace(/\s+/g, "-");
    const finalSlug = `${formattedParentCat}-${formattedParentSub}-${formattedName}`;

    // Check for existing slug
    const existing = await ChildSubCategory.findOne({ slug: finalSlug });
    if (existing) {
      return res
        .status(409)
        .json(
          new ApiResponse(
            409,
            null,
            `ChildSubCategory "${name}" already exists under those categories`
          )
        );
    }

    const child = await ChildSubCategory.create({
      name,
      slug: finalSlug,
      parentCategory,
      parentSubCategory,
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
    const list = await ChildSubCategory.aggregate([
      // Fixed typo: aggregrate -> aggregate
      { $match: { isDeleted: { $ne: true } } },
      {
        $lookup: {
          from: "subcategories",
          localField: "parentSubCategory", // Singular to match schema
          foreignField: "_id",
          as: "parentSubCategory", // Singular to match schema
          pipeline: [
            { $match: { isDeleted: { $ne: true } } },
            {
              $lookup: {
                from: "categories",
                localField: "parentCategory", // Matches subcategory's parent reference
                foreignField: "_id",
                as: "parentCategory",
              },
            },
            { $unwind: "$parentCategory" }, // Unwind the category lookup
          ],
        },
      },
      { $unwind: "$parentSubCategory" }, // Unwind the subcategory lookup
      // Optional: Project to clean up the output structure
      {
        $project: {
          name: 1,
          slug: 1,
          attributes: 1,
          "parentSubCategory.name": 1,
          "parentSubCategory.slug": 1,
          "parentSubCategory.parentCategory.name": 1,
          "parentSubCategory.parentCategory.slug": 1,
        },
      },
    ]);

    return res.json(
      new ApiResponse(
        200,
        list,
        "Fetched all child-sub-categories with full parent hierarchy"
      )
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

// UPDATE
export const updateChildSubCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parentCategory, parentSubCategory, attributes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(new ApiResponse(400, null, "Invalid ID"));
    }

    // Find existing child subcategory
    const existingChild = await ChildSubCategory.findById(id);
    if (!existingChild) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "ChildSubCategory not found"));
    }

    // Validate parentCategory if provided
    if (parentCategory) {
      if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
        return res
          .status(400)
          .json(new ApiResponse(400, null, "Invalid parentCategory ID"));
      }
      const parentCat = await Category.findById(parentCategory);
      if (!parentCat || parentCat.isDeleted) {
        return res
          .status(404)
          .json(
            new ApiResponse(404, null, "Parent category not found or deleted")
          );
      }
    }

    // Validate parentSubCategory if provided
    if (parentSubCategory) {
      if (!mongoose.Types.ObjectId.isValid(parentSubCategory)) {
        return res
          .status(400)
          .json(new ApiResponse(400, null, "Invalid parentSubCategory ID"));
      }
      const parentSubCat = await SubCategory.findById(parentSubCategory);
      if (!parentSubCat || parentSubCat.isDeleted) {
        return res
          .status(404)
          .json(
            new ApiResponse(
              404,
              null,
              "Parent subcategory not found or deleted"
            )
          );
      }
    }

    // Generate new slug if name changed
    let slug = existingChild.slug;
    if (name && name !== existingChild.name) {
      const parentCat = parentCategory
        ? await Category.findById(parentCategory)
        : await Category.findById(existingChild.parentCategory);

      const parentSubCat = parentSubCategory
        ? await SubCategory.findById(parentSubCategory)
        : await SubCategory.findById(existingChild.parentSubCategory);

      const formattedParentCat = parentCat.name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
      const formattedParentSub = parentSubCat.name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
      const formattedName = name.trim().toLowerCase().replace(/\s+/g, "-");
      slug = `${formattedParentCat}-${formattedParentSub}-${formattedName}`;

      // Check if new slug exists
      const slugExists = await ChildSubCategory.findOne({
        slug,
        _id: { $ne: id },
      });
      if (slugExists) {
        return res
          .status(409)
          .json(new ApiResponse(409, null, "Slug already exists"));
      }
    }

    // Prepare update data
    const updateData = {
      ...req.body,
      slug,
    };

    // Perform update
    const updated = await ChildSubCategory.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate([
      {
        path: "parentSubCategory",
        populate: { path: "parentCategory" },
      },
      { path: "parentCategory" },
    ]);

    return res.json(
      new ApiResponse(200, updated, "ChildSubCategory updated successfully")
    );
  } catch (error) {
    console.error("Update ChildSubCategory Error:", error);
    return handleMongoErrors(error, res);
  }
});

export const getDeletedChildSubCategories = async (req, res) => {
  try {
    const deletedChildSubCategories = await ChildSubCategory.find({
      isDeleted: true,
    })
      .populate("parentCategory", "name slug")
      .populate("parentSubCategory", "name slug");

    res.status(200).json({
      success: true,
      message: "Deleted child subcategories fetched successfully",
      data: deletedChildSubCategories,
    });
  } catch (error) {
    console.error("Error fetching deleted child subcategories:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

//  DELETE  (soft | hard)
export const deleteChildSubCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { mode = "soft" } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid childSubCategory ID"));
  }

  try {
    const childSubCategory = await ChildSubCategory.findById(id);
    if (!childSubCategory) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "ChildSubCategory not found"));
    }

    // Find all related products
    const products = await Product.find({ childSubCategory_id: id }).select(
      "_id"
    );
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
        await Product.deleteMany({ childSubCategory_id: id }).session(session);

        // Then delete the child subcategory
        await ChildSubCategory.findByIdAndDelete(id).session(session);

        await session.commitTransaction();

        return res.json(
          new ApiResponse(
            200,
            null,
            "ChildSubCategory and related products hard deleted successfully"
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
        // Update child subcategory
        await ChildSubCategory.findByIdAndUpdate(
          id,
          { $set: { isDeleted: true } },
          { session }
        );

        // Update products
        await Product.updateMany(
          { childSubCategory_id: id },
          { $set: { isDeleted: true, status: false } },
          { session }
        );

        await session.commitTransaction();

        return res.json(
          new ApiResponse(
            200,
            null,
            "ChildSubCategory and related products soft deleted successfully"
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

    // Check if parent subcategory is deleted
    const parentSubCategory = await SubCategory.findById(
      child.parentSubCategory
    );
    if (parentSubCategory && parentSubCategory.isDeleted) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            `Cannot restore child subcategory. First restore its parent subcategory: ${parentSubCategory.name}`
          )
        );
    }

    await ChildSubCategory.findByIdAndUpdate(id, {
      $set: { isDeleted: false },
    });

    await Product.updateMany(
      { childSubCategory: id },
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
