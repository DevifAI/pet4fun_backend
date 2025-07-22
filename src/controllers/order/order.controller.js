import mongoose from "mongoose";
import Order from "../../models/order/order.model.js";
import Cart from "../../models/cart/cart.model.js";
import Product from "../../models/product/product.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import handleMongoErrors from "../../utils/mongooseError.js";
import { initiateEasebuzzPayment } from "../../services/paymentService.js";

const generateTrackingNumber = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

async function generateUniqueTrackingNumber(session) {
  let trackingNumber;
  let isUnique = false;

  while (!isUnique) {
    trackingNumber = generateTrackingNumber();
    const exists = await Order.findOne({ trackingNumber }).session(session);
    if (!exists) isUnique = true;
  }

  return trackingNumber;
}

const generateOrderNumber = async () => {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `ORD-${timestamp}-${randomNum}`;
};

async function restoreProductStock(orderItems, session) {
  try {
    // Update stock for each product in the order
    const bulkOps = orderItems.map((item) => ({
      updateOne: {
        filter: { _id: item.product_id },
        update: { $inc: { stock: item.quantity } },
      },
    }));

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps, { session });
    }
  } catch (error) {
    console.error("Error restoring product stock:", error);
    throw error; // Let the calling function handle this
  }
}

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

  // Validate payment method
  if (!["COD", "ONLINE"].includes(paymentMethod)) {
    return res
      .status(400)
      .json(
        new ApiResponse(
          400,
          null,
          "Invalid payment method. Must be COD or ONLINE"
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
    // 1. Verify cart exists with items
    const cart = await Cart.findOne({ user_id: userId }).session(session);
    if (!cart?.items?.length) {
      await session.abortTransaction();
      return res.status(400).json(new ApiResponse(400, null, "Cart is empty"));
    }

    // 2. Process cart items and check stock
    let totalAmount = 0;
    let taxAmount = 0;
    let shippingFee = 0;
    const orderItems = [];
    const outOfStockItems = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.product_id).session(session);

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

      const { _id, createdAt, updatedAt, __v, ...cleanProduct } =
        product.toObject();
      const subtotal = product.price * item.quantity;

      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        productSnapshot: cleanProduct,
        price: product.price,
        subtotal,
      });

      totalAmount += subtotal;
      taxAmount += subtotal * 0.1; // 10% tax

      // Reserve product stock
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

    // 3. Calculate final amounts
    shippingFee = totalAmount < 100 ? 5 : 0;
    totalAmount += taxAmount + shippingFee;

    // 4. Generate unique order identifiers
    const orderNumber = await generateOrderNumber();
    const trackingNumber = await generateUniqueTrackingNumber(session);

    // 5. Create the order document
    const orderDoc = new Order({
      user_id: userId,
      orderNumber,
      orderItems,
      totalAmount,
      taxAmount,
      shippingFee,
      shippingAddress,
      paymentMethod,
      paymentStatus: "Pending",
      orderStatus: "Processing",
      trackingNumber,
      notes,
      couponUsed: couponCode ? { code: couponCode, discount: 10 } : null,
    });

    // 6. Save the order within the transaction
    await orderDoc.save({ session });

    // 7. Handle payment based on method
    if (paymentMethod === "COD") {
      // Clear cart for COD orders
      await Cart.findOneAndUpdate(
        { user_id: userId },
        { $set: { items: [] } },
        { session }
      );

      await session.commitTransaction();
      return res
        .status(201)
        .json(new ApiResponse(201, orderDoc, "Order created successfully"));
    } else {
      // ONLINE payment - initiate payment flow
      const paymentResult = await initiateEasebuzzPayment(
        orderDoc,
        req.user,
        session
      );

      console.log(paymentResult.paymentUrl)

      if (!paymentResult.success) {
        // Restore product stock if payment initiation fails
        await restoreProductStock(orderDoc.orderItems, session);
        await session.abortTransaction();

        return res
          .status(400)
          .json(
            new ApiResponse(
              400,
              { error: paymentResult.error },
              paymentResult.message
            )
          );
      }

      // Ensure we have a valid payment URL
      if (!paymentResult.paymentUrl) {
        await restoreProductStock(orderDoc.orderItems, session);
        await session.abortTransaction();

        return res
          .status(500)
          .json(new ApiResponse(500, null, "Failed to generate payment URL"));
      }

      await session.commitTransaction();
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            order: orderDoc,
            payment_url: paymentResult.paymentUrl, // Send the raw URL string
          },
          "Payment initiated successfully"
        )
      );
    }
  } catch (error) {
    await session.abortTransaction();
    console.error("Order creation error:", error);

    // Handle specific MongoDB errors
    if (error.name === "MongoError" && error.code === 11000) {
      return res
        .status(409)
        .json(
          new ApiResponse(
            409,
            null,
            "Duplicate order detected. Please try again."
          )
        );
    }

    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal server error"));
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
