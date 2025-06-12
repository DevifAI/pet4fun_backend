import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    attributes: {
      type: Map,
      of: [String], // key will be String, value will be array of Strings
      default: {},
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("SubCategory", subCategorySchema);
