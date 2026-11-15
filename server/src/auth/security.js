import jwt from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "learnloop_session";
const tokenLifetimeSeconds = 7 * 24 * 60 * 60;

export function createAuthToken(userId, config) {
  return jwt.sign({}, config.jwtSecret, {
    algorithm: "HS256",
    audience: "learnloop-client",
    expiresIn: tokenLifetimeSeconds,
    issuer: "learnloop-api",
    subject: userId.toString(),
  });
}

function authCookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: config.cookieSameSite,
    path: "/api",
  };
}

export function setAuthCookie(response, token, config) {
  response.cookie(AUTH_COOKIE_NAME, token, {
    ...authCookieOptions(config),
    maxAge: tokenLifetimeSeconds * 1000,
  });
}

export function clearAuthCookie(response, config) {
  response.clearCookie(AUTH_COOKIE_NAME, authCookieOptions(config));
}

export function requireTrustedOrigin(config) {
  return function verifyOrigin(request, response, next) {
    const allowedOrigins = config.clientOrigins ?? [config.clientOrigin];
    if (!allowedOrigins.includes(request.get("origin"))) {
      return response.status(403).json({
        success: false,
        error: {
          code: "UNTRUSTED_ORIGIN",
          message: "Request origin is not allowed",
        },
      });
    }

    return next();
  };
}

export function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function createAuthMiddleware({ config, UserModel }) {
  return async function requireAuth(request, response, next) {
    const token = request.cookies[AUTH_COOKIE_NAME];
    if (!token) {
      return response.status(401).json({
        success: false,
        error: { code: "UNAUTHENTICATED", message: "Authentication required" },
      });
    }

    let claims;
    try {
      claims = jwt.verify(token, config.jwtSecret, {
        algorithms: ["HS256"],
        audience: "learnloop-client",
        issuer: "learnloop-api",
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return response.status(401).json({
          success: false,
          error: { code: "INVALID_SESSION", message: "Please sign in again" },
        });
      }
      return next(error);
    }

    if (typeof claims === "string" || typeof claims.sub !== "string") {
      return response.status(401).json({
        success: false,
        error: { code: "INVALID_SESSION", message: "Please sign in again" },
      });
    }

    const user = await UserModel.findById(claims.sub);
    if (!user) {
      return response.status(401).json({
        success: false,
        error: { code: "INVALID_SESSION", message: "Please sign in again" },
      });
    }

    request.authUser = user;
    return next();
  };
}
