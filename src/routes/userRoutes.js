import authMiddleware from "../middlewares/authMiddleware.js";
import { requireOwnUser } from "../middlewares/projectAccess.js";
import { Router } from "express";

import userController from "../controllers/userController.js";

const router = Router();
router.post("/", userController.createUserReq);
router.use(authMiddleware);

router.get("/search", userController.searchUserReq);
router.get("/", userController.getUsersReq);
router.get("/:id", userController.getUserReq);

router.put("/:id/password", requireOwnUser, userController.changePasswordReq);
router.put("/:id", requireOwnUser, userController.updateUserReq);
router.delete("/:id", requireOwnUser, userController.deleteUserReq);

export default router;
