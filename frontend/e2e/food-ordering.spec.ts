import { expect, test } from "@playwright/test";

import { installApiMocks, loginAs } from "./helpers";

test("customer discovers a food store and adds an item to cart", async ({ page }) => {
  await installApiMocks(page);
  await loginAs(page, "CUSTOMER");

  await page.goto("/customer");
  await expect(page.getByRole("heading", { name: "Customer" })).toBeVisible();
  await page.getByLabel("Delivery address").fill("Indiranagar");
  await page.getByRole("button", { name: "Set" }).click();
  await expect(page.getByText("MoveX Kitchen")).toBeVisible();

  await page.getByRole("link", { name: /MoveX Kitchen/ }).click();
  await expect(page.getByText("Paneer Biryani")).toBeVisible();
  await page.getByRole("button", { name: /Add to cart|Customize/ }).first().click();
  await expect(page.getByText(/Cart|Paneer Biryani/)).toBeVisible();
});
