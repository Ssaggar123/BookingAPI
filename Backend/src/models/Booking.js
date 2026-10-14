const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resource",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    partySize: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed", "no_show"],
      default: "confirmed",
    },
    notes: { type: String, trim: true, default: "" },
    cancellationReason: { type: String, trim: true },
    cancelledAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Used by the slot service to find overlapping bookings
bookingSchema.index({ resourceId: 1, startTime: 1, endTime: 1 });
bookingSchema.index({ customerId: 1, startTime: -1 });

module.exports = mongoose.model("Booking", bookingSchema);