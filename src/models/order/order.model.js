import mongoose from "mongoose";
import orderItemSchema from './orderItem.model.js';
import addressSchema from './address.model.js';


// Main Order Schema
const orderSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    orderItems: [orderItemSchema],
    totalAmount: Number,
    shippingAddress: addressSchema,
    paymentMethod: { type: String, enum: ["COD", "ONLINE"], required: true },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Pending",
    },
    orderStatus: {
      type: String,
      enum: ["Processing", "Shipped", "Delivered"],
      default: "Processing",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
