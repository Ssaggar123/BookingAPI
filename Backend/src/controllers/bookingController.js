const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Resource = require("../models/Resource");
const bookingService = require("../services/bookingService");
const { SlotError } = require("../services/slotService");

const { BookingError } = bookingService;

const handleError = (err, res, next) => {
  if (err instanceof BookingError || err instanceof SlotError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  next(err);
};

// Loads a booking + its resource and checks the caller may see it:
// the customer, the resource owner, or an admin.
const loadAuthorizedBooking = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ success: false, message: "Invalid booking id" });
    return null;
  }

  const booking = await Booking.findById(id);
  if (!booking) {
    res.status(404).json({ success: false, message: "Booking not found" });
    return null;
  }

  const resource = await Resource.findById(booking.resourceId);
  const isCustomer = booking.customerId.toString() === req.user._id.toString();
  const isResourceOwner = resource && resource.ownerId.toString() === req.user._id.toString();

  if (req.user.role !== "admin" && !isCustomer && !isResourceOwner) {
    res.status(403).json({ success: false, message: "Forbidden" });
    return null;
  }

  return { booking, resource, isResourceOwner };
};

// @route POST /api/bookings
const createBooking = async (req, res, next) => {
  try {
    const { resourceId, startTime, partySize, notes } = req.body;

    const resource = await Resource.findById(resourceId);
    if (!resource) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    const booking = await bookingService.createBooking({
      resource,
      customerId: req.user._id,
      startTime,
      partySize,
      notes,
    });

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    handleError(err, res, next);
  }
};

// @route GET /api/bookings?status=&resourceId=&from=&to=&page=&limit=
// customer -> own bookings | provider -> own bookings + bookings on their resources | admin -> all
const listBookings = async (req, res, next) => {
  try {
    const { status, resourceId, from, to, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (req.user.role === "customer") {
      filter.customerId = req.user._id;
    } else if (req.user.role === "provider") {
      const ownedIds = await Resource.find({ ownerId: req.user._id }).distinct("_id");
      filter.$or = [{ customerId: req.user._id }, { resourceId: { $in: ownedIds } }];
    }

    if (status) filter.status = status;
    if (resourceId) {
      if (!mongoose.isValidObjectId(resourceId)) {
        return res.status(400).json({ success: false, message: "Invalid resourceId" });
      }
      filter.resourceId = resourceId;
    }

    if (from || to) {
      filter.startTime = {};
      if (from) {
        const d = new Date(from);
        if (isNaN(d)) return res.status(400).json({ success: false, message: "Invalid `from` date" });
        filter.startTime.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (isNaN(d)) return res.status(400).json({ success: false, message: "Invalid `to` date" });
        filter.startTime.$lte = d;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(filter).sort({ startTime: -1 }).skip(skip).limit(Number(limit)),
      Booking.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: bookings,
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    next(err);
  }
};

// @route GET /api/bookings/:id
const getBooking = async (req, res, next) => {
  try {
    const loaded = await loadAuthorizedBooking(req, res);
    if (!loaded) return;
    res.status(200).json({ success: true, data: loaded.booking });
  } catch (err) {
    next(err);
  }
};

// Allowed manual transitions. Cancelling goes through POST /:id/cancel so capacity is released.
const TRANSITIONS = {
  pending: ["confirmed"],
  confirmed: ["completed", "no_show"],
};

// @route PATCH /api/bookings/:id   (resource owner / admin)
const updateBookingStatus = async (req, res, next) => {
  try {
    const loaded = await loadAuthorizedBooking(req, res);
    if (!loaded) return;

    const { booking, isResourceOwner } = loaded;
    if (req.user.role !== "admin" && !isResourceOwner) {
      return res.status(403).json({ success: false, message: "Only the resource owner can change status" });
    }

    const { status } = req.body;
    if (!(TRANSITIONS[booking.status] || []).includes(status)) {
      return res
        .status(409)
        .json({ success: false, message: `Cannot change status from ${booking.status} to ${status}` });
    }
    if ((status === "completed" || status === "no_show") && booking.startTime > new Date()) {
      return res
        .status(400)
        .json({ success: false, message: `Cannot mark a future booking as ${status}` });
    }

    booking.status = status;
    await booking.save();
    res.status(200).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

// @route POST /api/bookings/:id/cancel   (customer / resource owner / admin)
const cancelBooking = async (req, res, next) => {
  try {
    const loaded = await loadAuthorizedBooking(req, res);
    if (!loaded) return;

    const cancelled = await bookingService.cancelBooking({
      booking: loaded.booking,
      userId: req.user._id,
      reason: req.body.reason,
    });

    res.status(200).json({ success: true, data: cancelled });
  } catch (err) {
    handleError(err, res, next);
  }
};

module.exports = { createBooking, listBookings, getBooking, updateBookingStatus, cancelBooking };