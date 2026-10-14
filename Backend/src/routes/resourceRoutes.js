const express = require("express");
const router = express.Router();

const {
  createResource,
  getResources,
  getResourceById,
  updateResource,
  deleteResource,
} = require("../controllers/resourceController");
const availabilityRoutes = require("./availabilityRoutes");
const validate = require("../middleware/validate");
const { protect, restrictTo } = require("../middleware/auth");
const {
  createResourceSchema,
  updateResourceSchema,
} = require("../validators/resourceValidator");

router.get("/", getResources);
router.get("/:id", getResourceById);

router.post(
  "/",
  protect,
  restrictTo("provider", "admin"),
  validate(createResourceSchema),
  createResource
);

router.patch(
  "/:id",
  protect,
  restrictTo("provider", "admin"),
  validate(updateResourceSchema),
  updateResource
);

router.delete("/:id", protect, restrictTo("provider", "admin"), deleteResource);

// Nested: /api/resources/:resourceId/availability, /api/resources/:resourceId/exceptions
router.use("/:resourceId", availabilityRoutes);

module.exports = router;