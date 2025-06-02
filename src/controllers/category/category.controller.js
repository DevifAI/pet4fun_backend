import mongoose from "mongoose";
import Category from "../../models/productCategory/category.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// Create Category
export const createCategory = asyncHandler(async (req, res) => {
  try {
    const { name, slug, parentCategory } = req.body;

    if (!name) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Category name is required"));
    }

    // Auto-generate slug from name if not provided
    const finalSlug =
      slug?.trim().toLowerCase().replace(/\s+/g, "-") ||
      name.trim().toLowerCase().replace(/\s+/g, "-");

    // Check for existing slug
    const existing = await Category.findOne({ slug: finalSlug });
    if (existing) {
      return res
        .status(409)
        .json(
          new ApiResponse(409, null, "Category with this slug already exists")
        );
    }

    // Validate parentCategory if provided
    if (parentCategory) {
      if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
        return res
          .status(400)
          .json(new ApiResponse(400, null, "Invalid parentCategory ID"));
      }

      const parentExists = await Category.findById(parentCategory);
      if (!parentExists) {
        return res
          .status(404)
          .json(new ApiResponse(404, null, "Parent category not found"));
      }
    }

    // Create category
    const category = await Category.create({
      name,
      slug: finalSlug,
      parentCategory: parentCategory || null,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, category, "Category created successfully"));
  } catch (error) {
    console.error("Create Category Error:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal Server Error"));
  }
});

// Get All Categories
export const getAllCategories = asyncHandler(async (req, res) => {
  try {
    const categories = await Category.find().populate("parentCategory");
    return res.json(new ApiResponse(200, categories, "Fetched all categories"));
  } catch (error) {
    console.error("Get All Categories Error:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal Server Error"));
  }
});

// Get Single Category
export const getCategoryById = asyncHandler(async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate(
      "parentCategory"
    );
    if (!category) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Category not found"));
    }
    return res.json(new ApiResponse(200, category));
  } catch (error) {
    console.error("Get Category By ID Error:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal Server Error"));
  }
});

// Get Only Parent Categories
export const getParentCategories = asyncHandler(async (req, res) => {
  try {
    const parents = await Category.find({ parentCategory: null });
    return res.json(new ApiResponse(200, parents, "Fetched parent categories"));
  } catch (error) {
    console.error("Get Parent Categories Error:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal Server Error"));
  }
});

// Get Only Child Categories
export const getChildCategories = asyncHandler(async (req, res) => {
  try {
    const children = await Category.find({
      parentCategory: { $ne: null },
    }).populate("parentCategory");
    return res.json(new ApiResponse(200, children, "Fetched child categories"));
  } catch (error) {
    console.error("Get Child Categories Error:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal Server Error"));
  }
});

// Get Children of a Specific Category
export const getChildrenByParentId = asyncHandler(async (req, res) => {
  try {
    const { parentId } = req.params;
    const children = await Category.find({ parentCategory: parentId });
    return res.json(
      new ApiResponse(200, children, "Fetched children of the category")
    );
  } catch (error) {
    console.error("Get Children By Parent ID Error:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal Server Error"));
  }
});

// Update Category
export const updateCategory = asyncHandler(async (req, res) => {
  try {
    const updated = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).populate("parentCategory");

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
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal Server Error"));
  }
});

// Delete Category
export const deleteCategory = asyncHandler(async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Find all child categories that reference this as parent
    const childCategories = await Category.find({ parentCategory: categoryId });

    if (childCategories.length > 0) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            childCategories,
            "Cannot delete category: child categories exist"
          )
        );
    }

    const deleted = await Category.findByIdAndDelete(categoryId);

    if (!deleted) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Category not found"));
    }

    return res.json(
      new ApiResponse(200, null, "Category deleted successfully")
    );
  } catch (error) {
    console.error("Delete Category Error:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal Server Error"));
  }
});
