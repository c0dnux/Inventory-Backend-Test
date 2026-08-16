const express = require("express");
const router = express.Router();
const auditControllers = require("../controllers/audit_controllers");
const userControllers = require("../controllers/user_controllers");
const authorize = require("../middleware/authorize");
const { cache } = require("../utils/cache_middleware");

router.use(userControllers.protect);
router.get(
  "/",
  authorize("audits", "read"),
  cache(120),
  auditControllers.getAllAudits,
);
router.get(
  "/:id",
  authorize("audits", "read"),
  cache(120),
  auditControllers.getAudit,
);
router.post("/my-audits", auditControllers.myAudits);

module.exports = router;
