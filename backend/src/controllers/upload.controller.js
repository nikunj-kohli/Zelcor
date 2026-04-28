import { cloudinary } from "../config/cloudinary.js";

function uploadBuffer(fileBuffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "zelcor/uploads",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(fileBuffer);
  });
}

export async function uploadImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Image file is required",
      });
    }

    const result = await uploadBuffer(req.file.buffer);

    res.status(201).json({
      success: true,
      file_url: result.secure_url,
    });
  } catch (error) {
    next(error);
  }
}
