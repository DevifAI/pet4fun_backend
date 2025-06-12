import mongoose from "mongoose";

const breedSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Breed", breedSchema);
