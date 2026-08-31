import multer from "multer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);
    const filename = `${crypto.randomUUID()}${extension}`;

    cb(null, filename);
  }
});

const upload = multer({
  storage
});

export default upload;