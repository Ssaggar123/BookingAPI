const express = require("express");
const router = express.Router({ mergeParams: true });

const {
  getSlots,
  listRules,
  createRule,
  updateRule,
  deleteRule,
  listExceptions,
  createException,
  deleteException,
} = require("../controllers/availabilityController");
const validate = require("../middleware/validate");
const { protect, restrictTo } = require("../middleware/auth");
const { loadResource, requireResourceOwner } = require("../middleware/resourceAccess");
const {
  createAvailabilitySchema,
  updateAvailabilitySchema,
  createExceptionSchema,
} = require("../validators/availabilityValidator");

const ownerOnly = [protect, restrictTo("provider", "admin"), loadResource, requireResourceOwner];

// ----- Open slots + weekly rules -----
router.get("/availability", loadResource, getSlots);
router.get("/availability/rules", loadResource, listRules);
router.post("/availability", ...ownerOnly, validate(createAvailabilitySchema), createRule);
router.patch(
  "/availability/:availabilityId",
  ...ownerOnly,
  validate(updateAvailabilitySchema),
  updateRule
);
router.delete("/availability/:availabilityId", ...ownerOnly, deleteRule);

// ----- Blackouts / special hours -----
router.get("/exceptions", loadResource, listExceptions);
router.post("/exceptions", ...ownerOnly, validate(createExceptionSchema), createException);
router.delete("/exceptions/:exceptionId", ...ownerOnly, deleteException);

module.exports = router;