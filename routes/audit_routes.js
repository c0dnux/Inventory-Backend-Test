const express = require("express");
const router = express.Router();
const auditControllers = require("../controllers/audit_controllers");
const userControllers = require("../controllers/user_controllers");

router.use(userControllers.protect);
router.post("/", auditControllers.getAllAudits);
router.get("/:id", auditControllers.getAudit);
router.post("/my-audits", auditControllers.myAudits);

module.exports = router;
