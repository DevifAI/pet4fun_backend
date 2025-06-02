import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    phone: String,
    address: addressSchema,
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
