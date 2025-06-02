import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: String,
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null,
  },
  slug: String,
});

export default mongoose.model("Category", categorySchema);
