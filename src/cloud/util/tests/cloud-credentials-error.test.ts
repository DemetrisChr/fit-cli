/**
 * Unit tests for shouldSkipUnusableCloud.
 *
 * Run on their own:
 *   node --import tsx --test src/cloud/util/tests/cloud-credentials-error.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { CloudCredentialsError, shouldSkipUnusableCloud } from "../cloud-credentials-error.js";

test("skips a cloud with unusable credentials when running locally", () => {
  assert.equal(shouldSkipUnusableCloud(new CloudCredentialsError("invalid_grant"), {}), true);
});

test("never skips on GitHub Actions, where both clouds should always be set up", () => {
  assert.equal(shouldSkipUnusableCloud(new CloudCredentialsError("invalid_grant"), { GITHUB_ACTIONS: "true" }), false);
});

test("never skips other failures, e.g. an API error after credentials checked out", () => {
  assert.equal(shouldSkipUnusableCloud(new Error("quota exceeded"), {}), false);
  assert.equal(shouldSkipUnusableCloud("not even an Error", {}), false);
});
