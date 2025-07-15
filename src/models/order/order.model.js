import mongoose from "mongoose";
import orderItemSchema from "./orderItem.model.js";
import addressSchema from "./address.model.js";
import mongoosePaginate from "mongoose-paginate-v2";

const cancelReasonSchema = new mongoose.Schema({
  reason: {
    type: String,
    required: true,
    enum: [
      "Changed my mind",
      "Found better price elsewhere",
      "Shipping takes too long",
      "Ordered by mistake",
      "Product not required anymore",
      "Other",
    ],
  },
  notes: {
    type: String,
    maxlength: 500,
  },
  cancelledAt: {
    type: Date,
    default: Date.now,
  },
});

const orderSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    orderItems: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function (v) {
          return v.length > 0;
        },
        message: "Order must have at least one item",
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingAddress: {
      type: addressSchema,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "ONLINE", "WALLET"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },
    orderStatus: {
      type: String,
      enum: ["Processing", "Shipped", "Delivered", "Cancelled", "Returned"],
      default: "Processing",
    },
    trackingNumber: {
      type: String,
      unique: true,
    },
    deliveryDate: Date,
    notes: String,
    couponUsed: {
      code: String,
      discount: Number,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    shippingFee: {
      type: Number,
      default: 0,
    },
    cancelDetails: cancelReasonSchema, // Added cancel reason schema
    confirmedAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for formatted order date
orderSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

// Status change tracking
orderSchema.pre("save", function (next) {
  if (this.isModified("orderStatus")) {
    switch (this.orderStatus) {
      case "Confirmed":
        this.confirmedAt = new Date();
        break;
      case "Shipped":
        this.shippedAt = new Date();
        break;
      case "Delivered":
        this.deliveredAt = new Date();
        break;
      case "Cancelled":
        this.cancelledAt = new Date();
        break;
    }
  }
  next();
});

orderSchema.plugin(mongoosePaginate);
// Indexes
orderSchema.index({ user_id: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ trackingNumber: 1 });

export default mongoose.model("Order", orderSchema);
