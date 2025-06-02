import mongoose from "mongoose";

const blogCommentSchema = new mongoose.Schema(
  {
    blogPost_id: { type: mongoose.Schema.Types.ObjectId, ref: "BlogPost" },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: String,
    status: {
      type: String,
      enum: ["visible", "pending"],
      default: "pending",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model("BlogComment", blogCommentSchema);
