import { Router } from "express";

import userController from "../controllers/userController.js";

const router = Router();

router.get("/", userController.getUsersReq);
router.get("/:id", userController.getUserReq);
router.post("/", userController.createUserReq);
router.put("/:id", userController.updateUserReq);
router.delete("/:id", userController.deleteUserReq);

export default router;
