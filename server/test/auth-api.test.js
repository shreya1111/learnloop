import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { setAuthCookie } from "../src/auth/security.js";

const config = loadConfig({
  NODE_ENV: "test",
  JWT_SECRET: "test-secret-with-more-than-thirty-two-characters",
  CLIENT_ORIGIN: "http://localhost:5173",
});

function createMemoryUserModel() {
  const users = new Map();

  return {
    async exists({ email }) {
      return [...users.values()].some((user) => user.email === email);
    },
    async create(fields) {
      if ([...users.values()].some((user) => user.email === fields.email)) {
        const error = new Error("Duplicate email");
        error.code = 11000;
        throw error;
      }

      const user = {
        _id: randomUUID(),
        ...fields,
        createdAt: new Date(),
        updatedAt: new Date(),
        async save() {
          this.updatedAt = new Date();
          users.set(this._id, this);
        },
      };
      users.set(user._id, user);
      return user;
    },
    findOne({ email }) {
      return {
        select: async () =>
          [...users.values()].find((user) => user.email === email) ?? null,
      };
    },
    async findById(id) {
      return users.get(id) ?? null;
    },
  };
}

const server = createApp({ config, UserModel: createMemoryUserModel() }).listen(0);
const baseUrl = await new Promise((resolve) => {
  server.once("listening", () => {
    resolve(`http://127.0.0.1:${server.address().port}`);
  });
});

after(() => new Promise((resolve, reject) => {
  server.close((error) => (error ? reject(error) : resolve()));
}));

async function request(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(method !== "GET" ? { origin: config.clientOrigin } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return response;
}

test("register, authenticate, update profile, and log out", async () => {
  const registration = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "  Sam Learner ",
      email: " SAM@example.com ",
      password: "correct-horse-battery-staple",
    },
  });
  assert.equal(registration.status, 201);

  const registrationBody = await registration.json();
  assert.equal(registrationBody.data.user.name, "Sam Learner");
  assert.equal(registrationBody.data.user.email, "sam@example.com");
  assert.equal("passwordHash" in registrationBody.data.user, false);

  const duplicateRegistration = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "Sam Learner",
      email: "sam@example.com",
      password: "correct-horse-battery-staple",
    },
  });
  assert.equal(duplicateRegistration.status, 409);

  const setCookie = registration.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\/api/i);
  const cookie = setCookie.split(";")[0];

  const currentUser = await request("/api/auth/me", { cookie });
  assert.equal(currentUser.status, 200);
  assert.equal((await currentUser.json()).data.user.email, "sam@example.com");

  const profile = await request("/api/users/me", { cookie });
  assert.equal(profile.status, 200);
  assert.equal((await profile.json()).data.user.email, "sam@example.com");

  const profileUpdate = await request("/api/users/me", {
    method: "PATCH",
    cookie,
    body: { name: "Sam Updated" },
  });
  assert.equal(profileUpdate.status, 200);
  assert.equal((await profileUpdate.json()).data.user.name, "Sam Updated");

  const incorrectLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "sam@example.com", password: "incorrect-password" },
  });
  assert.equal(incorrectLogin.status, 401);

  const login = await request("/api/auth/login", {
    method: "POST",
    body: {
      email: " SAM@example.com ",
      password: "correct-horse-battery-staple",
    },
  });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /HttpOnly/i);

  const logout = await request("/api/auth/logout", { method: "POST", cookie });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /learnloop_session=;/);

  const unauthenticated = await request("/api/auth/me");
  assert.equal(unauthenticated.status, 401);
});

test("rejects expired and malformed session tokens", async () => {
  const expiredToken = jwt.sign({}, config.jwtSecret, {
    algorithm: "HS256",
    audience: "learnloop-client",
    expiresIn: -1,
    issuer: "learnloop-api",
    subject: randomUUID(),
  });
  const expiredResponse = await request("/api/auth/me", {
    cookie: `learnloop_session=${expiredToken}`,
  });
  assert.equal(expiredResponse.status, 401);
  assert.equal((await expiredResponse.json()).error.code, "INVALID_SESSION");

  const malformedResponse = await request("/api/auth/me", {
    cookie: "learnloop_session=not-a-jwt",
  });
  assert.equal(malformedResponse.status, 401);
  assert.equal((await malformedResponse.json()).error.code, "INVALID_SESSION");
});

test("rejects malformed registration input", async () => {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "A",
      email: "not-an-email",
      password: "short",
      role: "admin",
    },
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
});

test("rejects writes from an untrusted browser origin", async () => {
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { origin: "https://untrusted.example" },
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "UNTRUSTED_ORIGIN");
});

test("reports the database as unavailable instead of healthy", async () => {
  const response = await request("/api/health");
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.success, false);
  assert.equal(body.data.database, "disconnected");
  assert.match(response.headers.get("content-security-policy"), /youtube-nocookie\.com/);
  assert.ok(response.headers.get("x-content-type-options"));
});

test("normalizes client origins pasted into deployment settings", () => {
  const secret = "test-secret-with-more-than-thirty-two-characters";
  const config = (origin) =>
    loadConfig({
      NODE_ENV: "production",
      CLIENT_ORIGIN: origin,
      JWT_SECRET: secret,
    });

  assert.equal(config("learnloop.up.railway.app").clientOrigin, "https://learnloop.up.railway.app");
  assert.equal(
    config(" https://learnloop.up.railway.app/ ").clientOrigin,
    "https://learnloop.up.railway.app",
  );
  assert.deepEqual(config("learnloop.up.railway.app").clientOrigins, [
    "https://learnloop.up.railway.app",
  ]);
});

test("requires secure production mode for cross-site cookies", () => {
  assert.throws(
    () =>
      loadConfig({
        NODE_ENV: "development",
        COOKIE_SAME_SITE: "none",
        JWT_SECRET: "test-secret-with-more-than-thirty-two-characters",
      }),
    /COOKIE_SAME_SITE.*production/,
  );
  assert.throws(
    () =>
      loadConfig({
        NODE_ENV: "production",
        CLIENT_ORIGIN: "http://learnloop.example.com",
        JWT_SECRET: "test-secret-with-more-than-thirty-two-characters",
      }),
    /CLIENT_ORIGIN.*HTTPS/,
  );
  assert.equal(
    loadConfig({
      NODE_ENV: "production",
      CLIENT_ORIGIN: "https://learnloop.example.com",
      JWT_SECRET: "test-secret-with-more-than-thirty-two-characters",
    }).clientOrigin,
    "https://learnloop.example.com",
  );

  let cookieOptions;
  const productionConfig = loadConfig({
    NODE_ENV: "production",
    CLIENT_ORIGIN: "https://learnloop.example.com",
    JWT_SECRET: "test-secret-with-more-than-thirty-two-characters",
  });
  setAuthCookie(
    {
      cookie(_name, _token, options) {
        cookieOptions = options;
      },
    },
    "test-token",
    productionConfig,
  );
  assert.equal(cookieOptions.httpOnly, true);
  assert.equal(cookieOptions.secure, true);
});
