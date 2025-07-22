import crypto from "crypto";
import axios from "axios";
import config from "../config/easebuzz.js";
import Order from "../models/order/order.model.js";
import Cart from "../models/cart/cart.model.js";
import Product from "../models/product/product.model.js";
import mongoose from "mongoose";

// Enhanced payment initiation with better error handling
export const initiateEasebuzzPayment = async (order, user, session) => {
  // Validate input parameters
  if (!order || !user || !session) {
    throw new Error("Missing required parameters");
  }

  try {
    // 1. Verify order exists in database within the current session
    const existingOrder = await Order.findById(order._id).session(session);
    if (!existingOrder) {
      throw new Error("Order not found in database");
    }

    // 2. Validate all required fields
    const requiredFields = [
      "orderNumber",
      "totalAmount",
      "shippingAddress",
      "_id",
    ];
    const missingFields = requiredFields.filter((field) => !order[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing order fields: ${missingFields.join(", ")}`);
    }

    if (!user.email) {
      throw new Error("User email is required");
    }

    // 3. Prepare payment request
    const paymentParams = {
      key: config.key,
      txnid: order.orderNumber,
      amount: order.totalAmount.toFixed(2),
      firstname: user.name || "Customer",
      email: user.email,
      phone: order.shippingAddress.phone || "0000000000",
      productinfo: `Order ${order.orderNumber}`,
      surl: `${config.frontend_url}/payment/success?orderId=${order._id}`,
      furl: `${config.frontend_url}/payment/failure?orderId=${order._id}`,
      service_provider: "payu_paisa",
    };

    // 4. Generate secure hash
    const hashString = [
      paymentParams.key,
      paymentParams.txnid,
      paymentParams.amount,
      paymentParams.productinfo,
      paymentParams.firstname,
      paymentParams.email,
      "", // udf1
      "", // udf2
      "", // udf3
      "", // udf4
      "", // udf5
      "", // udf6
      "", // udf7
      "", // udf8
      "", // udf9
      "", // udf10
      config.salt,
    ].join("|");

    paymentParams.hash = crypto
      .createHash("sha512")
      .update(hashString)
      .digest("hex")
      .toLowerCase();

    // 5. Make API request to payment gateway
    const response = await axios.post(
      `${config.base_url}/payment/initiateLink`,
      new URLSearchParams(paymentParams),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000, // 15 second timeout
      }
    );

    // 6. Validate payment gateway response
    if (!response.data || typeof response.data !== "object") {
      throw new Error("Invalid response from payment gateway");
    }

    if (response.data.status !== 1 || !response.data.data?.link) {
      const errorMsg =
        response.data.error_desc ||
        response.data.message ||
        "Payment initiation failed";
      throw new Error(errorMsg);
    }

    // Construct the payment URL using the transaction hash
    const paymentUrl = `${config.base_url}/pay/${response.data.data}`;

    console.log("Constructed payment URL:", paymentUrl); // Debug log

    // 7. Update order status
    await Order.findByIdAndUpdate(
      order._id,
      {
        $set: {
          paymentStatus: "Initiated",
          paymentInitiatedAt: new Date(),
        },
      },
      { session, new: true }
    );

    // 8. Return success response with proper URL
    return {
      success: true,
      paymentUrl: paymentUrl,
      order: existingOrder,
      gatewayResponse: {
        status: response.data.status,
        message: response.data.message,
        transactionId: response.data.data.txnid,
      },
    };
  } catch (error) {
    console.error("Payment initiation error:", {
      error: error.message,
      orderId: order?._id,
      userId: user?._id,
      stack: error.stack,
    });

    // Convert axios errors to more readable messages
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // Server responded with non-2xx status
        throw new Error(
          `Payment gateway error: ${
            error.response.data?.error_desc ||
            error.response.data?.message ||
            error.response.statusText
          }`
        );
      } else if (error.request) {
        // No response received
        throw new Error("Payment gateway is not responding");
      }
    }

    // Re-throw the error for the calling function to handle
    throw error;
  }
};

// Enhanced callback handler
export const handleEasebuzzCallback = async (callbackData) => {
  // Verify hash first
  const hashString = `${config.salt}|${callbackData.status}|||||||||||${callbackData.email}|${callbackData.firstname}|${callbackData.productinfo}|${callbackData.amount}|${callbackData.txnid}|${callbackData.key}`;
  const generatedHash = crypto
    .createHash("sha512")
    .update(hashString)
    .digest("hex");

  if (generatedHash !== callbackData.hash) {
    console.error("Hash verification failed");
    return { success: false, message: "Invalid hash - potential tampering" };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const statusUpdate =
      callbackData.status === "success"
        ? { paymentStatus: "Paid", orderStatus: "Processing" }
        : { paymentStatus: "Failed", orderStatus: "Cancelled" };

    const order = await Order.findOneAndUpdate(
      { orderNumber: callbackData.txnid },
      { $set: statusUpdate },
      { new: true, session }
    );

    if (!order) {
      await session.abortTransaction();
      return { success: false, message: "Order not found" };
    }

    if (callbackData.status === "success") {
      // Clear user's cart
      await Cart.findOneAndUpdate(
        { user_id: order.user_id },
        { $set: { items: [] } },
        { session }
      );

      await session.commitTransaction();
      return { success: true, order };
    } else {
      // Payment failed - restore product stock
      await Promise.all(
        order.orderItems.map(async (item) => {
          await Product.findByIdAndUpdate(
            item.product_id,
            { $inc: { stock: item.quantity } },
            { session }
          );
        })
      );

      // Update order status
      order.orderStatus = "Cancelled";
      await order.save({ session });

      await session.commitTransaction();
      return { success: false, order, message: "Payment failed" };
    }
  } catch (error) {
    await session.abortTransaction();
    console.error("Payment callback processing error:", error);
    return { success: false, message: "Error processing payment callback" };
  } finally {
    session.endSession();
  }
};
