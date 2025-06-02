import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    slug: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.model("Category", categorySchema);
