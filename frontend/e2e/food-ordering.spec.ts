import { expect, test } from "@playwright/test";

import { installApiMocks, loginAs } from "./helpers";

test("customer discovers a food store and adds an item to cart", async ({ page }) => {
  await installApiMocks(page);
  await loginAs(page, "CUSTOMER");

  await page.goto("/customer");
  await expect(page.getByRole("heading", { name: "What can we get moving?" })).toBeVisible();
  await page.getByRole("button", { name: /Services near .* Change/ }).click();
  await page.getByPlaceholder("Type area, landmark, or address").fill("Indiranagar");
  await page.getByRole("button", { name: "Set Location" }).click();
  await expect(page.getByText("MoveX Kitchen")).toBeVisible();

  await page.getByRole("link", { name: /MoveX Kitchen/ }).click();
  await expect(page.getByText("Paneer Biryani")).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Paneer Biryani quantity 1")).toBeVisible();
  await expect(page.getByRole("banner").getByRole("button", { name: "Cart with 1 items", exact: true })).toBeVisible();
});
