import authMiddleware from "../middlewares/authMiddleware.js";
import { requireFile, requireProject } from "../middlewares/projectAccess.js";
import { Router } from "express";

import fileController from "../controllers/fileController.js";
import upload from "../config/multer.js";

const router = Router();
router.use(authMiddleware);

router.post("/", upload.single("file"), requireProject(req => req.body.projectId), fileController.uploadFileReq);
router.get("/:fileId", requireFile, fileController.downloadFileReq);
router.delete("/:fileId", requireFile, fileController.deleteFileReq);
router.get("/", fileController.getFilesReq);

export default router;