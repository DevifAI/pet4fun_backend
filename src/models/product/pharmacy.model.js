import mongoose from "mongoose";

const pharmacyProductSchema = new mongoose.Schema(
  {
    dosage: String,
    ingredients: { type: [String], default: [] },
    expiryDate: Date,
  },
  { _id: false }
);

export default pharmacyProductSchema;
