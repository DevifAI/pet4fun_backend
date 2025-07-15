import mongoose from "mongoose";
import addressSchema from "../order/address.model.js";

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    phone: String,
    address: addressSchema,
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
