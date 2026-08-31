import shareController from "../controllers/shareController.js";
import {Router} from "express";
import authMiddleware from "../middlewares/authMiddleware.js"

const router = Router();

router.post("/:projectId", authMiddleware ,shareController.createShareReq);
router.get("/:token/download", shareController.downloadProjectByShare);


export default router;