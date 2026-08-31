import { Router } from "express";

import fileController from "../controllers/fileController.js";
import upload from "../config/multer.js";

const router = Router();

router.post("/", upload.single("file"), fileController.uploadFileReq);
router.get("/:fileId", fileController.downloadFileReq);
router.delete("/:fileId", fileController.deleteFileReq);
router.get("/", fileController.getFilesReq);

export default router;