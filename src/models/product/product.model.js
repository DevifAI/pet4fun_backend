import mongoose from "mongoose";

const healthInsuranceSchema = new mongoose.Schema(
  {
    planName: String,
    coverageMths: Number,
    expiresAt: Date,
  },
  { _id: false }
);

const vaccinationSchema = new mongoose.Schema(
  {
    vaccineName: String,
    date: Date,
    nextDueDate: Date,
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    type: {
      type: String,
      enum: ["pet", "food", "toy", "care", "accessory"],
      required: true,
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    subCategory_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    tags: { type: [String], default: [] },
    relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    price: { type: Number, required: true },
    discountPrice: Number,
    stock: { type: Number, default: 0 },
    size: String,
    images: { type: [String], default: [] },
    petType: {
      type: String,
      enum: ["dog", "cat", "rabbit", "bird", "fish", "other"],
    },
    breed: String,
    dob: Date,
    color: String,
    gender: { type: String, enum: ["male", "female"] },
    availableFrom: Date,
    healthInsurance: healthInsuranceSchema,
    isVaccinated: { type: Boolean, default: false },
    vaccinations: { type: [vaccinationSchema], default: [] },
    // status: { type: String, enum: ["active", "inactive"], default: "active" }, // optional
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
