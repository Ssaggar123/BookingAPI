const mongoose = require("mongoose");
const { DateTime } = require("luxon");
const Availability = require("../models/Availability");
const Exception = require("../models/Exception");
const { getOpenSlots, SlotError, toMinutes } = require("../services/slotService");

const isValidId = (id) => mongoose.isValidObjectId(id);

// Does a candidate rule overlap an existing rule on the same weekday?
const overlapsExisting = async ({ resourceId, dayOfWeek, startTime, endTime, excludeId }) => {
  const filter = { resourceId, dayOfWeek };
  if (excludeId) filter._id = { $ne: excludeId };

  const existing = await Availability.find(filter).lean();
  const s = toMinutes(startTime);
  const e = toMinutes(endTime);
  return existing.some((r) => s < toMinutes(r.endTime) && e > toMinutes(r.startTime));
};

// ---------- Open slots ----------
// @route GET /api/resources/:resourceId/availability?from=&to=&partySize=   (public)
const getSlots = async (req, res, next) => {
  try {
    const { resource } = req;
    const zone = resource.timezone;

    const today = DateTime.now().setZone(zone);
    const from = req.query.from || today.toISODate();
    const to = req.query.to || DateTime.fromISO(from, { zone }).plus({ days: 6 }).toISODate();
    const partySize = Number(req.query.partySize) || 1;

    if (!resource.isActive) {
      return res.status(404).json({ success: false, message: "Resource is not active" });
    }

    const data = await getOpenSlots({ resource, from, to, partySize });
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err instanceof SlotError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ---------- Weekly rules ----------
// @route GET /api/resources/:resourceId/availability/rules   (public)
const listRules = async (req, res, next) => {
  try {
    const rules = await Availability.find({ resourceId: req.resource._id }).sort({
      dayOfWeek: 1,
      startTime: 1,
    });
    res.status(200).json({ success: true, data: rules });
  } catch (err) {
    next(err);
  }
};

// @route POST /api/resources/:resourceId/availability   (owner/admin)
const createRule = async (req, res, next) => {
  try {
    const { dayOfWeek, startTime, endTime, slotDurationMins, isActive } = req.body;

    if (await overlapsExisting({ resourceId: req.resource._id, dayOfWeek, startTime, endTime })) {
      return res
        .status(409)
        .json({ success: false, message: "Overlaps an existing availability window on that day" });
    }

    const rule = await Availability.create({
      resourceId: req.resource._id,
      dayOfWeek,
      startTime,
      endTime,
      slotDurationMins,
      isActive,
    });

    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
};

// @route PATCH /api/resources/:resourceId/availability/:availabilityId   (owner/admin)
const updateRule = async (req, res, next) => {
  try {
    const { availabilityId } = req.params;
    if (!isValidId(availabilityId)) {
      return res.status(400).json({ success: false, message: "Invalid availability id" });
    }

    const rule = await Availability.findOne({ _id: availabilityId, resourceId: req.resource._id });
    if (!rule) {
      return res.status(404).json({ success: false, message: "Availability rule not found" });
    }

    Object.assign(rule, req.body);

    if (toMinutes(rule.endTime) <= toMinutes(rule.startTime)) {
      return res.status(400).json({ success: false, message: "endTime must be after startTime" });
    }

    if (
      await overlapsExisting({
        resourceId: req.resource._id,
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        excludeId: rule._id,
      })
    ) {
      return res
        .status(409)
        .json({ success: false, message: "Overlaps an existing availability window on that day" });
    }

    await rule.save();
    res.status(200).json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
};

// @route DELETE /api/resources/:resourceId/availability/:availabilityId   (owner/admin)
const deleteRule = async (req, res, next) => {
  try {
    const { availabilityId } = req.params;
    if (!isValidId(availabilityId)) {
      return res.status(400).json({ success: false, message: "Invalid availability id" });
    }

    const rule = await Availability.findOneAndDelete({
      _id: availabilityId,
      resourceId: req.resource._id,
    });
    if (!rule) {
      return res.status(404).json({ success: false, message: "Availability rule not found" });
    }

    res.status(200).json({ success: true, message: "Availability rule deleted" });
  } catch (err) {
    next(err);
  }
};

// ---------- Exceptions (blackouts / special hours) ----------
// @route GET /api/resources/:resourceId/exceptions?from=&to=   (public)
const listExceptions = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const filter = { resourceId: req.resource._id };

    if (from) filter.endDate = { $gte: from };
    if (to) filter.date = { $lte: to };

    const exceptions = await Exception.find(filter).sort({ date: 1 });
    res.status(200).json({ success: true, data: exceptions });
  } catch (err) {
    next(err);
  }
};

// @route POST /api/resources/:resourceId/exceptions   (owner/admin)
const createException = async (req, res, next) => {
  try {
    const { type, date, endDate, fullDay, startTime, endTime, reason } = req.body;

    const exception = await Exception.create({
      resourceId: req.resource._id,
      type,
      date,
      endDate,
      fullDay,
      startTime,
      endTime,
      reason,
    });

    res.status(201).json({ success: true, data: exception });
  } catch (err) {
    next(err);
  }
};

// @route DELETE /api/resources/:resourceId/exceptions/:exceptionId   (owner/admin)
const deleteException = async (req, res, next) => {
  try {
    const { exceptionId } = req.params;
    if (!isValidId(exceptionId)) {
      return res.status(400).json({ success: false, message: "Invalid exception id" });
    }

    const exception = await Exception.findOneAndDelete({
      _id: exceptionId,
      resourceId: req.resource._id,
    });
    if (!exception) {
      return res.status(404).json({ success: false, message: "Exception not found" });
    }

    res.status(200).json({ success: true, message: "Exception deleted" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSlots,
  listRules,
  createRule,
  updateRule,
  deleteRule,
  listExceptions,
  createException,
  deleteException,
};