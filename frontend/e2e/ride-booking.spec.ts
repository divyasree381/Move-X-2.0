import { expect, test } from "@playwright/test";

import { installApiMocks, loginAs } from "./helpers";

test("customer books a ride and driver sees the queue", async ({ page }) => {
  await installApiMocks(page);
  await loginAs(page, "CUSTOMER");

  await page.goto("/customer/rides");
  await expect(page.getByRole("heading", { name: "Where are you going?" })).toBeVisible();
  await page.getByRole("button", { name: /Work Koramangala/ }).click();
  await expect(page.getByRole("heading", { name: "Confirm Destination" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm Destination" }).click();
  await expect(page.getByRole("heading", { name: "Choose Your Ride" })).toBeVisible();
  await page.getByRole("button", { name: /Book Bike.*96/ }).click();
  await expect(page.getByText("Ride requested")).toBeVisible();
  await expect(page.getByText("2 nearby drivers received your request.")).toBeVisible();

  await page.context().clearCookies();
  await loginAs(page, "DRIVER");
  await page.goto("/partner/rides");
  await expect(page.getByRole("heading", { name: "Queue Control" })).toBeVisible();
  await page.getByRole("button", { name: "Go online" }).click();
  await expect(page.getByRole("heading", { name: "Nearby ride offers" })).toBeVisible();
  await expect(page.getByText("BIKE ride")).toBeVisible();
  await expect(page.getByText("REQUESTED")).toBeVisible();
});
