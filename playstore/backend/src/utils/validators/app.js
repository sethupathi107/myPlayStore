import { body, param, query } from "express-validator";

const getAllAppsValidator = [
    query("page")
        .optional()
        .isInt({ min: 1 }).withMessage("page must be a positive integer"),
    query("limit")
        .optional()
        .isInt({ min: 1 }).withMessage("limit must be a positive integer"),
    query("categoryId")
        .optional()
        .isUUID().withMessage("categoryId must be a valid UUID"),
    query("excludeId")
        .optional()
        .isUUID().withMessage("excludeId must be a valid UUID"),
    query("mine")
        .optional()
        .isIn(["true", "false", "1", "0"]).withMessage("mine must be true or false"),
];

const createAppValidator = [
    body("name")
        .trim()
        .notEmpty().withMessage("Name is required")
        .isLength({ min: 1, max: 150 }).withMessage("Name must be between 1 and 150 characters"),
    body("categoryId")
        .trim()
        .notEmpty().withMessage("Category is required")
        .isUUID().withMessage("categoryId must be a valid UUID"),
    body("description")
        .optional()
        .isString().withMessage("Description must be a string")
        .isLength({ max: 2000 }).withMessage("Description must be at most 2000 characters")
];

const downloadAppValidator =[
    body("applicationId")
        .notEmpty().withMessage("App id is required")
        .isUUID().withMessage("App must be a valid UUID"),
]

const updateAppValidator = [
    body("id")
        .notEmpty().withMessage("App id is required")
        .isUUID().withMessage("App must be a valid UUID"),
    body("name")
        .optional()
        .trim()
        .isLength({ min: 1, max: 150 }).withMessage("Name must be between 1 and 150 characters"),
    body("categoryId")
        .optional()
        .trim()
        .isUUID().withMessage("categoryId must be a valid UUID"),
    body("description")
        .optional()
        .isString().withMessage("Description must be a string")
        .isLength({ max: 2000 }).withMessage("Description must be at most 2000 characters")
];

const appIdBodyValidator = [
    body("applicationId")
        .notEmpty().withMessage("App id is required")
        .isUUID().withMessage("App must be a valid UUID"),
];

export default {
    getAllAppsValidator,
    downloadAppValidator,
    createAppValidator,
    updateAppValidator,
    appIdBodyValidator
};
