import authMiddleware from "../middlewares/authMiddleware.js";
import { Router } from "express";

import loginController from "../controllers/loginController.js";

const router = Router();

router.post("/", loginController.loginReq);
router.post("/logout", authMiddleware, loginController.exitReq);

export default router;