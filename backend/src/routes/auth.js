import express from "express";
import authentication from "../controller/auth.js"
import authValidators from "../utils/validators/auth.js";
import validateRequest from "../utils/validateRequest.js";
import auth from "../middlewares/auth.js";
import { rateLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

// No access token exists yet at this point, so this pair is throttled by
// IP instead of by user - the one place in the app that still needs an
// IP-keyed limit, since it's exactly what stops signin/signup spamming
// (credential stuffing, fake account creation).
const signinSignupLimiter = rateLimiter({
    windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 60 * 1000,
    maxRequests: Number(process.env.RATE_LIMIT_AUTH_MAX) || 5,
    keyPrefix: "rate-limit:auth:",
    message: "Too many sign-in/signup attempts. Please try again in a minute.",
});

// Validation runs before the rate limiter so malformed requests (typos in
// email/password shape, etc.) get a normal 400 instead of quietly eating a
// slot from the 5/min IP quota meant for actual signin/signup attempts.
router.post("/signup", authValidators.signupValidator, validateRequest, signinSignupLimiter, authentication.signup);
router.post("/signin", authValidators.signinValidator, validateRequest, signinSignupLimiter, authentication.signin);
router.post("/refresh-token", authValidators.refreshTokenValidator, validateRequest, authentication.refreshToken);
router.post("/logout", authValidators.refreshTokenValidator, validateRequest, authentication.logout);
router.post("/logout-all", authValidators.refreshTokenValidator, validateRequest, authentication.logoutAll);
router.post("/forgot-password", authValidators.forgotPasswordValidator, validateRequest, authentication.forgotPassword);
router.post("/reset-password", authValidators.resetPasswordValidator, validateRequest, authentication.resetPassword);
router.delete("/delete-account", auth, authValidators.deleteAccountValidator, validateRequest, authentication.deleteAccount);
router.patch("/change-password", auth, authValidators.changePasswordValidator, validateRequest, authentication.changePassword);

export default router;

// /signup and /signin issue an accessToken + refreshToken pair.
// /refresh-token exchanges a valid refreshToken for a new accessToken.
// /logout clears only the refreshToken sent in; /logout-all clears every refreshToken for that user.
// /forgot-password issues a short-lived resetToken; /reset-password consumes it to set a new password
// and, as a side effect, signs the user out of every device.
