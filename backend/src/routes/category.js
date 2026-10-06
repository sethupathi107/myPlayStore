import express from "express";
import categoryController from "../controller/category.js";
import categoryValidators from "../utils/validators/category.js";
import validateRequest from "../utils/validateRequest.js";

const router = express.Router();

router.get("/", categoryController.getAllCategories);
router.post("/", categoryValidators.createCategoryValidator, validateRequest, categoryController.createCategory);
router.delete("/", categoryValidators.deleteCategoryValidator, validateRequest, categoryController.deleteCategory);

export default router;
