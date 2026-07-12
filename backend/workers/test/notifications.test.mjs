import assert from "node:assert/strict";
import { test } from "node:test";

import { contentForEvent, emailContentForEvent } from "../dist/notifications.js";

test("standard events produce customer-safe notification content", () => {
  const content = contentForEvent("ride.accepted", {});
  assert.equal(content.title, "Ride accepted");
  assert.equal(content.body, "Your ride has been accepted.");
  assert.equal(content.type, "RIDE");
});

test("ordinary events do not receive staff lifecycle links", () => {
  const content = contentForEvent("order.created", {});
  assert.deepEqual(emailContentForEvent("order.created", {}, content), content);
});
