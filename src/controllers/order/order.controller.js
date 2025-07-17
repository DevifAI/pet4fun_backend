import mongoose from "mongoose";
import Order from "../../models/order/order.model.js";
import Cart from "../../models/cart/cart.model.js";
import Product from "../../models/product/product.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import handleMongoErrors from "../../utils/mongooseError.js";

const generateTrackingNumber = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateOrderNumber = async () => {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `ORD-${timestamp}-${randomNum}`;
};

export const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { shippingAddress, paymentMethod, couponCode, notes } = req.body;

  // Validate required fields
  if (!shippingAddress || !paymentMethod) {
    return res
      .status(400)
      .json(
        new ApiResponse(
          400,
          null,
          "Shipping address and payment method are required"
        )
      );
  }

  // Validate shipping address structure
  const requiredAddressFields = [
    "fullName",
    "addressLine1",
    "city",
    "state",
    "postalCode",
  ];
  const missingFields = requiredAddressFields.filter(
    (field) => !shippingAddress[field]
  );

  if (missingFields.length > 0) {
    return res
      .status(400)
      .json(
        new ApiResponse(
          400,
          null,
          `Missing shipping address fields: ${missingFields.join(", ")}`
        )
      );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const cart = await Cart.findOne({ user_id: userId }).session(session);
    if (!cart || !cart.items || cart.items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json(new ApiResponse(400, null, "Cart is empty"));
    }

    let totalAmount = 0;
    let taxAmount = 0;
    let shippingFee = 0;
    const orderItems = [];
    const outOfStockItems = [];

    // Check product availability and prepare order items
    for (const item of cart.items) {
      const product = await Product.findById(item.product_id)
        .session(session)
        .lean();
      if (!product) {
        outOfStockItems.push(item.product_id);
        continue;
      }

      if (product.stock < item.quantity) {
        outOfStockItems.push({
          productId: item.product_id,
          available: product.stock,
          requested: item.quantity,
        });
        continue;
      }

      const { _id, createdAt, updatedAt, __v, ...cleanProduct } = product;
      const subtotal = product.price * item.quantity;
      totalAmount += subtotal;
      taxAmount += subtotal * 0.1; // Assuming 10% tax

      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        productSnapshot: cleanProduct,
        price: product.price,
        subtotal,
      });

      // Reduce product stock
      await Product.findByIdAndUpdate(
        item.product_id,
        { $inc: { stock: -item.quantity } },
        { session }
      );
    }

    if (outOfStockItems.length > 0) {
      await session.abortTransaction();
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            { outOfStockItems },
            "Some items are out of stock or unavailable"
          )
        );
    }

    // Apply shipping fee
    shippingFee = totalAmount < 100 ? 5 : 0;
    totalAmount += taxAmount + shippingFee;

    // Generate unique order number and tracking number
    const orderNumber = await generateOrderNumber();
    let trackingNumber;
    let isUnique = false;

    // Ensure tracking number is unique
    while (!isUnique) {
      trackingNumber = generateTrackingNumber();
      const exists = await Order.findOne({ trackingNumber }).session(session);
      if (!exists) isUnique = true;
    }

    // Create order
    const orderDoc = new Order({
      user_id: userId,
      orderNumber,
      orderItems,
      totalAmount,
      taxAmount,
      shippingFee,
      shippingAddress,
      paymentMethod,
      paymentStatus: paymentMethod === "COD" ? "Pending" : "Paid",
      orderStatus: "Processing",
      trackingNumber,
      notes,
      couponUsed: couponCode ? { code: couponCode, discount: 10 } : null,
    });

    await orderDoc.save({ session });

    // Clear cart items
    await Cart.findOneAndUpdate(
      { user_id: userId },
      { $set: { items: [] } },
      { session }
    );

    await session.commitTransaction();

    return res
      .status(201)
      .json(new ApiResponse(201, orderDoc, "Order created successfully"));
  } catch (error) {
    await session.abortTransaction();
    return handleMongoErrors(error, res);
  } finally {
    session.endSession();
  }
});

export const getMyOrders = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;

    // Build filter
    const filter = { user_id: req.user._id };

    if (status) {
      filter.orderStatus = status;
    }

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Start of day
        filter.createdAt.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
        filter.createdAt.$lte = end;
      }
    }

    // Pagination options
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
      lean: true,
    };

    // Execute query
    const orders = await Order.paginate(filter, options);

    // Format response
    return res.json(
      new ApiResponse(200, orders, "Fetched your orders successfully")
    );
  } catch (error) {
    console.error("Error fetching orders:", error);
    return handleMongoErrors(error, res);
  }
});

export const getOrderById = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid order ID format"));
    }

    const order = await Order.findOne({
      _id: orderId,
      user_id: req.user._id,
    }).lean();

    if (!order) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Order not found"));
    }

    return res.json(
      new ApiResponse(200, order, "Order details fetched successfully")
    );
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, deliveryDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid order ID format"));
    }

    const validStatuses = [
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Returned",
    ];
    if (!orderStatus || !validStatuses.includes(orderStatus)) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            `Invalid status. Must be one of: ${validStatuses.join(", ")}`
          )
        );
    }

    const updateData = { orderStatus };
    if (orderStatus === "Shipped" && !deliveryDate) {
      // Default delivery date 3 days after shipping
      updateData.deliveryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    } else if (deliveryDate) {
      updateData.deliveryDate = deliveryDate;
    }

    // const order = await Order.findOneAndUpdate(
    //   { _id: orderId, user_id: req.user._id },
    //   updateData,
    //   { new: true, runValidators: true }
    // );

    const order = await Order.findOneAndUpdate({ _id: orderId }, updateData, {
      new: true,
      runValidators: true,
    });

    if (!order) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Order not found"));
    }

    return res.json(
      new ApiResponse(200, order, "Order status updated successfully")
    );
  } catch (error) {
    console.log("Error updating order status:", error.message);
    return handleMongoErrors(error, res);
  }
});

export const updatePaymentStatus = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid order ID format"));
    }

    const validStatuses = ["Pending", "Paid", "Failed", "Refunded"];
    if (!paymentStatus || !validStatuses.includes(paymentStatus)) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            `Invalid status. Must be one of: ${validStatuses.join(", ")}`
          )
        );
    }

    // const order = await Order.findOneAndUpdate(
    //   { _id: orderId, user_id: req.user._id },
    //   { paymentStatus },
    //   { new: true, runValidators: true }
    // );

    const order = await Order.findOneAndUpdate(
      { _id: orderId },
      { paymentStatus },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Order not found"));
    }

    return res.json(
      new ApiResponse(200, order, "Payment status updated successfully")
    );
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});

export const updateTrackingNumber = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid order ID format"));
    }

    const order = await Order.findOneAndUpdate(
      { _id: orderId, user_id: req.user._id },
      { trackingNumber: generateTrackingNumber() },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Order not found"));
    }

    return res.json(
      new ApiResponse(200, order, "Tracking number updated successfully")
    );
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});

export const getOrderByTrackingNumber = asyncHandler(async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    if (!trackingNumber || trackingNumber.length !== 12) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid tracking number format"));
    }

    const order = await Order.findOne({
      trackingNumber,
      user_id: req.user._id,
    }).lean();

    if (!order) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Order not found"));
    }

    return res.json(
      new ApiResponse(200, order, "Order details fetched successfully")
    );
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});

export const cancelOrder = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid order ID format"));
    }

    if (!reason) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Cancellation reason is required"));
    }

    const order = await Order.findOne({
      _id: orderId,
      user_id: req.user._id,
    });

    if (!order) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Order not found"));
    }

    // Check if order can be cancelled
    if (!["Processing", "Confirmed", "Shipped"].includes(order.orderStatus)) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            "Order can only be cancelled if it's in Processing, Confirmed or Shipped status"
          )
        );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Update order status and set cancel reason
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId },
        {
          orderStatus: "Cancelled",
          cancelDetails: {
            reason,
            notes: notes || undefined,
          },
        },
        { new: true, session }
      );

      // 2. Restore product stock
      await Promise.all(
        updatedOrder.orderItems.map(async (item) => {
          await Product.findByIdAndUpdate(
            item.product_id,
            { $inc: { stock: item.quantity } },
            { session }
          );
        })
      );

      // 3. Refund payment if already paid
      if (updatedOrder.paymentStatus === "Paid") {
        // Implement your refund logic here
        // This might involve calling a payment gateway API
        updatedOrder.paymentStatus = "Refunded";
        await updatedOrder.save({ session });
      }

      await session.commitTransaction();

      return res.json(
        new ApiResponse(200, updatedOrder, "Order cancelled successfully")
      );
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});

export const getAllOrders = asyncHandler(async (req, res) => {
  try {
    // Admin-only endpoint
    const {
      page = 1,
      limit = 10,
      status,
      userId,
      startDate,
      endDate,
    } = req.query;

    const filter = {};
    if (status) filter.orderStatus = status;
    if (userId) filter.user_id = userId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      lean: true,
    };

    const orders = await Order.paginate(filter, options);

    return res.json(
      new ApiResponse(200, orders, "Fetched all orders successfully")
    );
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});
