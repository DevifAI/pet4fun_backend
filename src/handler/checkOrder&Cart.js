import mongoose from "mongoose";
import Cart from "../models/cart/cart.model.js";
import Order from "../models/order/order.model.js";

export const checkIfProductsUsedInOrderOrCart = async (productIds = []) => {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return {
      usedInOrder: false,
      usedInCart: false,
      used: false,
      productsInOrders: [],
      productsInCarts: [],
    };
  }

  // Convert all IDs to ObjectId and remove duplicates
  const objectIds = [
    ...new Set(
      productIds.map((id) =>
        typeof id === "string" ? new mongoose.Types.ObjectId(id) : id
      )
    ),
  ];

  const [orders, carts] = await Promise.all([
    Order.find({
      "orderItems.product_id": { $in: objectIds },
      $or: [
        { paymentStatus: "Paid" },
        { orderStatus: { $in: ["Processing", "Shipped", "Delivered"] } },
      ],
    }).select("orderItems.product_id"),
    Cart.find({
      "items.product_id": { $in: objectIds },
    }).select("items.product_id"),
  ]);

  // Get unique product IDs found in orders and carts
  const productsInOrders = [
    ...new Set(
      orders.flatMap((order) =>
        order.orderItems.map((item) => item.product_id.toString())
      )
    ),
  ];

  const productsInCarts = [
    ...new Set(
      carts.flatMap((cart) =>
        cart.items.map((item) => item.product_id.toString())
      )
    ),
  ];

  return {
    usedInOrder: productsInOrders.length > 0,
    usedInCart: productsInCarts.length > 0,
    used: productsInOrders.length > 0 || productsInCarts.length > 0,
    productsInOrders,
    productsInCarts,
  };
};
