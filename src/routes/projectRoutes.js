import projectController from "../controllers/projectController.js";
import { Router } from "express";

const router = Router();

router.post("/", projectController.createProjectReq);
router.get("/", projectController.getProjectsReq);
router.get("/userProjects", projectController.getProjectsByUserIdReq);
router.get("/:id", projectController.getProjectReq);
router.put("/:id", projectController.updateProjectReq);
router.delete("/:id", projectController.deleteProjectReq);
router.get("/:id/download", projectController.downloadProjectReq);

export default router;
