import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { User } from "../models/User.js";
import { loginSchema, registerSchema } from "./schemas.js";
import {
  clearAuthCookie,
  createAuthMiddleware,
  createAuthToken,
  requireTrustedOrigin,
  serializeUser,
  setAuthCookie,
} from "./security.js";

function invalidInput(response, issues) {
  return response.status(400).json({
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Check the submitted fields",
      details: issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    },
  });
}

export function createAuthRouter({ config, UserModel = User }) {
  const router = Router();
  const requireAuth = createAuthMiddleware({ config, UserModel });
  const verifyOrigin = requireTrustedOrigin(config);
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_request, response) {
      response.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many authentication attempts; try again later",
        },
      });
    },
  });

  router.post("/register", authLimiter, verifyOrigin, async (request, response) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidInput(response, parsed.error.issues);
    }

    const { name, email, password } = parsed.data;
    const existingUser = await UserModel.exists({ email });
    if (existingUser) {
      return response.status(409).json({
        success: false,
        error: {
          code: "EMAIL_IN_USE",
          message: "An account with this email already exists",
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    let user;
    try {
      user = await UserModel.create({ name, email, passwordHash });
    } catch (error) {
      if (error.code === 11000) {
        return response.status(409).json({
          success: false,
          error: {
            code: "EMAIL_IN_USE",
            message: "An account with this email already exists",
          },
        });
      }
      throw error;
    }

    setAuthCookie(response, createAuthToken(user._id, config), config);
    return response.status(201).json({
      success: true,
      data: { user: serializeUser(user) },
    });
  });

  router.post("/login", authLimiter, verifyOrigin, async (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidInput(response, parsed.error.issues);
    }

    const { email, password } = parsed.data;
    const user = await UserModel.findOne({ email }).select("+passwordHash");
    const passwordMatches =
      user && (await bcrypt.compare(password, user.passwordHash));

    if (!passwordMatches) {
      return response.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect",
        },
      });
    }

    setAuthCookie(response, createAuthToken(user._id, config), config);
    return response.json({ success: true, data: { user: serializeUser(user) } });
  });

  router.post("/logout", verifyOrigin, (_request, response) => {
    clearAuthCookie(response, config);
    return response.json({ success: true, data: { loggedOut: true } });
  });

  router.get("/me", requireAuth, (request, response) =>
    response.json({
      success: true,
      data: { user: serializeUser(request.authUser) },
    }),
  );

  return router;
}
