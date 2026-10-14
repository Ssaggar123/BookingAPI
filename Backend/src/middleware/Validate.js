// Wraps a Zod schema into Express middleware.
// Usage: router.post("/login", validate(loginSchema), controller)
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return res.status(400).json({ success: false, errors });
  }

  req.body = result.data; // use the parsed/sanitized data
  next();
};

module.exports = validate;