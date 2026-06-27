import { expect, test } from "@playwright/test";

import { installApiMocks, loginAs } from "./helpers";

test("customer books a ride and driver sees the queue", async ({ page }) => {
  await installApiMocks(page);
  await loginAs(page, "CUSTOMER");

  await page.goto("/customer/rides");
  await expect(page.getByRole("heading", { name: "Book a ride" })).toBeVisible();
  await expect(page.getByText(/Rs 96/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm ride" }).click();
  await expect(page.getByText("Ride requested")).toBeVisible();
  await expect(page.getByText("Drivers offered: 2")).toBeVisible();

  await page.context().clearCookies();
  await loginAs(page, "DRIVER");
  await page.goto("/partner/rides");
  await expect(page.getByRole("heading", { name: "Queue Control" })).toBeVisible();
  await page.getByRole("button", { name: "Go online" }).click();
  await expect(page.getByText(/REQUESTED|Indiranagar|MG Road/)).toBeVisible();
});
