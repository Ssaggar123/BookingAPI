const mongoose = require("mongoose");

/**
 * One document per (resource, slot start) that tracks how much capacity is taken.
 * The unique index + a single atomic findOneAndUpdate is what makes booking
 * race-safe WITHOUT needing multi-document transactions (works on standalone MongoDB).
 */
const slotCounterSchema = new mongoose.Schema(
  {
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Resource", required: true },
    slotStart: { type: Date, required: true },
    booked: { type: Number }, // set by $inc on first upsert
  },
  { timestamps: false }
);

slotCounterSchema.index({ resourceId: 1, slotStart: 1 }, { unique: true });

module.exports = mongoose.model("SlotCounter", slotCounterSchema);