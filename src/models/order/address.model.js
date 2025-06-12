import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    fullName: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postalCode: String,
    country: { type: String, default: "India" },
  },
  { _id: false }
);


export default addressSchema;