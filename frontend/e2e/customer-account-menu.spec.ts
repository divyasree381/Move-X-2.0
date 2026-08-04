import { expect, test } from "@playwright/test";

import { installApiMocks, loginAs } from "./helpers";

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
  await loginAs(page, "CUSTOMER");
});

test("customer account menu toggles and closes through standard dismissal actions", async ({
  page,
}) => {
  await page.goto("/about");

  const trigger = page.getByRole("button", { name: "Customer account menu" });
  const profileLink = page.getByRole("link", { name: "Profile and addresses" });

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(profileLink).toBeVisible();

  await page.getByText("+919876543210").click();
  await expect(profileLink).toBeVisible();

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(profileLink).toBeHidden();

  await trigger.click();
  await page
    .getByRole("navigation", { name: "Public navigation" })
    .getByRole("link", { name: "About" })
    .click();
  await expect(profileLink).toBeHidden();

  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(profileLink).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("customer account menu behaves consistently on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about");

  const trigger = page.getByRole("button", { name: "Customer account menu" });
  const profileLink = page.getByRole("link", { name: "Profile and addresses" });

  await trigger.click();
  await expect(profileLink).toBeVisible();

  await page.locator("main").click({ position: { x: 12, y: 12 } });
  await expect(profileLink).toBeHidden();
});
