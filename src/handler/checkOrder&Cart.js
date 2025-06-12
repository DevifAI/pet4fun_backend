import Cart from "../models/cart/cart.model.js";
import Order from "../models/order/order.model.js";

export const checkIfProductsUsedInOrderOrCart = async (productIds = []) => {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return {
      usedInOrder: false,
      usedInCart: false,
      used: false,
    };
  }

  const [orderCount, cartCount] = await Promise.all([
    Order.countDocuments({
      "orderItems.product_id": { $in: productIds },
      paymentStatus: "Paid",
      orderStatus: { $in: ["Processing", "Shipped"] },
    }),
    Cart.countDocuments({
      "items.product_id": { $in: productIds },
    }),
  ]);

  return {
    usedInOrder: orderCount > 0,
    usedInCart: cartCount > 0,
    used: orderCount > 0 || cartCount > 0,
  };
};
