"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrService = exports.OCRService = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const tesseract_js_1 = require("tesseract.js");
const sharp_1 = __importDefault(require("sharp"));
const pdf2pic_1 = __importDefault(require("pdf2pic"));
const child_process_1 = require("child_process");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
class OCRService {
    constructor() {
        this.tesseractWorkers = new Map();
        this.maxWorkers = 3;
        this.initializeWorkers();
    }
    async initializeWorkers() {
        try {
            for (let i = 0; i < this.maxWorkers; i++) {
                const worker = await (0, tesseract_js_1.createWorker)(["eng", "fra"], 1, {
                    logger: m => {
                        if (m.status === "recognizing text") {
                            logger_1.logger.debug(`Tesseract progress: ${Math.round(m.progress * 100)}%`);
                        }
                    }
                });
                this.tesseractWorkers.set(`worker_${i}`, worker);
            }
            logger_1.logger.info(`Initialized ${this.maxWorkers} Tesseract workers`);
        }
        catch (error) {
            logger_1.logger.error("Failed to initialize Tesseract workers:", error instanceof Error ? error.message : "Unknown error");
        }
    }
    async getAvailableWorker() {
        const workerIds = Array.from(this.tesseractWorkers.keys());
        const workerId = workerIds[Math.floor(Math.random() * workerIds.length)];
        return this.tesseractWorkers.get(workerId);
    }
    async processDocument(filePath, options) {
        const startTime = Date.now();
        try {
            const imagePath = await this.convertToImage(filePath);
            const extractedData = {};
            const confidenceScores = {};
            for (const roi of options.rois) {
                try {
                    const roiResult = await this.extractROI(imagePath, roi, options);
                    extractedData[roi.name] = roiResult.text;
                    confidenceScores[roi.name] = roiResult.confidence;
                }
                catch (error) {
                    logger_1.logger.error(`Failed to process ROI ${roi.name}:`, error instanceof Error ? error.message : "Unknown error");
                    extractedData[roi.name] = "";
                    confidenceScores[roi.name] = 0;
                }
            }
            if (imagePath !== filePath) {
                await fs_1.promises.unlink(imagePath).catch(() => { });
            }
            const processingTime = Date.now() - startTime;
            const imageSize = await this.getImageSize(imagePath).catch(() => ({ width: 0, height: 0 }));
            return {
                extractedData,
                confidenceScores,
                processingTime,
                engine: options.engine,
                pageCount: 1,
                imageSize,
                detectedLanguage: options.languages
            };
        }
        catch (error) {
            logger_1.logger.error("Document processing failed:", error instanceof Error ? error.message : "Unknown error");
            throw new errors_1.ApiError("Failed to process document", 500);
        }
    }
    async extractROI(imagePath, roi, options) {
        const { coordinates } = roi;
        const roiImagePath = path_1.default.join(path_1.default.dirname(imagePath), `roi_${roi.id}_${Date.now()}.png`);
        try {
            await (0, sharp_1.default)(imagePath)
                .extract({
                left: Math.max(0, coordinates.x),
                top: Math.max(0, coordinates.y),
                width: coordinates.width,
                height: coordinates.height
            })
                .png()
                .toFile(roiImagePath);
            let result;
            if (options.engine === "tesseract") {
                result = await this.performTesseractOCR(roiImagePath, options.languages);
            }
            else {
                result = await this.performRapidOCR(roiImagePath);
            }
            await fs_1.promises.unlink(roiImagePath).catch(() => { });
            if (roi.regex_pattern && result.text) {
                const regex = new RegExp(roi.regex_pattern);
                if (!regex.test(result.text)) {
                    result.confidence *= 0.5;
                }
            }
            return result;
        }
        catch (error) {
            await fs_1.promises.unlink(roiImagePath).catch(() => { });
            throw error;
        }
    }
    async performTesseractOCR(imagePath, languages) {
        try {
            const worker = await this.getAvailableWorker();
            const { data } = await worker.recognize(imagePath, {
                lang: languages
            });
            return {
                text: data.text.trim(),
                confidence: data.confidence / 100
            };
        }
        catch (error) {
            logger_1.logger.error("Tesseract OCR failed:", error instanceof Error ? error.message : "Unknown error");
            return { text: "", confidence: 0 };
        }
    }
    async performRapidOCR(imagePath) {
        return new Promise((resolve) => {
            try {
                const pythonProcess = (0, child_process_1.spawn)("python3", ["-c", `
    import sys
    sys.path.append('/usr/local/lib/python3.11/site-packages')
    from rapidocr_onnxruntime import RapidOCR

    ocr = RapidOCR()
    result, elapse = ocr("${imagePath}")

    if result:
        texts = [item[1] for item in result]
        confidences = [item[2] for item in result]
        combined_text = " ".join(texts)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        print(f"{combined_text}|{avg_confidence}")
    else:
        print("|0")
            `]);
                let output = "";
                pythonProcess.stdout.on("data", (data) => {
                    output += data.toString();
                });
                pythonProcess.on("close", (code) => {
                    if (code === 0 && output) {
                        const [text, confidence] = output.trim().split("|");
                        resolve({
                            text: text || "",
                            confidence: parseFloat(confidence) || 0
                        });
                    }
                    else {
                        resolve({ text: "", confidence: 0 });
                    }
                });
                pythonProcess.on("error", (err) => {
                    logger_1.logger.error("RapidOCR process error:", err);
                    resolve({ text: "", confidence: 0 });
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
                logger_1.logger.error("RapidOCR failed:", errorMessage);
                resolve({ text: "", confidence: 0 });
            }
        });
    }
    async convertToImage(filePath) {
        const ext = path_1.default.extname(filePath).toLowerCase();
        if ([".png", ".jpg", ".jpeg", ".tiff", ".bmp"].includes(ext)) {
            return filePath;
        }
        if (ext === ".pdf") {
            return await this.convertPdfToImage(filePath);
        }
        throw new errors_1.ApiError(`Unsupported file format: ${ext}`, 400);
    }
    async convertPdfToImage(pdfPath) {
        const outputDir = path_1.default.dirname(pdfPath);
        const outputName = path_1.default.basename(pdfPath, ".pdf");
        try {
            const convert = pdf2pic_1.default.fromPath(pdfPath, {
                density: 300,
                saveFilename: outputName,
                savePath: outputDir,
                format: "png",
                width: 2480,
                height: 3508
            });
            const result = await convert(1, { responseType: "image" });
            if (result && result.path) {
                return result.path;
            }
            throw new Error("PDF conversion failed");
        }
        catch (error) {
            logger_1.logger.error("PDF to image conversion failed:", error instanceof Error ? error.message : "Unknown error");
            throw new errors_1.ApiError("Failed to convert PDF to image", 500);
        }
    }
    async extractRegions(filePath, options) {
        try {
            const imagePath = await this.convertToImage(filePath);
            const results = [];
            for (const region of options.regions) {
                const regionImage = path_1.default.join(path_1.default.dirname(imagePath), `region_${Date.now()}_${Math.random()}.png`);
                try {
                    await (0, sharp_1.default)(imagePath)
                        .extract({
                        left: Math.max(0, Math.round(region.x * options.scale)),
                        top: Math.max(0, Math.round(region.y * options.scale)),
                        width: Math.round(region.width * options.scale),
                        height: Math.round(region.height * options.scale)
                    })
                        .png()
                        .toFile(regionImage);
                    let ocrResult;
                    if (options.engine === "tesseract") {
                        ocrResult = await this.performTesseractOCR(regionImage, "eng+fra");
                    }
                    else {
                        ocrResult = await this.performRapidOCR(regionImage);
                    }
                    results.push({
                        region: region.name || `Region_${results.length + 1}`,
                        text: ocrResult.text,
                        confidence: ocrResult.confidence,
                        coordinates: region
                    });
                    await fs_1.promises.unlink(regionImage).catch(() => { });
                }
                catch (error) {
                    logger_1.logger.error(`Failed to extract region:`, error instanceof Error ? error.message : "Unknown error");
                    results.push({
                        region: region.name || `Region_${results.length + 1}`,
                        text: "",
                        confidence: 0,
                        coordinates: region,
                        error: error instanceof Error ? error.message : "Unknown error"
                    });
                }
            }
            return results;
        }
        catch (error) {
            logger_1.logger.error("Region extraction failed:", error instanceof Error ? error.message : "Unknown error");
            throw new errors_1.ApiError("Failed to extract regions", 500);
        }
    }
    async previewDocument(filePath, options) {
        try {
            const imagePath = await this.convertToImage(filePath);
            const previewPath = path_1.default.join(path_1.default.dirname(imagePath), `preview_${Date.now()}.jpg`);
            await (0, sharp_1.default)(imagePath)
                .resize(options.width, options.height, { fit: "inside", withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toFile(previewPath);
            const stats = await fs_1.promises.stat(previewPath);
            const imageInfo = await (0, sharp_1.default)(previewPath).metadata();
            return {
                previewUrl: `/uploads/${path_1.default.basename(previewPath)}`,
                dimensions: {
                    width: imageInfo.width,
                    height: imageInfo.height
                },
                fileSize: stats.size,
                format: "jpeg"
            };
        }
        catch (error) {
            logger_1.logger.error("Preview generation failed:", error instanceof Error ? error.message : "Unknown error");
            throw new errors_1.ApiError("Failed to generate preview", 500);
        }
    }
    async getImageSize(imagePath) {
        try {
            const metadata = await (0, sharp_1.default)(imagePath).metadata();
            return {
                width: metadata.width,
                height: metadata.height
            };
        }
        catch {
            return { width: 0, height: 0 };
        }
    }
    async getAvailableEngines() {
        const engines = [];
        if (this.tesseractWorkers.size > 0) {
            engines.push({
                name: "tesseract",
                version: "5.0+",
                languages: ["eng", "fra", "deu", "spa"],
                status: "available"
            });
        }
        try {
            await new Promise((resolve, reject) => {
                const process = (0, child_process_1.spawn)("python3", ["-c", 'from rapidocr_onnxruntime import RapidOCR; print("OK")']);
                process.on("close", (code) => {
                    if (code === 0)
                        resolve(true);
                    else
                        reject();
                });
                process.on("error", reject);
            });
            engines.push({
                name: "rapidocr",
                version: "1.3+",
                languages: ["multilingual"],
                status: "available"
            });
        }
        catch {
            engines.push({
                name: "rapidocr",
                version: "unknown",
                languages: [],
                status: "unavailable"
            });
        }
        return engines;
    }
    async getServiceStatus() {
        const engines = await this.getAvailableEngines();
        return {
            status: "healthy",
            engines,
            workers: {
                tesseract: this.tesseractWorkers.size,
                active: this.tesseractWorkers.size
            },
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };
    }
}
exports.OCRService = OCRService;
exports.ocrService = new OCRService();
