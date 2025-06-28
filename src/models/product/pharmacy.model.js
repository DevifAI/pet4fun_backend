import mongoose from "mongoose";

const pharmacyProductSchema = new mongoose.Schema(
  {
    manufacturer: { type: String },
    composition: { type: [String], default: [] }, // optional alias for ingredients
    dosage: { type: String },
    instructions: { type: String },
    prescriptionRequired: { type: Boolean, default: false },

    type: {
      type: String,
      enum: ["tablet", "syrup", "injection", "drops", "spray", "others"],
      default: "tablet",
    },

    ingredients: { type: [String], default: [] },
    expiryDate: { type: Date },
  },
  { _id: false }
);

export default pharmacyProductSchema;
