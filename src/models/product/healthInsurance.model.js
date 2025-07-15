import mongoose from "mongoose";

const healthInsuranceSchema = new mongoose.Schema(
  {
    planName: { type: String },
    coverageMths: Number,
    expiresAt: Date,
  },
  { _id: false }
);

export default healthInsuranceSchema;
