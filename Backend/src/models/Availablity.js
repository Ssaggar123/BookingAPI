const mongoose = require("mongoose");

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:mm" 24h

const availabilitySchema = new mongoose.Schema(
  {
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resource",
      required: true,
    },
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0, // 0 = Sunday ... 6 = Saturday
      max: 6,
    },
    startTime: {
      type: String,
      required: true,
      match: [TIME_REGEX, "startTime must be HH:mm"],
    },
    endTime: {
      type: String,
      required: true,
      match: [TIME_REGEX, "endTime must be HH:mm"],
    },
    // Falls back to resource.bookingDurationMins when not set
    slotDurationMins: {
      type: Number,
      min: 5,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

availabilitySchema.index({ resourceId: 1, dayOfWeek: 1 });

module.exports = mongoose.model("Availability", availabilitySchema);