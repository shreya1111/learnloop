import { Router } from "express";
import { User } from "../models/User.js";
import { profileUpdateSchema } from "../auth/schemas.js";
import {
  createAuthMiddleware,
  requireTrustedOrigin,
  serializeUser,
} from "../auth/security.js";

export function createUserRouter({ config, UserModel = User }) {
  const router = Router();
  const requireAuth = createAuthMiddleware({ config, UserModel });
  const verifyOrigin = requireTrustedOrigin(config);

  router.get("/me", requireAuth, (request, response) =>
    response.json({
      success: true,
      data: { user: serializeUser(request.authUser) },
    }),
  );

  router.patch("/me", verifyOrigin, requireAuth, async (request, response) => {
    const parsed = profileUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the submitted fields",
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
    }

    request.authUser.name = parsed.data.name;
    await request.authUser.save();
    return response.json({
      success: true,
      data: { user: serializeUser(request.authUser) },
    });
  });

  return router;
}
