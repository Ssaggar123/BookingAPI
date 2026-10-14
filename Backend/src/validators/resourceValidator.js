const { z } = require("zod");

const locationSchema = z
  .object({
    address: z.string().optional(),
    lng: z.number().optional(),
    lat: z.number().optional(),
  })
  .optional();

const isValidTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const createResourceSchema = z.object({
  timezone: z
    .string()
    .refine(isValidTimezone, "Invalid IANA timezone (e.g. Asia/Kolkata)")
    .optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  category: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  bookingDurationMins: z.number().int().positive().optional(),
  location: locationSchema,
});

// All fields optional for partial updates
const updateResourceSchema = createResourceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

module.exports = { createResourceSchema, updateResourceSchema };