import mongoose from "mongoose";
import Category from "../../models/productCategory/category.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import handleMongoErrors from "../../utils/mongooseError.js";
// import { categoryQueue } from "../../queues/category.queue.js";
import Product from "../../models/product/product.model.js";
import SubCategory from "../../models/productCategory/subcategory.model.js";
import { checkIfProductsUsedInOrderOrCart } from "../../handler/checkOrder&Cart.js";
import ChildSubCategory from "../../models/productCategory/childSubCategory.model.js";

// Create Category
export const createCategory = asyncHandler(async (req, res) => {
  try {
    const { name, slug } = req.body;

    if (!name) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Category name is required"));
    }

    const finalSlug =
      slug?.trim().toLowerCase().replace(/\s+/g, "-") ||
      name.trim().toLowerCase().replace(/\s+/g, "-");

    const existing = await Category.findOne({ slug: finalSlug });
    if (existing) {
      return res
        .status(409)
        .json(
          new ApiResponse(409, null, "Category with this slug already exists")
        );
    }

    const category = await Category.create({
      name,
      slug: finalSlug,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, category, "Category created successfully"));
  } catch (error) {
    console.error("Create Category Error:", error);
    return handleMongoErrors(error, res);
  }
});

// Get All Categories (excluding soft-deleted)
export const getAllCategories = asyncHandler(async (req, res) => {
  try {
    const categories = await Category.find({ isDeleted: { $ne: true } });
    return res.json(new ApiResponse(200, categories, "Fetched all categories"));
  } catch (error) {
    console.error("Get All Categories Error:", error);
    return handleMongoErrors(error, res);
  }
});

// Get Single Category by ID (with ID check)
export const getCategoryById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid category ID"));
    }

    const category = await Category.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });

    if (!category) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Category not found"));
    }

    return res.json(new ApiResponse(200, category));
  } catch (error) {
    console.error("Get Category By ID Error:", error);
    return handleMongoErrors(error, res);
  }
});

// Update Category
export const updateCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid category ID"));
    }

    const { name, slug } = req.body;
    let updateData = { ...req.body };

    if (name) {
      updateData.slug = slug
        ? slug.trim().toLowerCase().replace(/\s+/g, "-")
        : name.trim().toLowerCase().replace(/\s+/g, "-");
    }

    const existing = await Category.findOne({
      slug: updateData.slug,
      _id: { $ne: id },
    });
    if (existing) {
      return res
        .status(409)
        .json(
          new ApiResponse(409, null, "Category with this slug already exists")
        );
    }

    const updated = await Category.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Category not found"));
    }

    return res.json(
      new ApiResponse(200, updated, "Category updated successfully")
    );
  } catch (error) {
    console.error("Update Category Error:", error);
    return handleMongoErrors(error, res);
  }
});

// Restore Soft-Deleted Category
export const restoreCategory = asyncHandler(async (req, res) => {
  const { id: categoryId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid category ID"));
  }

  try {
    const category = await Category.findById(categoryId);

    if (!category) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Category not found"));
    }

    if (!category.isDeleted) {
      return res.json(
        new ApiResponse(200, category, "Category is already active")
      );
    }

    await Promise.all([
      SubCategory.updateMany(
        { parentCategory: categoryId },
        { $set: { isDeleted: false } }
      ),
      Product.updateMany(
        { category: categoryId },
        { $set: { isDeleted: false, status: true } }
      ),
    ]);

    category.isDeleted = false;
    await category.save();

    return res.json(
      new ApiResponse(200, category, "Category successfully restored")
    );
  } catch (error) {
    console.error("Restore Category Error:", error);
    return handleMongoErrors(error, res);
  }
});

// Delete Category (soft or hard based on client input)
export const deleteCategory = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;
  const { mode = "soft" } = req.query;

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid category ID"));
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Category not found"));
  }

  try {
    const products = await Product.find({ category: categoryId }).select("_id");
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
              "Cannot hard delete category — products are in active orders or carts"
            )
          );
      }

      await Promise.all([
        SubCategory.deleteMany({ parentCategory: categoryId }),
        Product.deleteMany({ category: categoryId }),
        Category.findByIdAndDelete(categoryId),
      ]);
    } else {
      category.isDeleted = true;
      await category.save();

      await Promise.all([
        SubCategory.updateMany(
          { parentCategory: categoryId },
          { $set: { isDeleted: true } }
        ),
        Product.updateMany(
          { category: categoryId },
          { $set: { isDeleted: true, status: false } }
        ),
      ]);
    }

    return res.json(
      new ApiResponse(
        200,
        null,
        `${mode} delete successful, processed in background`
      )
    );
  } catch (error) {
    console.error("Delete Category Error:", error);
    return handleMongoErrors(error, res);
  }
});

// Get Category Tree (categories with subcategories and child subcategories)
export const getCategoryTree = asyncHandler(async (req, res) => {
  try {
    const categories = await Category.find({ isDeleted: false })
      .select("name slug") // include slug
      .lean();

    const subCategories = await SubCategory.find({ isDeleted: false })
      .select("name slug parentSubCategory") // include slug
      .lean();

    const childSubCategories = await ChildSubCategory.find({ isDeleted: false })
      .select("name slug parentSubCategories") // include slug
      .lean();

    // Create tree
    const categoryTree = categories.map((cat) => {
      // SubCategories under this category
      const subs = subCategories
        .filter(
          (sub) => sub.parentSubCategory?.toString() === cat._id.toString()
        )
        .map((sub) => {
          // ChildSubCategories that reference this SubCategory
          const childs = childSubCategories.filter((child) =>
            child.parentSubCategories?.some(
              (parentSubId) => parentSubId.toString() === sub._id.toString()
            )
          );
          return {
            _id: sub._id,
            name: sub.name,
            slug: sub.slug,
            childSubCategories: childs.map((child) => ({
              _id: child._id,
              name: child.name,
              slug: child.slug,
            })),
          };
        });

      return {
        _id: cat._id,
        name: cat.name,
        slug: cat.slug,
        subCategories: subs,
      };
    });

    return res
      .status(200)
      .json(new ApiResponse(200, categoryTree, "Category tree fetched"));
  } catch (error) {
    console.error("Get Category Tree Error:", error);
    return handleMongoErrors(error, res);
  }
});
