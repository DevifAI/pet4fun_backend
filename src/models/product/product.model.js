import mongoose from "mongoose";
import pharmacyProductSchema from "./pharmacy.model.js";
import vaccinationSchema from "./vaccination.model.js";
import healthInsuranceSchema from "./healthInsurance.model.js";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,

    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    subCategory_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: true,
      index: true,
    },
    childSubCategory_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChildSubCategory",
      index: true,
    },

    price: { type: Number, required: true },
    discountPrice: Number,
    stock: { type: Number, default: 0 },
    size: String,
    color: String,
    images: { type: [String], default: [] },

    breed: {
      type: String,
      default: "",
    },
    gender: {
      type: String,
      enum: ["male", "female", ""],
      default: "",
    },
    dob: Date,

    availableFrom: Date,

    isVaccinated: { type: Boolean, default: false },
    vaccinations: { type: [vaccinationSchema], default: [] },
    healthInsurance: healthInsuranceSchema,

    pharmacyDetails: pharmacyProductSchema, // now enriched schema

    relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    tags: { type: [String], default: [] },

    filterAttributes: {
      type: Map,
      of: [String],
      default: {},
    },

    bestSeller: { type: Boolean, default: false },
    popular: { type: Boolean, default: false },
    onSale: { type: Boolean, default: false },

    status: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
