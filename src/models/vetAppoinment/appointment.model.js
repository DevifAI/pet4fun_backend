import mongoose from "mongoose";

const vetAppointmentSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    guestInfo: {
      name: String,
      phone: String,
      email: String,
    },
    appointmentType: {
      type: String,
      enum: ["vet", "grooming"],
      required: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product", // assuming Product is used for pets
      required: false,
    },
    customPetInfo: {
      name: String,
      petType: {
        type: String,
        enum: ["dog", "cat", "rabbit", "bird", "fish", "other"],
      },
      breed: String,
      age: String,
      gender: { type: String, enum: ["male", "female"] },
      color: String,
    },
    vetName: String,
    appointmentDate: Date,
    symptoms: String,
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model("VetAppointment", vetAppointmentSchema);
