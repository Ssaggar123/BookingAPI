const { z } = require("zod");

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm (24h)");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// ---------- Weekly availability rules ----------
const availabilityBase = z.object({
  dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday
  startTime: time,
  endTime: time,
  slotDurationMins: z.number().int().min(5).optional(),
  isActive: z.boolean().optional(),
});

const createAvailabilitySchema = availabilityBase.refine(
  (d) => toMin(d.endTime) > toMin(d.startTime),
  { message: "endTime must be after startTime", path: ["endTime"] }
);

// Partial update; cross-field check against stored values happens in the controller
const updateAvailabilitySchema = availabilityBase.partial();

// ---------- Exceptions (blackouts / special hours) ----------
const createExceptionSchema = z
  .object({
    type: z.enum(["blackout", "special_hours"]).default("blackout"),
    date,
    endDate: date.optional(),
    fullDay: z.boolean().default(true),
    startTime: time.optional(),
    endTime: time.optional(),
    reason: z.string().max(200).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.endDate && d.endDate < d.date) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "endDate must be on or after date" });
    }

    // special_hours always needs explicit hours; partial blackouts do too
    const needsTimes = d.type === "special_hours" || !d.fullDay;
    if (needsTimes) {
      if (!d.startTime || !d.endTime) {
        ctx.addIssue({ code: "custom", path: ["startTime"], message: "startTime and endTime are required" });
        return;
      }
      if (toMin(d.endTime) <= toMin(d.startTime)) {
        ctx.addIssue({ code: "custom", path: ["endTime"], message: "endTime must be after startTime" });
      }
    }

    // A partial-day blackout only makes sense for a single day
    if (d.type === "blackout" && !d.fullDay && d.endDate && d.endDate !== d.date) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Partial-day blackouts must be a single date" });
    }
  });

module.exports = {
  createAvailabilitySchema,
  updateAvailabilitySchema,
  createExceptionSchema,
};