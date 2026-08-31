import { Router } from "express";

import loginController from "../controllers/loginController.js";

const router = Router();

router.post("/", loginController.loginReq);

export default router;