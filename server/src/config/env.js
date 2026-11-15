import { z } from "zod";

// Accept the value people actually paste into a dashboard: a bare host, a bare
// host with a trailing slash, or a URL with a path-free slash on the end.
function normalizeClientOrigin(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  return withoutTrailingSlash.includes("://")
    ? withoutTrailingSlash
    : `https://${withoutTrailingSlash}`;
}

function allowedClientOrigins(clientOrigin, nodeEnv) {
  const origins = new Set([clientOrigin]);
  if (nodeEnv === "production") {
    return [...origins];
  }

  const configured = new URL(clientOrigin);
  if (configured.hostname === "localhost" || configured.hostname === "127.0.0.1") {
    for (const hostname of ["localhost", "127.0.0.1"]) {
      const alias = new URL(clientOrigin);
      alias.hostname = hostname;
      origins.add(alias.origin);
    }
  }

  return [...origins];
}

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    CLIENT_ORIGIN: z.preprocess(
      normalizeClientOrigin,
      z
        .string()
        .url()
        .refine((value) => {
          try {
            return new URL(value).origin === value;
          } catch {
            return false;
          }
        }, "must be an origin without a path")
        .default("http://localhost:5173"),
    ),
    COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    MONGODB_URI: z
      .string()
      .min(1)
      .default("mongodb://127.0.0.1:27017/courseit_clone"),
    JWT_SECRET: z.string().min(32, "must be at least 32 characters"),
    YOUTUBE_API_KEY: z.string().trim().default(""),
    GEMINI_API_KEY: z.string().trim().default(""),
    GEMINI_MODEL: z.string().trim().min(1).max(100).default("gemini-2.5-flash"),
  })
  .superRefine((config, context) => {
    if (config.COOKIE_SAME_SITE === "none" && config.NODE_ENV !== "production") {
      context.addIssue({
        code: "custom",
        path: ["COOKIE_SAME_SITE"],
        message: "none requires NODE_ENV=production so cookies are Secure",
      });
    }
    if (
      config.NODE_ENV === "production" &&
      new URL(config.CLIENT_ORIGIN).protocol !== "https:"
    ) {
      context.addIssue({
        code: "custom",
        path: ["CLIENT_ORIGIN"],
        message:
          config.CLIENT_ORIGIN === "http://localhost:5173"
            ? "is not set on this service; add CLIENT_ORIGIN to the API service variables with the https:// origin of the web app (HTTPS is required in production), for example https://your-app.up.railway.app"
            : `must use HTTPS in production; received ${config.CLIENT_ORIGIN}. Set CLIENT_ORIGIN on the API service to the https:// origin of the web app`,
      });
    }
  });

export function loadConfig(source = process.env) {
  const result = environmentSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return {
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    trustProxy: result.data.TRUST_PROXY,
    clientOrigin: result.data.CLIENT_ORIGIN,
    clientOrigins: allowedClientOrigins(
      result.data.CLIENT_ORIGIN,
      result.data.NODE_ENV,
    ),
    cookieSameSite: result.data.COOKIE_SAME_SITE,
    mongoUri: result.data.MONGODB_URI,
    jwtSecret: result.data.JWT_SECRET,
    youtubeApiKey: result.data.YOUTUBE_API_KEY || undefined,
    geminiApiKey: result.data.GEMINI_API_KEY || undefined,
    geminiModel: result.data.GEMINI_MODEL,
  };
}
