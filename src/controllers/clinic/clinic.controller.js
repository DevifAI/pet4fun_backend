import ClinicAppointment from "../../models/clinic/clinic.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import handleMongoErrors from "../../utils/mongooseError.js";

// @desc    Create new clinic appointment
// @route   POST /api/clinic-appointments
// @access  Public
export const createClinicAppointment = asyncHandler(async (req, res) => {
  const { fullName, mobileNumber, email, serviceType, preferredDate } =
    req.body;

  // Basic validation
  if (!fullName || !mobileNumber || !email || !serviceType || !preferredDate) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "All fields are required"));
  }

  try {
    const appointment = await ClinicAppointment.create({
      fullName,
      mobileNumber,
      email,
      serviceType,
      preferredDate: new Date(preferredDate),
    });

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          appointment,
          "Clinic appointment created successfully"
        )
      );
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});

// @desc    Get all clinic appointments
// @route   GET /api/clinic-appointments
// @access  Private (Admin)
export const getAllClinicAppointments = asyncHandler(async (req, res) => {
  try {
    const {
      status,
      serviceType,
      fromDate,
      toDate,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    // Status filter
    if (status) filter.status = status;

    // Service type filter
    if (serviceType) filter.serviceType = serviceType;

    // Date range filter
    if (fromDate || toDate) {
      filter.preferredDate = {};
      if (fromDate) filter.preferredDate.$gte = new Date(fromDate);
      if (toDate) filter.preferredDate.$lte = new Date(toDate);
    }

    // Search functionality (matches frontend's search by name, phone, email)
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { fullName: searchRegex },
        { mobileNumber: searchRegex },
        { email: searchRegex },
      ];
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await ClinicAppointment.countDocuments(filter);

    // Get paginated results
    const appointments = await ClinicAppointment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return res.status(200).json({
      success: true,
      data: appointments,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      message: "Clinic appointments retrieved successfully",
    });
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});

// @desc    Get appointment by ID
// @route   GET /api/clinic-appointments/:id
// @access  Private (Admin)
export const getAppointmentById = asyncHandler(async (req, res) => {
  try {
    const appointment = await ClinicAppointment.findById(req.params.id);

    if (!appointment) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Appointment not found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, appointment, "Appointment retrieved successfully")
      );
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});

// @desc    Update appointment status
// @route   PATCH /api/clinic-appointments/:id/status
// @access  Private (Admin)
export const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!["pending", "confirmed", "completed", "cancelled"].includes(status)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid status value"));
  }

  try {
    const appointment = await ClinicAppointment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!appointment) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Appointment not found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          appointment,
          "Appointment status updated successfully"
        )
      );
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});

// @desc    Delete appointment
// @route   DELETE /api/clinic-appointments/:id
// @access  Private (Admin)
export const deleteAppointment = asyncHandler(async (req, res) => {
  try {
    const appointment = await ClinicAppointment.findByIdAndDelete(
      req.params.id
    );

    if (!appointment) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Appointment not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Appointment deleted successfully"));
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});
