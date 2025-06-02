import mongoose from "mongoose";

const blogPostSchema = new mongoose.Schema(
  {
    title: String,
    slug: String,
    content: String,
    featureImage: String,
    author_id: { type: mongoose.Schema.Types.ObjectId, refPath: "authorModel" },
    authorModel: { type: String, enum: ["User", "Admin"] },
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: "BlogCategory" },
    tags: [String],
    publishedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export default mongoose.model("BlogPost", blogPostSchema);
