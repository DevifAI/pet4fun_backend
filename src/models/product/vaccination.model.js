import mongoose from "mongoose";

const vaccinationSchema = new mongoose.Schema(
  {
    vaccineName: { type: String, required: true },
    date: { type: Date, required: true },
    nextDueDate: Date,
  },
  { _id: false }
);

export default vaccinationSchema;
