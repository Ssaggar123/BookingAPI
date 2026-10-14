const Resource = require("../models/Resource");

// Helper: does this user own the resource, or are they an admin?
const canModify = (user, resource) =>
  user.role === "admin" || resource.ownerId.toString() === user._id.toString();

// @route POST /api/resources   (provider, admin)
const createResource = async (req, res) => {
  try {
    const { name, description, category, capacity, bookingDurationMins, location, timezone } = req.body;

    const resource = await Resource.create({
      ownerId: req.user._id,
      name,
      description,
      category,
      capacity,
      bookingDurationMins,
      timezone,
      location: location
        ? {
            address: location.address || "",
            geo: {
              type: "Point",
              coordinates: [location.lng || 0, location.lat || 0],
            },
          }
        : undefined,
    });

    res.status(201).json({ success: true, data: resource });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route GET /api/resources   (public)
// Supports ?category=&ownerId=&page=&limit=
const getResources = async (req, res) => {
  try {
    const { category, ownerId, page = 1, limit = 20 } = req.query;

    const filter = { isActive: true };
    if (category) filter.category = category;
    if (ownerId) filter.ownerId = ownerId;

    const skip = (Number(page) - 1) * Number(limit);

    const [resources, total] = await Promise.all([
      Resource.find(filter).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      Resource.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: resources,
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route GET /api/resources/:id   (public)
const getResourceById = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }
    res.status(200).json({ success: true, data: resource });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route PATCH /api/resources/:id   (owner provider, admin)
const updateResource = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    if (!canModify(req.user, resource)) {
      return res.status(403).json({ success: false, message: "Forbidden: not the resource owner" });
    }

    const { name, description, category, capacity, bookingDurationMins, location, timezone, isActive } = req.body;

    if (name !== undefined) resource.name = name;
    if (description !== undefined) resource.description = description;
    if (category !== undefined) resource.category = category;
    if (capacity !== undefined) resource.capacity = capacity;
    if (bookingDurationMins !== undefined) resource.bookingDurationMins = bookingDurationMins;
    if (timezone !== undefined) resource.timezone = timezone;
    if (isActive !== undefined) resource.isActive = isActive;
    if (location) {
      resource.location = {
        address: location.address ?? resource.location.address,
        geo: {
          type: "Point",
          coordinates: [
            location.lng ?? resource.location.geo.coordinates[0],
            location.lat ?? resource.location.geo.coordinates[1],
          ],
        },
      };
    }

    await resource.save();
    res.status(200).json({ success: true, data: resource });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route DELETE /api/resources/:id   (owner provider, admin)
const deleteResource = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    if (!canModify(req.user, resource)) {
      return res.status(403).json({ success: false, message: "Forbidden: not the resource owner" });
    }

    await resource.deleteOne();
    res.status(200).json({ success: true, message: "Resource deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createResource,
  getResources,
  getResourceById,
  updateResource,
  deleteResource,
};