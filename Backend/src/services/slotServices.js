const mongoose = require("mongoose");
const { DateTime } = require("luxon");
const Availability = require("../models/Availability");
const Exception = require("../models/Exception");

const MAX_RANGE_DAYS = 31;

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && aEnd > bStart;

class SlotError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Exceptions whose [date, endDate] range covers the given "YYYY-MM-DD"
const exceptionsForDate = (exceptions, dateStr) =>
  exceptions.filter((e) => e.date <= dateStr && dateStr <= (e.endDate || e.date));

/**
 * Resolve the bookable windows for one calendar day.
 * Precedence:  full-day blackout  >  special_hours  >  weekly rules
 * Partial blackouts are returned separately and applied per-slot.
 */
const resolveDay = ({ resource, rules, dayExceptions, weekday }) => {
  const fullDayBlackout = dayExceptions.find((e) => e.type === "blackout" && e.fullDay);
  if (fullDayBlackout) {
    return { closedReason: fullDayBlackout.reason || "Closed", windows: [], blocked: [] };
  }

  const blocked = dayExceptions
    .filter((e) => e.type === "blackout" && !e.fullDay)
    .map((e) => ({ start: toMinutes(e.startTime), end: toMinutes(e.endTime) }));

  const special = dayExceptions.filter((e) => e.type === "special_hours");

  const windows = special.length
    ? special.map((e) => ({
        start: toMinutes(e.startTime),
        end: toMinutes(e.endTime),
        slotMins: resource.bookingDurationMins,
      }))
    : rules
        .filter((r) => r.dayOfWeek === weekday)
        .map((r) => ({
          start: toMinutes(r.startTime),
          end: toMinutes(r.endTime),
          slotMins: r.slotDurationMins || resource.bookingDurationMins,
        }));

  return { closedReason: null, windows, blocked };
};

// Cut a window into back-to-back slots, skipping any that touch a blocked interval
const generateSlots = ({ day, windows, blocked, now }) => {
  const byStart = new Map();

  for (const w of windows) {
    for (let s = w.start; s + w.slotMins <= w.end; s += w.slotMins) {
      const e = s + w.slotMins;
      if (blocked.some((b) => overlaps(s, e, b.start, b.end))) continue;

      // set() keeps wall-clock time correct across DST changes
      const start = day.set({ hour: Math.floor(s / 60), minute: s % 60 });
      if (start < now) continue; // never offer slots in the past

      const end = start.plus({ minutes: w.slotMins });
      byStart.set(start.toMillis(), { start, end });
    }
  }

  return [...byStart.values()].sort((a, b) => a.start - b.start);
};

// Pending/confirmed bookings in range. Uses the Booking model once it is registered.
const fetchBookings = async (resourceId, fromDt, toDt) => {
  const Booking = mongoose.models.Booking;
  if (!Booking) return [];

  return Booking.find({
    resourceId,
    status: { $in: ["pending", "confirmed"] },
    startTime: { $lt: toDt.endOf("day").toJSDate() },
    endTime: { $gt: fromDt.toJSDate() },
  }).lean();
};

/**
 * @param {Object} opts
 * @param {Object} opts.resource   Resource document
 * @param {string} opts.from       "YYYY-MM-DD" (resource-local)
 * @param {string} opts.to         "YYYY-MM-DD" inclusive
 * @param {number} [opts.partySize=1]
 */
const getOpenSlots = async ({ resource, from, to, partySize = 1 }) => {
  const zone = resource.timezone;
  const now = DateTime.now().setZone(zone);

  const fromDt = DateTime.fromISO(from, { zone }).startOf("day");
  const toDt = DateTime.fromISO(to, { zone }).startOf("day");

  if (!fromDt.isValid || !toDt.isValid) {
    throw new SlotError("from/to must be valid dates in YYYY-MM-DD format");
  }
  if (toDt < fromDt) throw new SlotError("`to` must be on or after `from`");
  if (toDt.diff(fromDt, "days").days + 1 > MAX_RANGE_DAYS) {
    throw new SlotError(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
  }

  const fromStr = fromDt.toISODate();
  const toStr = toDt.toISODate();

  const [rules, exceptions, bookings] = await Promise.all([
    Availability.find({ resourceId: resource._id, isActive: true }).lean(),
    Exception.find({
      resourceId: resource._id,
      date: { $lte: toStr },
      endDate: { $gte: fromStr },
    }).lean(),
    fetchBookings(resource._id, fromDt, toDt),
  ]);

  const days = [];

  for (let d = fromDt; d <= toDt; d = d.plus({ days: 1 })) {
    const dateStr = d.toISODate();
    const weekday = d.weekday % 7; // luxon: Mon=1..Sun=7  ->  Sun=0..Sat=6

    const { closedReason, windows, blocked } = resolveDay({
      resource,
      rules,
      dayExceptions: exceptionsForDate(exceptions, dateStr),
      weekday,
    });

    if (closedReason) {
      days.push({ date: dateStr, status: "closed", reason: closedReason, slots: [] });
      continue;
    }

    const slots = generateSlots({ day: d, windows, blocked, now })
      .map(({ start, end }) => {
        const booked = bookings
          .filter((b) => b.startTime < end.toJSDate() && b.endTime > start.toJSDate())
          .reduce((sum, b) => sum + (b.partySize || 1), 0);

        return {
          start: start.toISO(),
          end: end.toISO(),
          remainingCapacity: resource.capacity - booked,
        };
      })
      .filter((slot) => slot.remainingCapacity >= partySize);

    days.push({
      date: dateStr,
      status: slots.length ? "open" : "closed",
      reason: slots.length ? null : "No availability",
      slots,
    });
  }

  return { resourceId: resource._id, timezone: zone, from: fromStr, to: toStr, days };
};

module.exports = { getOpenSlots, SlotError, MAX_RANGE_DAYS, toMinutes };