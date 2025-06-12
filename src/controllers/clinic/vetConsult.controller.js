import VetAppointment from "../../models/vetAppoinment/appointment.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const createAppointment = asyncHandler(async (req, res) => {
  const {
    appointmentType,
    pet,
    customPetInfo,
    vetName,
    appointmentDate,
    symptoms,
    guestInfo,
  } = req.body;

  if (!appointmentType || !appointmentDate) {
    return res
      .status(400)
      .json(
        new ApiResponse(400, null, "Appointment type and date are required")
      );
  }

  const appointment = await VetAppointment.create({
    user_id: req.user?._id,
    guestInfo,
    appointmentType,
    pet,
    customPetInfo,
    vetName,
    appointmentDate,
    symptoms,
  });

  res
    .status(201)
    .json(new ApiResponse(201, appointment, "Appointment created"));
});

export const getMyAppointments = asyncHandler(async (req, res) => {
  const appointments = await VetAppointment.find({
    user_id: req.user._id,
  }).sort({ appointmentDate: -1 });
  res.json(new ApiResponse(200, appointments, "Fetched appointments"));
});

export const getAppointmentById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const appointment = await VetAppointment.findOne({
    _id: id,
    user_id: req.user._id,
  });

  if (!appointment) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Appointment not found"));
  }

  res.json(new ApiResponse(200, appointment, "Fetched appointment"));
});

export const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const appointment = await VetAppointment.findById(id);
  if (!appointment)
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Appointment not found"));

  appointment.status = status;
  await appointment.save();

  res.json(new ApiResponse(200, appointment, "Status updated"));
});

export const deleteAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const appointment = await VetAppointment.findOne({
    _id: id,
    user_id: req.user._id,
  });
  if (!appointment)
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Appointment not found"));

  if (appointment.status === "confirmed")
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Cannot delete confirmed appointment"));

  await VetAppointment.deleteOne({ _id: id });
  res.json(new ApiResponse(200, null, "Appointment deleted"));
});
