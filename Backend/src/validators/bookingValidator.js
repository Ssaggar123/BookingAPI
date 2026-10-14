const { z } = require("zod");

const createBookingSchema = z.object({
  resourceId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid resourceId"),
  // Use the exact `start` value returned by GET /resources/:id/availability
  startTime: z.string().datetime({ offset: true, message: "startTime must be an ISO datetime with offset" }),
  partySize: z.number().int().positive().default(1),
  notes: z.string().max(500).optional(),
});

// Cancellation is handled by POST /:id/cancel, so it is not allowed here
const updateBookingStatusSchema = z.object({
  status: z.enum(["confirmed", "completed", "no_show"]),
});

const cancelBookingSchema = z.object({
  reason: z.string().max(300).optional(),
});

module.exports = { createBookingSchema, updateBookingStatusSchema, cancelBookingSchema };