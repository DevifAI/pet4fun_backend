import mongoose from "mongoose";

const serviceTypes = [
  {
    name: "Consultation",
  },
  {
    name: "Vaccination",
  },
  {
    name: "Grooming",
  },
  {
    name: "Deworming",
  },
  {
    name: "Surgery",
  },
  {
    name: "Diagnostics",
  },
];

const clinicAppointmentSchema = new mongoose.Schema(
  {
    // Patient Information
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
      match: [/^[0-9]{10}$/, "Please enter a valid 10-digit mobile number"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [/.+\@.+\..+/, "Please enter a valid email"],
    },

    // Appointment Details
    serviceType: {
      type: String,
      required: [true, "Service type is required"],
      enum: serviceTypes.map((service) => service.name),
    },
    preferredDate: {
      type: Date,
      required: [true, "Preferred date is required"],
      min: Date.now,
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
clinicAppointmentSchema.index({ preferredDate: 1 });
clinicAppointmentSchema.index({ status: 1 });
clinicAppointmentSchema.index({ email: 1 });

const ClinicAppointment = mongoose.model(
  "ClinicAppointment",
  clinicAppointmentSchema
);

export default ClinicAppointment;
