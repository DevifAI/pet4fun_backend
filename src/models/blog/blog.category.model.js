import mongoose from "mongoose";

const blogCategorySchema = new mongoose.Schema({
  name: String,
  slug: String,
});

export default mongoose.model("BlogCategory", blogCategorySchema);
