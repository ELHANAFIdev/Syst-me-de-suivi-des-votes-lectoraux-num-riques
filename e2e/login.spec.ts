import { test, expect } from '@playwright/test';

test.describe('Authentication and Routing Flow', () => {
  
  test('Admin login successfully routes to /admin', async ({ page }) => {
    await page.goto('/admin/login');

    // Fill the Admin Email input
    await page.getByPlaceholder('admin@party.com').fill('admin@admin.com');
    
    // Fill the Password input
    await page.getByPlaceholder('••••••••').fill('AdminPassword123!');
    
    // Submit login
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

    // Verify routing to admin dashboard
    await expect(page).toHaveURL(/.*\/admin$/);
    await expect(page.getByText('إجمالي الناخبين المستهدفين')).toBeVisible();
  });

  test('Invalid PIN shows error message', async ({ page }) => {
    await page.goto('/');

    // Fill an invalid PIN
    await page.getByPlaceholder('••••••').fill('111111');
    await page.getByRole('button', { name: 'الدخول المباشر' }).click();

    // Wait for the alert/error to show up
    const errorMessage = page.locator('.text-red-700'); // Check for the error text class
    await expect(errorMessage).toContainText('الرقم السري غير صحيح');
  });
});
