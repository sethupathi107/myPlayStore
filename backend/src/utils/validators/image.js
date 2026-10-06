import { body } from "express-validator";

const appIdBody = body("applicationId")
    .notEmpty().withMessage("App applicationId is required")
    .isUUID().withMessage("App must be a valid UUID")

const imageIdBody = body("imageId")
    .notEmpty().withMessage("Image id is required")
    .isUUID().withMessage("Image id must be a valid UUID");

const appIdBodyValidator = [
    appIdBody
];

const deleteAppImageValidator = [
    appIdBody,
    body("imageId")
        .notEmpty().withMessage("imageId is required")
        .isUUID().withMessage("imageId must be a valid UUID")
];

const getImageFileValidator = [
    appIdBody,
    imageIdBody
];

export default {
    appIdBodyValidator,
    deleteAppImageValidator,
    getImageFileValidator
};
