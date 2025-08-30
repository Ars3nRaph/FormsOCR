
    import { promises as fs } from "fs";
    import path from "path";
    import { createWorker } from "tesseract.js";
    import sharp from "sharp";
    import pdf2pic from "pdf2pic";
    import { spawn } from "child_process";
    import { logger } from "../utils/logger";
    import { ApiError } from "../utils/errors";

    interface ROI {
      id: string;
      name: string;
      type: string;
      coordinates: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      regex_pattern?: string;
      confidence_threshold?: number;
    }

    interface OCROptions {
      rois: ROI[];
      engine: "tesseract" | "rapidocr";
      confidenceThreshold: number;
      languages: string;
    }

    interface RegionExtractionOptions {
      regions: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        name?: string;
      }>;
      engine: string;
      page: number;
      scale: number;
    }

    interface PreviewOptions {
      page: number;
      width: number;
      height: number;
    }

    export class OCRService {
      private tesseractWorkers: Map<string, any> = new Map();
      private readonly maxWorkers = 3;

      constructor() {
        this.initializeWorkers();
      }

      private async initializeWorkers(): Promise<void> {
        try {
          for (let i = 0; i < this.maxWorkers; i++) {
            const worker = await createWorker(["eng", "fra"], 1, {
              logger: m => {
                if (m.status === "recognizing text") {
                  logger.debug(`Tesseract progress: ${Math.round(m.progress * 100)}%`);
                }
              }
            });
            
            this.tesseractWorkers.set(`worker_${i}`, worker);
          }
          
          logger.info(`Initialized ${this.maxWorkers} Tesseract workers`);
        } catch (error) {
          logger.error("Failed to initialize Tesseract workers:", error instanceof Error ? error.message : "Unknown error");
        }
      }

      private async getAvailableWorker(): Promise<any> {
        // Simple round-robin selection
        const workerIds = Array.from(this.tesseractWorkers.keys());
        const workerId = workerIds[Math.floor(Math.random() * workerIds.length)];
        return this.tesseractWorkers.get(workerId);
      }

      async processDocument(filePath: string, options: OCROptions) {
        const startTime = Date.now();
        
        try {
          // Convert PDF to image if needed
          const imagePath = await this.convertToImage(filePath);
          
          // Process each ROI
          const extractedData: Record<string, any> = {};
          const confidenceScores: Record<string, number> = {};

          for (const roi of options.rois) {
            try {
              const roiResult = await this.extractROI(imagePath, roi, options);
              extractedData[roi.name] = roiResult.text;
              confidenceScores[roi.name] = roiResult.confidence;
            } catch (error) {
              logger.error(`Failed to process ROI ${roi.name}:`, error instanceof Error ? error.message : "Unknown error");
              extractedData[roi.name] = "";
              confidenceScores[roi.name] = 0;
            }
          }

          // Clean up temporary files
          if (imagePath !== filePath) {
            await fs.unlink(imagePath).catch(() => {});
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

        } catch (error) {
          logger.error("Document processing failed:", error instanceof Error ? error.message : "Unknown error");
          throw new ApiError("Failed to process document", 500);
        }
      }

      private async extractROI(imagePath: string, roi: ROI, options: OCROptions) {
        const { coordinates } = roi;
        
        // Extract ROI region from image
        const roiImagePath = path.join(path.dirname(imagePath), `roi_${roi.id}_${Date.now()}.png`);
        
        try {
          await sharp(imagePath)
            .extract({
              left: Math.max(0, coordinates.x),
              top: Math.max(0, coordinates.y),
              width: coordinates.width,
              height: coordinates.height
            })
            .png()
            .toFile(roiImagePath);

          // Perform OCR on the extracted region
          let result;
          if (options.engine === "tesseract") {
            result = await this.performTesseractOCR(roiImagePath, options.languages);
          } else {
            result = await this.performRapidOCR(roiImagePath);
          }

          // Clean up ROI image
          await fs.unlink(roiImagePath).catch(() => {});

          // Validate result against regex pattern if provided
          if (roi.regex_pattern && result.text) {
            const regex = new RegExp(roi.regex_pattern);
            if (!regex.test(result.text)) {
              result.confidence *= 0.5; // Lower confidence for invalid patterns
            }
          }

          return result;

        } catch (error) {
          // Clean up on error
          await fs.unlink(roiImagePath).catch(() => {});
          throw error;
        }
      }

      private async performTesseractOCR(imagePath: string, languages: string) {
        try {
          const worker = await this.getAvailableWorker();
          
          const { data } = await worker.recognize(imagePath, {
            lang: languages
          });

          return {
            text: data.text.trim(),
            confidence: data.confidence / 100 // Convert to 0-1 scale
          };

        } catch (error) {
          logger.error("Tesseract OCR failed:", error instanceof Error ? error.message : "Unknown error");
          return { text: "", confidence: 0 };
        }
      }

      private async performRapidOCR(imagePath: string): Promise<{ text: string; confidence: number }> {
        return new Promise((resolve) => {
          try {
            const pythonProcess = spawn("python3", ["-c", `
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
              } else {
                resolve({ text: "", confidence: 0 });
              }
            });

            pythonProcess.on("error", (err: NodeJS.ErrnoException) => {
              logger.error("RapidOCR process error:", err);
              resolve({ text: "", confidence: 0 });
            });

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            logger.error("RapidOCR failed:", errorMessage);
            resolve({ text: "", confidence: 0 });
          }
        });
      }

      private async convertToImage(filePath: string): Promise<string> {
        const ext = path.extname(filePath).toLowerCase();
        
        if ([".png", ".jpg", ".jpeg", ".tiff", ".bmp"].includes(ext)) {
          return filePath;
        }

        if (ext === ".pdf") {
          return await this.convertPdfToImage(filePath);
        }

        throw new ApiError(`Unsupported file format: ${ext}`, 400);
      }

      private async convertPdfToImage(pdfPath: string): Promise<string> {
        const outputDir = path.dirname(pdfPath);
        const outputName = path.basename(pdfPath, ".pdf");
        
        try {
          const convert = pdf2pic.fromPath(pdfPath, {
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
          
        } catch (error) {
          logger.error("PDF to image conversion failed:", error instanceof Error ? error.message : "Unknown error");
          throw new ApiError("Failed to convert PDF to image", 500);
        }
      }

      async extractRegions(filePath: string, options: RegionExtractionOptions) {
        try {
          const imagePath = await this.convertToImage(filePath);
          const results = [];

          for (const region of options.regions) {
            const regionImage = path.join(path.dirname(imagePath), `region_${Date.now()}_${Math.random()}.png`);
            
            try {
              await sharp(imagePath)
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
              } else {
                ocrResult = await this.performRapidOCR(regionImage);
              }

              results.push({
                region: region.name || `Region_${results.length + 1}`,
                text: ocrResult.text,
                confidence: ocrResult.confidence,
                coordinates: region
              });

              await fs.unlink(regionImage).catch(() => {});

            } catch (error) {
              logger.error(`Failed to extract region:`, error instanceof Error ? error.message : "Unknown error");
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

        } catch (error) {
          logger.error("Region extraction failed:", error instanceof Error ? error.message : "Unknown error");
          throw new ApiError("Failed to extract regions", 500);
        }
      }

      async previewDocument(filePath: string, options: PreviewOptions) {
        try {
          const imagePath = await this.convertToImage(filePath);
          const previewPath = path.join(path.dirname(imagePath), `preview_${Date.now()}.jpg`);

          await sharp(imagePath)
            .resize(options.width, options.height, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toFile(previewPath);

          const stats = await fs.stat(previewPath);
          const imageInfo = await sharp(previewPath).metadata();

          return {
            previewUrl: `/uploads/${path.basename(previewPath)}`,
            dimensions: {
              width: imageInfo.width,
              height: imageInfo.height
            },
            fileSize: stats.size,
            format: "jpeg"
          };

        } catch (error) {
          logger.error("Preview generation failed:", error instanceof Error ? error.message : "Unknown error");
          throw new ApiError("Failed to generate preview", 500);
        }
      }

      private async getImageSize(imagePath: string) {
        try {
          const metadata = await sharp(imagePath).metadata();
          return {
            width: metadata.width,
            height: metadata.height
          };
        } catch {
          return { width: 0, height: 0 };
        }
      }

      async getAvailableEngines() {
        const engines = [];

        // Check Tesseract
        if (this.tesseractWorkers.size > 0) {
          engines.push({
            name: "tesseract",
            version: "5.0+",
            languages: ["eng", "fra", "deu", "spa"],
            status: "available"
          });
        }

        // Check RapidOCR
        try {
          await new Promise((resolve, reject) => {
            const process = spawn("python3", ["-c", 'from rapidocr_onnxruntime import RapidOCR; print("OK")']);
            process.on("close", (code) => {
              if (code === 0) resolve(true);
              else reject();
            });
            process.on("error", reject);
          });

          engines.push({
            name: "rapidocr",
            version: "1.3+",
            languages: ["multilingual"],
            status: "available"
          });
        } catch {
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

    export const ocrService = new OCRService();
  