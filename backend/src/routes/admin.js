import express from "express"; 
import adminController from "../controller/admin.js";

const router = express.Router();

router.get("/activity", adminController.getActivity);
router.get("/logs", adminController.getLogs);
router.get("/logs/export", adminController.exportLogs);
router.get("/downloads-history", adminController.getDownloadsHistory);
router.get("/apps-by-category", adminController.getAppsByCategory);
router.get("/downloads-by-category", adminController.getDownloadsByCategory);

export default router;