import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ensureDevDatabase,
  localMongoTarget,
} from "../src/config/devDatabase.js";

test("targets a loopback development database", () => {
  assert.deepEqual(
    localMongoTarget("mongodb://127.0.0.1:28017/courseit_clone", {
      nodeEnv: "development",
    }),
    { host: "127.0.0.1", port: 28017 },
  );
});

test("treats localhost as loopback", () => {
  assert.deepEqual(
    localMongoTarget("mongodb://localhost:27017/courseit_clone", {
      nodeEnv: "development",
    }),
    { host: "127.0.0.1", port: 27017 },
  );
});

test("falls back to the default MongoDB port", () => {
  assert.deepEqual(
    localMongoTarget("mongodb://localhost/courseit_clone", {
      nodeEnv: "development",
    }),
    { host: "127.0.0.1", port: 27017 },
  );
});

test("ignores production environments", () => {
  assert.equal(
    localMongoTarget("mongodb://127.0.0.1:27017/courseit_clone", {
      nodeEnv: "production",
    }),
    null,
  );
});

test("ignores test environments", () => {
  assert.equal(
    localMongoTarget("mongodb://127.0.0.1:27017/courseit_clone", {
      nodeEnv: "test",
    }),
    null,
  );
});

test("ignores remote clusters", () => {
  assert.equal(
    localMongoTarget("mongodb+srv://cluster.example.com/courseit_clone", {
      nodeEnv: "development",
    }),
    null,
  );
  assert.equal(
    localMongoTarget("mongodb://10.0.0.5:27017/courseit_clone", {
      nodeEnv: "development",
    }),
    null,
  );
});

test("ignores non-MongoDB URIs", () => {
  assert.equal(
    localMongoTarget("postgres://127.0.0.1:5432/app", {
      nodeEnv: "development",
    }),
    null,
  );
  assert.equal(localMongoTarget("not a uri", { nodeEnv: "development" }), null);
});

test("honours the auto-start opt-out", () => {
  assert.equal(
    localMongoTarget("mongodb://127.0.0.1:27017/courseit_clone", {
      nodeEnv: "development",
      autoStart: false,
    }),
    null,
  );
});

test("does nothing outside development", async () => {
  const started = await ensureDevDatabase({
    mongoUri: "mongodb://127.0.0.1:27017/courseit_clone",
    nodeEnv: "test",
    log: () => {},
  });
  assert.equal(started, false);
});

test("does nothing when auto-start is disabled", async () => {
  const started = await ensureDevDatabase({
    mongoUri: "mongodb://127.0.0.1:27017/courseit_clone",
    nodeEnv: "development",
    autoStart: false,
    log: () => {},
  });
  assert.equal(started, false);
});
