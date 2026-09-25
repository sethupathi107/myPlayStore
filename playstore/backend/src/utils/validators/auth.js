import { body } from "express-validator";

const email = body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Email must be a valid email address")
    .normalizeEmail();

const password = field => body(field)
    .notEmpty().withMessage(`${field} is required`)
    .isString().withMessage(`${field} must be a string`)
    .isLength({ min: 6 }).withMessage(`${field} must be at least 6 characters long`);

const signupValidator = [
    body("name")
        .trim()
        .notEmpty().withMessage("Name is required")
        .isLength({ min: 2, max: 100 }).withMessage("Name must be between 2 and 100 characters"),
    email,
    password("password")
];

const signinValidator = [
    email,
    body("password")
        .notEmpty().withMessage("Password is required")
        .isString().withMessage("Password must be a string")
];

const refreshTokenValidator = [
    body("refreshToken")
        .notEmpty().withMessage("Refresh token is required")
        .isString().withMessage("Refresh token must be a string")
];

const forgotPasswordValidator = [
    email
];

const resetPasswordValidator = [
    body("resetToken")
        .notEmpty().withMessage("Reset token is required")
        .isString().withMessage("Reset token must be a string"),
    password("newPassword")
];

const deleteAccountValidator =[
    password("password")
]

const changePasswordValidator = [
    body("currentPassword")
        .notEmpty().withMessage("Current password is required")
        .isString().withMessage("Current password must be a string"),
    password("newPassword")
];

export default {
    signupValidator,
    signinValidator,
    refreshTokenValidator,
    forgotPasswordValidator,
    resetPasswordValidator,
    deleteAccountValidator,
    changePasswordValidator
};
