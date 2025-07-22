import VetConsultation from "../../models/vetAppoinment/appointment.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import handleMongoErrors from "../../utils/mongooseError.js";

// @desc    Create new veterinary consultation
// @route   POST /api/vet-consultations
// @access  Public
export const createConsultation = asyncHandler(async (req, res) => {
  const {
    petName,
    petType,
    age,
    symptoms,
    ownerName,
    email,
    phone,
    preferredDate,
    preferredTime,
    urgency,
    additionalInfo,
  } = req.body;

  // Basic validation (more validation is handled by the model)
  if (
    !petName ||
    !petType ||
    !symptoms ||
    !ownerName ||
    !email ||
    !phone ||
    !preferredDate ||
    !preferredTime
  ) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Required fields are missing"));
  }

  try {
    const consultation = await VetConsultation.create({
      petName,
      petType,
      age,
      symptoms,
      ownerName,
      email,
      phone,
      preferredDate: new Date(preferredDate),
      preferredTime,
      urgency,
      additionalInfo,
    });

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          consultation,
          "Consultation request created successfully"
        )
      );
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});

// @desc    Get all veterinary consultations with optional filtering
// @route   GET /api/vet-consultations
// @access  Private (Admin)
export const getAllConsultations = asyncHandler(async (req, res) => {
  try {
    const {
      status,
      petType,
      urgency,
      fromDate,
      toDate,
      dateFilter,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    // Build the filter object
    const filter = {};

    // Status filter
    if (status && status !== "all") {
      filter.status = status;
    }

    // Pet type filter
    if (petType && petType !== "all") {
      filter.petType = petType;
    }

    // Urgency filter
    if (urgency && urgency !== "all") {
      filter.urgency = urgency;
    }

    // Handle date filtering
    if (dateFilter || fromDate || toDate) {
      filter.preferredDate = {};

      // Handle predefined date ranges
      if (dateFilter) {
        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));

        if (dateFilter === "today") {
          const todayEnd = new Date(todayStart);
          todayEnd.setHours(23, 59, 59, 999);
          filter.preferredDate.$gte = todayStart;
          filter.preferredDate.$lte = todayEnd;
        } else if (dateFilter === "week") {
          const weekAgo = new Date(todayStart);
          weekAgo.setDate(weekAgo.getDate() - 6); // Last 7 days (including today)
          filter.preferredDate.$gte = weekAgo;
          filter.preferredDate.$lte = new Date(); // Current time
        } else if (dateFilter === "month") {
          const monthAgo = new Date(todayStart);
          monthAgo.setDate(monthAgo.getDate() - 29); // Last 30 days (including today)
          filter.preferredDate.$gte = monthAgo;
          filter.preferredDate.$lte = new Date(); // Current time
        }
      }

      // Handle custom date range (overrides predefined if both exist)
      if (fromDate) {
        const fromDateObj = new Date(fromDate);
        fromDateObj.setHours(0, 0, 0, 0);
        filter.preferredDate.$gte = fromDateObj;
      }
      if (toDate) {
        const toDateObj = new Date(toDate);
        toDateObj.setHours(23, 59, 59, 999);
        filter.preferredDate.$lte = toDateObj;
      }
    }

    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [{ petName: searchRegex }, { ownerName: searchRegex }];
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await VetConsultation.countDocuments(filter);

    // Get paginated results with default sorting by newest first
    const consultations = await VetConsultation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return res.status(200).json({
      success: true,
      data: consultations,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      message: "Consultations retrieved successfully",
    });
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});

// @desc    Get consultation by ID
// @route   GET /api/vet-consultations/:id
// @access  Private (Admin)
export const getConsultationById = asyncHandler(async (req, res) => {
  try {
    const consultation = await VetConsultation.findById(req.params.id);

    if (!consultation) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Consultation not found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          consultation,
          "Consultation retrieved successfully"
        )
      );
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});

// @desc    Update consultation status
// @route   PATCH /api/vet-consultations/:id/status
// @access  Private (Admin)
export const updateConsultationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (
    !status ||
    !["pending", "confirmed", "completed", "cancelled"].includes(status)
  ) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid status value"));
  }

  try {
    const consultation = await VetConsultation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!consultation) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Consultation not found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          consultation,
          "Consultation status updated successfully"
        )
      );
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});

// @desc    Delete a consultation
// @route   DELETE /api/vet-consultations/:id
// @access  Private (Admin)
export const deleteConsultation = asyncHandler(async (req, res) => {
  try {
    const consultation = await VetConsultation.findByIdAndDelete(req.params.id);

    if (!consultation) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Consultation not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Consultation deleted successfully"));
  } catch (error) {
    return handleMongoErrors(error, res);
  }
});
