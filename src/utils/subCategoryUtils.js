import Product from "../models/product/product.model.js";
import SubCategory from "../models/productCategory/subCategory.model.js";


export const handleSubCategoryJob = async ({ subCategoryId, mode }) => {
  if (mode === "hard") {
    await Promise.all([
      Product.deleteMany({ subCategory: subCategoryId }),
      SubCategory.findByIdAndDelete(subCategoryId),
    ]);
  } else if (mode === "soft") {
    await SubCategory.findByIdAndUpdate(subCategoryId, {
      $set: { isDeleted: true },
    });

    await Product.updateMany(
      { subCategory: subCategoryId },
      { $set: { isDeleted: true } }
    );
  } else if (mode === "restore") {
    await SubCategory.findByIdAndUpdate(subCategoryId, {
      $set: { isDeleted: false },
    });

    await Product.updateMany(
      { subCategory: subCategoryId },
      { $set: { isDeleted: false } }
    );
  } else {
    throw new Error(`Unknown mode: ${mode}`);
  }
};
