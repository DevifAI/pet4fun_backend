import mongoose from "mongoose";
import Order from "../../models/order/order.model.js";
import Cart from "../../models/cart/cart.model.js";
import Product from "../../models/product/product.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { shippingAddress, paymentMethod } = req.body;

  // Step 1: Get cart for user
  const cart = await Cart.findOne({ user_id: userId }).lean();
  if (!cart || cart.items.length === 0) {
    return res.status(400).json(new ApiResponse(400, null, "Cart is empty"));
  }

  // Step 2: Prepare orderItems with full product snapshot
  let totalAmount = 0;

  const orderItems = await Promise.all(
    cart.items.map(async (item) => {
      // Fetch product details
      const product = await Product.findById(item.product_id).lean();
      if (!product) throw new Error("Product not found");

      // Remove _id, timestamps, __v etc.
      const { _id, createdAt, updatedAt, __v, ...cleanProduct } = product;

      // Calculate subtotal
      const subtotal = product.price * item.quantity;
      totalAmount += subtotal;

      // Return order item with full product snapshot
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        productSnapshot: cleanProduct,
      };
    })
  );

  // Step 3: Create new order
  const newOrder = await Order.create({
    user_id: userId,
    orderItems,
    totalAmount,
    shippingAddress,
    paymentMethod,
  });

  // Step 4: Clear cart after order is placed
  await Cart.deleteOne({ user_id: userId });

  // Step 5: Respond success
  return res
    .status(201)
    .json(new ApiResponse(201, newOrder, "Order created successfully"));
});

/* ==================================================
   GET all orders for current user
   GET /api/v1/orders
   ================================================== */
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user_id: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(new ApiResponse(200, orders, "Fetched your orders"));
});

/* ==================================================
   GET single order by ID (user can only access own order)
   GET /api/v1/orders/:orderId
   ================================================== */
export const getOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId))
    return res.status(400).json(new ApiResponse(400, null, "Invalid order ID"));

  const order = await Order.findOne({ _id: orderId, user_id: req.user._id });
  if (!order)
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));

  res.json(new ApiResponse(200, order, "Fetched order"));
});

/* ==================================================
   UPDATE order status (admin only)
   PATCH /api/v1/orders/:orderId/status
   Body: { orderStatus }
   ================================================== */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { orderStatus } = req.body;
  if (!mongoose.Types.ObjectId.isValid(orderId))
    return res.status(400).json(new ApiResponse(400, null, "Invalid order ID"));

  const order = await Order.findById(orderId);
  if (!order)
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));

  order.orderStatus = orderStatus;
  await order.save();

  res.json(new ApiResponse(200, order, "Order status updated"));
});

/* ==================================================
   DELETE order (user can only delete own order if not delivered)
   DELETE /api/v1/orders/:orderId
   ================================================== */
export const deleteOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId))
    return res.status(400).json(new ApiResponse(400, null, "Invalid order ID"));

  // Only allow user to delete their own order if not delivered
  const order = await Order.findOne({ _id: orderId, user_id: req.user._id });
  if (!order)
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));

  if (order.orderStatus === "Delivered")
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Cannot delete delivered order"));

  await Order.deleteOne({ _id: orderId });

  res.json(new ApiResponse(200, null, "Order deleted successfully"));
});
