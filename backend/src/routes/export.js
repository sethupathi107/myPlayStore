import express from "express";
import exportController from "../controller/export.js";

const router = express.Router();

router.get("/downloads-sync", exportController.exportDownloadsSync);
router.post("/downloads", exportController.requestExport);
router.get("/jobs/:id", exportController.getExportStatus);
router.get("/jobs/:id/download", exportController.downloadExportFile);

export default router;
