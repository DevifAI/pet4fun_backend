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
    name: String,
    description: String,
    type: { type: String, enum: ["pet", "food", "toy", "care", "accessory"] },
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    subCategory_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    tags: [String],
    relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    price: Number,
    discountPrice: Number,
    stock: Number,
    size: String,
    images: [String],
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
    isVaccinated: Boolean,
    vaccinations: [vaccinationSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
