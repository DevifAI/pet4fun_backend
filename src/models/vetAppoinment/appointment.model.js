import mongoose from "mongoose";

const vetConsultationSchema = new mongoose.Schema(
  {
    // Pet Information
    petName: {
      type: String,
      required: [true, "Pet name is required"],
      trim: true,
    },
    petType: {
      type: String,
      required: [true, "Pet type is required"],
      enum: ["dog", "cat", "bird", "rabbit", "reptile", "other"],
      lowercase: true,
    },
    age: {
      type: Number,
      min: 0,
      max: 30,
    },
    symptoms: {
      type: String,
      required: [true, "Symptoms/Reason is required"],
      trim: true,
    },

    // Owner Information
    ownerName: {
      type: String,
      required: [true, "Owner name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [/.+\@.+\..+/, "Please enter a valid email"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },

    // Appointment Details
    preferredDate: {
      type: Date,
      required: [true, "Preferred date is required"],
      min: Date.now,
    },
    preferredTime: {
      type: String,
      required: [true, "Preferred time is required"],
      enum: ["morning", "afternoon", "evening"],
    },
    urgency: {
      type: String,
      required: true,
      enum: ["normal", "urgent", "emergency"],
      default: "normal",
    },

    // Additional Information
    additionalInfo: {
      type: String,
      trim: true,
    },

    // System Fields
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
vetConsultationSchema.index({ preferredDate: 1 });
vetConsultationSchema.index({ status: 1 });
vetConsultationSchema.index({ email: 1 });

const VetConsultation = mongoose.model(
  "VetConsultation",
  vetConsultationSchema
);

export default VetConsultation;
