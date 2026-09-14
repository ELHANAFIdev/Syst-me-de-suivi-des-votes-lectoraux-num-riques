import { test, expect } from '@playwright/test';

test.describe('UI Elements Check', () => {
  
  test('Login page displays correct texts and elements', async ({ page }) => {
    // Navigate to the main login page
    await page.goto('/');

    // Check the main heading
    const mainHeading = page.getByRole('heading', { name: 'دخول مكاتب التصويت' });
    await expect(mainHeading).toBeVisible();

    // Check the subtitle
    await expect(page.getByText('أدخل الرقم السري الممنوح لك للدخول إلى مكتبك مباشرة')).toBeVisible();

    // Check the input instruction text
    await expect(page.getByText('الرقم السري يتكون من 6 أرقام.')).toBeVisible();

    // Try clicking login without entering a PIN to see if HTML5 validation works
    const loginButton = page.getByRole('button', { name: 'الدخول المباشر' });
    
    // The button should be disabled initially because pin length < 6
    await expect(loginButton).toBeDisabled();

    // Fill a 3 digit pin, button should still be disabled
    await page.getByPlaceholder('••••••').fill('123');
    await expect(loginButton).toBeDisabled();
    
    // Fill 6 digits, button should be enabled
    await page.getByPlaceholder('••••••').fill('123456');
    await expect(loginButton).toBeEnabled();
  });

});
