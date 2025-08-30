"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = void 0;
const ocr_routes_1 = __importDefault(require("./ocr.routes"));
const batch_routes_1 = __importDefault(require("./batch.routes"));
const health_routes_1 = __importDefault(require("./health.routes"));
const upload_routes_1 = __importDefault(require("./upload.routes"));
const setupRoutes = (app) => {
    const apiPrefix = '/api/v1';
    app.use(`${apiPrefix}/ocr`, ocr_routes_1.default);
    app.use(`${apiPrefix}/batch`, batch_routes_1.default);
    app.use(`${apiPrefix}/upload`, upload_routes_1.default);
    app.use(`${apiPrefix}/health`, health_routes_1.default);
    app.get('/', (req, res) => {
        res.json({
            message: 'FormsOCR Backend API',
            version: '1.0.0',
            endpoints: {
                health: `${apiPrefix}/health`,
                ocr: `${apiPrefix}/ocr`,
                batch: `${apiPrefix}/batch`,
                upload: `${apiPrefix}/upload`
            }
        });
    });
};
exports.setupRoutes = setupRoutes;
