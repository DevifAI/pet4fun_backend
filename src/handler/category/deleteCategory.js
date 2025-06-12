import Product from "../../models/product/product.model.js";
import Order from "../../models/order/order.model.js";
import Cart from "../../models/cart/cart.model.js";
import SubCategory from "../../models/productCategory/subcategory.model.js";

const BATCH_SIZE = 500;

async function batchDeleteCategoryData(categoryId, mode = "soft") {
  let total = await Product.countDocuments({ category: categoryId });
  let pages = Math.ceil(total / BATCH_SIZE);

  for (let i = 0; i < pages; i++) {
    const products = await Product.find({ category: categoryId })
      .skip(i * BATCH_SIZE)
      .limit(BATCH_SIZE);

    const productIds = products.map((p) => p._id);

    if (productIds.length > 0) {
      if (mode === "soft") {
        await Product.updateMany(
          { _id: { $in: productIds } },
          { $set: { isDeleted: true, status: false } }
        );
      } else if (mode === "hard") {
        // Step 1: Get product IDs used in orders
        const usedInOrders = await Order.find({
          "orderItems.product_id": { $in: productIds },
        }).distinct("orderItems.product_id");

        // Step 2: Get product IDs used in carts
        const usedInCarts = await Cart.find({
          "items.product_id": { $in: productIds },
        }).distinct("items.product_id");

        // Step 3: Create a Set of used product IDs (avoid duplicate)
        const usedProductIds = new Set([
          ...usedInOrders.map((id) => id.toString()),
          ...usedInCarts.map((id) => id.toString()),
        ]);

        // Step 4: Filter for hard and soft deletion
        const safeToDelete = productIds.filter(
          (id) => !usedProductIds.has(id.toString())
        );
        const toSoftDelete = productIds.filter((id) =>
          usedProductIds.has(id.toString())
        );

        // Step 5: Delete products safely
        if (safeToDelete.length > 0) {
          await Product.deleteMany({ _id: { $in: safeToDelete } });
        }

        if (toSoftDelete.length > 0) {
          await Product.updateMany(
            { _id: { $in: toSoftDelete } },
            { $set: { isDeleted: true, status: false } }
          );
        }
      }
    }
  }

  // SubCategory delete
  if (mode === "soft") {
    await SubCategory.updateMany(
      { parentCategory: categoryId },
      { $set: { isDeleted: true } }
    );
  } else if (mode === "hard") {
    await SubCategory.deleteMany({ parentCategory: categoryId });
  }
}
