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
  const labels = ["jo", "H"];
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
  const resizedCanvas = resizeImage(img); // Downscaled canvas
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
  const stream = outputCanvas.createJPEGStream({ quality: 0.85 });
  stream.pipe(out);

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
