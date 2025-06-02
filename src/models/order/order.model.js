import mongoose from "mongoose";

// models/Order.js
const orderItemSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    quantity: Number,
    price: Number,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    orderItems: [orderItemSchema],
    totalAmount: Number,
    shippingAddress: addressSchema,
    paymentMethod: { type: String, enum: ["COD", "ONLINE"] },
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
