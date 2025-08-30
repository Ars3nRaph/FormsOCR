"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_controller_1 = require("../controllers/health.controller");
const router = (0, express_1.Router)();
router.get('/', health_controller_1.healthController.healthCheck);
router.get('/status', health_controller_1.healthController.systemStatus);
router.get('/ocr', health_controller_1.healthController.ocrStatus);
exports.default = router;
