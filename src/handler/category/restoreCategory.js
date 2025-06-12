import Product from '../../models/product/product.model.js';
import SubCategory from '../../models/productCategory/subcategory.model.js';


const BATCH_SIZE = 500;

async function batchRestoreCategoryData(categoryId) {
  let total = await Product.countDocuments({
    category: categoryId,
    isDeleted: true,
  });

  let pages = Math.ceil(total / BATCH_SIZE);

  for (let i = 0; i < pages; i++) {
    const products = await Product.find({
      category: categoryId,
      isDeleted: true,
    })
      .skip(i * BATCH_SIZE)
      .limit(BATCH_SIZE);

    const productIds = products.map((p) => p._id);

    if (productIds.length > 0) {
      await Product.updateMany(
        { _id: { $in: productIds } },
        { $set: { isDeleted: false, status: true } }
      );
    }
  }

  // Restore Subcategories
  await SubCategory.updateMany(
    { parentCategory: categoryId, isDeleted: true },
    { $set: { isDeleted: false } }
  );
}
