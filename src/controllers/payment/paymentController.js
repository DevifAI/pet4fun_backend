import Order from "../../models/order/order.model.js";
import {
  initiateEasebuzzPayment,
  handleEasebuzzCallback,
} from "../../services/paymentService.js";
import ApiResponse from "../../utils/ApiResponse.js";

export const initiatePayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.body;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      await session.abortTransaction();
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid Order ID"));
    }

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Order not found"));
    }

    const result = await initiateEasebuzzPayment(order, req.user, session);

    if (result.success) {
      await session.commitTransaction();
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            payment_url: result.paymentUrl,
            order: result.order,
          },
          "Payment initiated successfully"
        )
      );
    } else {
      await session.abortTransaction();
      return res.status(400).json(new ApiResponse(400, null, result.message));
    }
  } catch (error) {
    await session.abortTransaction();
    console.error("Payment initiation error:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal server error"));
  } finally {
    session.endSession();
  }
};

export const paymentCallback = async (req, res) => {
  try {
    const result = await handleEasebuzzCallback(req.query); // Using query params for GET callbacks

    if (result.success) {
      // Redirect to frontend success page
      return res.redirect(
        `${config.frontend_url}/order-success?orderId=${result.order._id}`
      );
    } else {
      // Redirect to frontend failure page
      return res.redirect(
        `${config.frontend_url}/order-failed?orderId=${
          result.order?._id
        }&message=${encodeURIComponent(result.message)}`
      );
    }
  } catch (error) {
    console.error("Payment callback error:", error);
    return res.redirect(
      `${config.frontend_url}/order-failed?message=${encodeURIComponent(
        "Error processing payment"
      )}`
    );
  }
};
