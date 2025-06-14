import mongoose from "mongoose";

const childSubCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // e.g., "Dry Food", "Large Breed", etc.
    slug: { type: String, required: true, unique: true }, // for URL use

    parentSubCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubCategory",
        required: true,
        index: true,
      },
    ],

    attributes: {
      type: Map,
      of: [String],
      default: {},
    },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("ChildSubCategory", childSubCategorySchema);
