import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { URL } from "node:url";

const customerFiles = [
  "src/components/public/public-site.tsx",
  "src/components/orders/checkout-page.tsx",
  "src/components/rides/ride-booking-page.tsx",
  "src/components/couriers/courier-booking-page.tsx",
];

test("customer surfaces do not expose internal product language", () => {
  const source = customerFiles.map((file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8")).join("\n");
  for (const phrase of ["backend will connect later", "frontend preview", "for mvp", "stub badge"]) {
    assert.equal(source.toLowerCase().includes(phrase), false, `Unexpected internal phrase: ${phrase}`);
  }
});
