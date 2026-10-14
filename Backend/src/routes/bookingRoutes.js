const express = require("express");
const router = express.Router();

const {
  createBooking,
  listBookings,
  getBooking,
  updateBookingStatus,
  cancelBooking,
} = require("../controllers/bookingController");
const validate = require("../middleware/validate");
const { protect, restrictTo } = require("../middleware/auth");
const {
  createBookingSchema,
  updateBookingStatusSchema,
  cancelBookingSchema,
} = require("../validators/bookingValidator");

router.use(protect);

router.post("/", validate(createBookingSchema), createBooking);
router.get("/", listBookings);
router.get("/:id", getBooking);
router.patch("/:id", restrictTo("provider", "admin"), validate(updateBookingStatusSchema), updateBookingStatus);
router.post("/:id/cancel", validate(cancelBookingSchema), cancelBooking);

module.exports = router;