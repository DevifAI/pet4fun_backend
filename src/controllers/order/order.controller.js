import mongoose from "mongoose";
import Order from "../../models/order/order.model.js";
import Cart from "../../models/cart/cart.model.js";
import Product from "../../models/product/product.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { shippingAddress, paymentMethod } = req.body;

  if (!shippingAddress || !paymentMethod) {
    return res.status(400).json(new ApiResponse(400, null, "Shipping address and payment method are required"));
  }

  const cart = await Cart.findOne({ user_id: userId });
  if (!cart || !cart.items || cart.items.length === 0) {
    return res.status(400).json(new ApiResponse(400, null, "Cart is empty"));
  }

  let totalAmount = 0;
  const orderItems = [];

  for (const item of cart.items) {
    const product = await Product.findById(item.product_id).lean();
    if (!product) {
      return res.status(404).json(new ApiResponse(404, null, `Product not found: ${item.product_id}`));
    }
    const { _id, createdAt, updatedAt, __v, ...cleanProduct } = product;
    const subtotal = product.price * item.quantity;
    totalAmount += subtotal;
    orderItems.push({
      product_id: item.product_id,
      quantity: item.quantity,
      productSnapshot: cleanProduct,
    });
  }

  // Optionally use session/transaction for atomicity if MongoDB supports it
  const newOrder = await Order.create({
    user_id: userId,
    orderItems,
    totalAmount,
    shippingAddress,
    paymentMethod,
  });

  await Cart.deleteOne({ user_id: userId });

  return res
    .status(201)
    .json(new ApiResponse(201, newOrder, "Order created successfully"));
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user_id: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(new ApiResponse(200, orders, "Fetched your orders"));
});

export const getOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId))
    return res.status(400).json(new ApiResponse(400, null, "Invalid order ID"));

  const order = await Order.findOne({ _id: orderId, user_id: req.user._id });
  if (!order)
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));

  res.json(new ApiResponse(200, order, "Fetched order"));
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { orderStatus } = req.body;
  if (!mongoose.Types.ObjectId.isValid(orderId))
    return res.status(400).json(new ApiResponse(400, null, "Invalid order ID"));

  const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
  if (!orderStatus || !validStatuses.includes(orderStatus)) {
    return res.status(400).json(new ApiResponse(400, null, "Invalid order status"));
  }

  const order = await Order.findById(orderId);
  if (!order)
    return res.status(404).json(new ApiResponse(404, null, "Order not found"));

  order.orderStatus = orderStatus;
  await order.save();

  res.json(new ApiResponse(200, order, "Order status updated"));
});

export const deleteOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId))
    return res.status(400).json(new ApiResponse(400, null, "Invalid order ID"));

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