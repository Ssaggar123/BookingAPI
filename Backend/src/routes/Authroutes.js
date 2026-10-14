const express = require("express");
const router = express.Router();

const { register, login, refresh, logout, getMe } = require("../controllers/authController");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");
const { registerSchema, loginSchema, refreshSchema } = require("../validators/authValidator");

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", validate(refreshSchema), refresh);
router.post("/logout", logout);
router.get("/me", protect, getMe);

module.exports = router;