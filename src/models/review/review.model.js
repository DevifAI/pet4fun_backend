import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    rating: { type: Number, min: 1, max: 5 },
    title: String,
    comment: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model("Review", reviewSchema);
