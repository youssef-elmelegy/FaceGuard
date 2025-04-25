// const multer = require("multer");
// const {
//   createCanvas,
//   loadImage,
//   Canvas,
//   Image,
//   ImageData,
// } = require("@napi-rs/canvas");
// const faceapi = require("face-api.js");
// const cloudinary = require("cloudinary").v2;
// const fs = require("fs");
// const path = require("path");
// const express = require("express");
// const os = require("os");
// const compression = require("compression");
// require("dotenv").config();

// // Serverless-optimized configuration
// const tempDir = path.join(os.tmpdir(), "face-api");
// if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// const upload = multer({
//   dest: tempDir,
//   limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
// });

// const app = express();
// app.use(compression());

// // Cloudinary setup
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// // FaceAPI.js environment patch
// faceapi.env.monkeyPatch({
//   Canvas: Canvas,
//   Image: Image,
//   ImageData: ImageData,
//   createCanvasElement: () => new Canvas(0, 0),
//   createImageElement: () => new Image(),
// });

// // Global state
// let faceMatcher;
// let isInitialized = false;
// const labelCache = new Map();

// // Health check endpoint (NO initialization dependency)
// app.get("/", (req, res) => {
//   res.json({
//     status: isInitialized ? "ready" : "initializing",
//     version: "1.0.0",
//     environment: process.env.NODE_ENV || "development",
//   });
// });

// // Initialize models (optimized loading)
// async function initialize() {
//   if (isInitialized) return;

//   console.time("ModelInitialization");
//   const modelsPath = path.join(__dirname, "models");

//   // Critical path: load essential model first
//   await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);

//   // Parallel load remaining resources
//   await Promise.all([
//     faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
//     faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath),
//     loadLabelDescriptors(),
//   ]);

//   console.timeEnd("ModelInitialization");
//   isInitialized = true;
// }

// async function loadLabelDescriptors() {
//   if (labelCache.size > 0) return;

//   const labels = ["jo", "H"];
//   const results = await Promise.all(
//     labels.map(async (label) => {
//       const descriptions = [];
//       const labelPath = path.join(__dirname, "labels", label);

//       for (let i = 1; i <= 2; i++) {
//         const img = await loadImage(path.join(labelPath, `${i}.png`));
//         const detection = await faceapi
//           .detectSingleFace(img)
//           .withFaceLandmarks()
//           .withFaceDescriptor();
//         descriptions.push(detection.descriptor);
//       }
//       return new faceapi.LabeledFaceDescriptors(label, descriptions);
//     })
//   );

//   results.forEach((r) => labelCache.set(r.label, r));
// }

// // Image processing functions
// function resizeImage(image, maxDim = 640) {
//   const scale = Math.min(maxDim / image.width, maxDim / image.height);
//   const width = Math.round(image.width * scale);
//   const height = Math.round(image.height * scale);

//   const canvas = createCanvas(width, height);
//   const ctx = canvas.getContext("2d");
//   ctx.drawImage(image, 0, 0, width, height);
//   return canvas;
// }

// async function processImage(imagePath) {
//   const img = await loadImage(imagePath);
//   const resizedCanvas = resizeImage(img);

//   const detections = await faceapi
//     .detectAllFaces(resizedCanvas)
//     .withFaceLandmarks()
//     .withFaceDescriptors();

//   // Annotation logic
//   const ctx = resizedCanvas.getContext("2d");
//   const avgDim = (resizedCanvas.width + resizedCanvas.height) / 2;
//   detections.forEach((d) => {
//     const box = d.detection.box;
//     ctx.strokeStyle = "#00ff00";
//     ctx.lineWidth = Math.max(2, avgDim * 0.008);
//     ctx.strokeRect(box.x, box.y, box.width, box.height);
//   });

//   // Output handling
//   const outPath = path.join(tempDir, `${Date.now()}.jpg`);
//   const outStream = fs.createWriteStream(outPath);
//   resizedCanvas.createJPEGStream({ quality: 0.9 }).pipe(outStream);

//   return new Promise((resolve, reject) => {
//     outStream.on("finish", () =>
//       resolve({
//         outPath,
//         faceCount: detections.length,
//         recognizedNames: [
//           ...new Set(
//             detections.map((d) => faceMatcher.findBestMatch(d.descriptor).label)
//           ),
//         ],
//       })
//     );
//     outStream.on("error", reject);
//   });
// }

// // Initialization handler
// const initPromise = initialize().catch((err) => {
//   console.error("🚨 Initialization failed:", err);
//   process.exit(1);
// });

// // Middleware to check initialization state
// app.use(async (req, res, next) => {
//   if (req.path === "/") return next(); // Skip for health check

//   try {
//     await initPromise;
//     next();
//   } catch (err) {
//     res.status(503).json({ error: "Service initializing", retryAfter: "30s" });
//   }
// });

// // Main detection endpoint
// app.post("/detect-faces", upload.single("image"), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ error: "No image uploaded" });
//     }

//     const result = await processImage(req.file.path);
//     const cloudinaryResult = await cloudinary.uploader.upload(result.outPath, {
//       folder: "face-detections",
//     });

//     // Cleanup
//     [req.file.path, result.outPath].forEach((p) => {
//       if (fs.existsSync(p)) fs.unlinkSync(p);
//     });

//     res.json({
//       success: true,
//       faceCount: result.faceCount,
//       recognizedNames: result.recognizedNames,
//       processedImage: cloudinaryResult.secure_url,
//     });
//   } catch (err) {
//     console.error("🔴 Processing error:", err);
//     res.status(500).json({
//       error: "Image processing failed",
//       details: process.env.NODE_ENV === "development" ? err.message : undefined,
//     });
//   }
// });

// // Export for Vercel
// module.exports = app;

const multer = require("multer");
const {
  createCanvas,
  loadImage,
  Canvas,
  Image,
  ImageData,
} = require("@napi-rs/canvas");

const faceapi = require("face-api.js");
// const { Canvas, Image, ImageData } = require("canvas");
const tf = require("@tensorflow/tfjs");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");
const express = require("express");
require("dotenv").config();

const app = express();
const upload = multer({ dest: "uploads/" });

// Cloudinary config
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  throw new Error("Missing Cloudinary configuration!");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

faceapi.env.monkeyPatch({
  Canvas: Canvas,
  Image: Image,
  ImageData: ImageData,
  createCanvasElement: () => new Canvas(0, 0),
  createImageElement: () => new Image(),
});

let faceMatcher;
async function initialize() {
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromDisk("models"),
    faceapi.nets.faceLandmark68Net.loadFromDisk("models"),
    faceapi.nets.faceRecognitionNet.loadFromDisk("models"),
  ]);

  const labeledFaceDescriptors = await getLabeledFaceDescriptions();
  faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);
}

async function getLabeledFaceDescriptions() {
  const labels = ["jo", "H", "Mazen", "Youssef"];
  return Promise.all(
    labels.map(async (label) => {
      const descriptions = [];
      for (let i = 1; i <= 2; i++) {
        const imagePath = path.join(__dirname, "labels", label, `${i}.png`);
        const img = await loadImage(imagePath);
        const detection = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
        descriptions.push(detection.descriptor);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
}

// 👇 Downscale image before processing
function resizeImage(image, maxDim = 640) {
  const scale =
    image.width > image.height ? maxDim / image.width : maxDim / image.height;
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

async function processImage(imagePath) {
  const img = await loadImage(imagePath);
  const resizedCanvas = resizeImage(img);
  const resizedCtx = resizedCanvas.getContext("2d");

  const detections = await faceapi
    .detectAllFaces(resizedCanvas)
    .withFaceLandmarks()
    .withFaceDescriptors();

  const avgDim = (resizedCanvas.width + resizedCanvas.height) / 2;
  const lineWidth = Math.max(2, avgDim * 0.008);
  const fontSize = Math.max(12, avgDim * 0.02);

  detections.forEach((detection) => {
    const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
    const box = detection.detection.box;

    resizedCtx.strokeStyle = "#00ff00";
    resizedCtx.lineWidth = lineWidth;
    resizedCtx.strokeRect(box.x, box.y, box.width, box.height);

    resizedCtx.fillStyle = "#00ff00";
    resizedCtx.font = `bold ${fontSize}px Arial`;

    const textY =
      box.y > fontSize
        ? box.y - fontSize * 0.3
        : box.y + box.height + fontSize * 1.2;

    resizedCtx.fillText(bestMatch.label, box.x, textY);
  });

  // Preserve rotation logic
  const shouldRotate = resizedCanvas.width > resizedCanvas.height;
  const outputCanvas = shouldRotate
    ? createCanvas(resizedCanvas.height, resizedCanvas.width)
    : createCanvas(resizedCanvas.width, resizedCanvas.height);
  const outputCtx = outputCanvas.getContext("2d");

  if (shouldRotate) {
    outputCtx.translate(resizedCanvas.height / 2, resizedCanvas.width / 2);
    outputCtx.rotate(Math.PI / 2);
    outputCtx.drawImage(
      resizedCanvas,
      -resizedCanvas.width / 2,
      -resizedCanvas.height / 2
    );
  } else {
    outputCtx.drawImage(resizedCanvas, 0, 0);
  }

  const outPath = path.join(__dirname, "temp", `${Date.now()}.jpg`);
  const out = fs.createWriteStream(outPath);
  const buffer = outputCanvas.toBuffer("image/jpeg", { quality: 0.85 });

  out.write(buffer);
  out.end();

  return new Promise((resolve, reject) => {
    out.on("finish", () =>
      resolve({
        outPath,
        faceCount: detections.length,
        recognizedNames: [
          ...new Set(
            detections.map((d) => faceMatcher.findBestMatch(d.descriptor).label)
          ),
        ],
      })
    );
    out.on("error", reject);
  });
}

app.post("/detect-faces", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("No image uploaded");

    const { outPath, faceCount, recognizedNames } = await processImage(
      req.file.path
    );

    const result = await cloudinary.uploader.upload(outPath, {
      folder: "face-detections",
    });

    [req.file.path, outPath].forEach(
      (p) => fs.existsSync(p) && fs.unlinkSync(p)
    );

    res.json({
      faceCount,
      recognizedNames,
      processedImage: result.secure_url,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Error processing image");
  }
});

initialize().then(() => {
  if (!fs.existsSync("temp")) fs.mkdirSync("temp");

  app.listen(3000, () => console.log("Server running on port 3000"));
});
