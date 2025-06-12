import Category from "../models/productCategory/category.model.js";
import SubCategory from "../models/productCategory/subCategory.model.js";
import Product from "../models/product/product.model.js";

export const handleCategoryJob = async ({ categoryId, mode }) => {
  if (!categoryId || !["soft", "hard", "restore"].includes(mode)) {
    throw new Error("Invalid mode or missing category ID.");
  }

  if (mode === "hard") {
    // Hard delete: remove category and all related subcategories and products
    await Promise.all([
      SubCategory.deleteMany({ parentCategory: categoryId }),
      Product.deleteMany({ category: categoryId }),
      Category.findByIdAndDelete(categoryId),
    ]);
  } else if (mode === "soft") {
    // Soft delete: mark category and related data as deleted

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
  } else if (mode === "restore") {
    // Restore category and related data

    await Promise.all([
      SubCategory.updateMany(
        { parentCategory: categoryId },
        { $set: { isDeleted: false } }
      ),
      Product.updateMany(
        { category: categoryId },
        { $set: { isDeleted: false } }
      ),
    ]);
  }
};
