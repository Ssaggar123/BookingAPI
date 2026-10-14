const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      default: "general",
    },
    location: {
      address: { type: String, default: "" },
      geo: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
      },
    },
    capacity: {
      type: Number,
      default: 1,
      min: [1, "Capacity must be at least 1"],
    },
    bookingDurationMins: {
      type: Number,
      default: 60,
      min: [5, "Booking duration must be at least 5 minutes"],
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata", // IANA zone; availability times are interpreted in this zone
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

resourceSchema.index({ "location.geo": "2dsphere" });
resourceSchema.index({ ownerId: 1 });
resourceSchema.index({ category: 1 });

module.exports = mongoose.model("Resource", resourceSchema);