const { DateTime } = require("luxon");
const Booking = require("../models/Booking");
const SlotCounter = require("../models/SlotCounter");
const { getOpenSlots } = require("./slotService");

class BookingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Make sure the unique (resourceId, slotStart) index exists before we rely on it.
const indexesReady = SlotCounter.init().catch((err) =>
  console.error("SlotCounter index build failed - double-booking protection is OFF:", err)
);

/**
 * Atomically claim `partySize` seats in a slot.
 *
 * The filter only matches while there is still room (booked <= capacity - partySize),
 * and $inc happens in the same single-document operation, so two requests can never
 * both succeed for the last seat.
 *
 *  - Counter doc missing  -> upsert creates it
 *  - Counter doc is full  -> filter misses, upsert tries to insert a duplicate key -> E11000
 *  - Two first-ever requests race the insert -> loser gets E11000 too, so we retry once
 *    without upsert to tell "lost the insert race" apart from "slot really is full"
 */
const reserveCapacity = async ({ resourceId, slotStart, partySize, capacity }) => {
  const filter = { resourceId, slotStart, booked: { $lte: capacity - partySize } };
  const update = { $inc: { booked: partySize } };

  try {
    await SlotCounter.findOneAndUpdate(filter, update, { upsert: true, setDefaultsOnInsert: false });
    return true;
  } catch (err) {
    if (err.code !== 11000) throw err;
  }

  const updated = await SlotCounter.findOneAndUpdate(filter, update);
  return Boolean(updated);
};

const releaseCapacity = ({ resourceId, slotStart, partySize }) =>
  SlotCounter.updateOne({ resourceId, slotStart }, { $inc: { booked: -partySize } });

/**
 * Create a booking for an exact open slot.
 * Order matters: validate against real availability first (blackouts, weekly hours,
 * past slots, existing bookings), then claim capacity atomically, then insert.
 */
const createBooking = async ({ resource, customerId, startTime, partySize = 1, notes }) => {
  if (!resource.isActive) {
    throw new BookingError("Resource is not available for booking", 404);
  }
  if (partySize > resource.capacity) {
    throw new BookingError(`partySize cannot exceed resource capacity (${resource.capacity})`, 400);
  }

  const requested = DateTime.fromISO(startTime, { setZone: true });
  if (!requested.isValid) throw new BookingError("Invalid startTime", 400);

  // 1) Must match a real open slot (this is where blackout/exception days are enforced)
  const localDate = requested.setZone(resource.timezone).toISODate();
  const { days } = await getOpenSlots({ resource, from: localDate, to: localDate, partySize });

  const slot = days[0]?.slots.find(
    (s) => DateTime.fromISO(s.start).toMillis() === requested.toMillis()
  );
  if (!slot) {
    throw new BookingError("Requested time is not an available slot", 409);
  }

  // Never trust the client for the end time - take it from the slot
  const slotStart = new Date(DateTime.fromISO(slot.start).toMillis());
  const slotEnd = new Date(DateTime.fromISO(slot.end).toMillis());

  // 2) Atomically claim the capacity
  await indexesReady;
  const reserved = await reserveCapacity({
    resourceId: resource._id,
    slotStart,
    partySize,
    capacity: resource.capacity,
  });
  if (!reserved) {
    throw new BookingError("Slot was just taken - please choose another time", 409);
  }

  // 3) Persist; give the capacity back if anything goes wrong
  try {
    return await Booking.create({
      resourceId: resource._id,
      customerId,
      startTime: slotStart,
      endTime: slotEnd,
      partySize,
      notes,
      status: "confirmed",
    });
  } catch (err) {
    await releaseCapacity({ resourceId: resource._id, slotStart, partySize }).catch(() => {});
    throw err;
  }
};

/**
 * Cancel a booking and free its capacity.
 * The status flip is a single conditional update, so a double-click or two
 * concurrent cancels can never release the capacity twice.
 */
const cancelBooking = async ({ booking, userId, reason }) => {
  if (booking.startTime <= new Date()) {
    throw new BookingError("Cannot cancel a booking that has already started", 400);
  }

  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: { $in: ["pending", "confirmed"] } },
    { status: "cancelled", cancellationReason: reason, cancelledAt: new Date(), cancelledBy: userId },
    { new: true }
  );
  if (!updated) {
    throw new BookingError("Booking can no longer be cancelled", 409);
  }

  await releaseCapacity({
    resourceId: updated.resourceId,
    slotStart: updated.startTime,
    partySize: updated.partySize,
  });

  return updated;
};

module.exports = { createBooking, cancelBooking, BookingError, reserveCapacity, releaseCapacity };