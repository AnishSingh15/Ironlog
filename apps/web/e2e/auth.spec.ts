import { expect, test } from './test-utils';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // A fresh Playwright page starts at about:blank, an opaque origin where localStorage
    // access throws a SecurityError - must navigate to the real origin first.
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.context().clearCookies();
  });

  test('should redirect to login from protected pages', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('should register a new user', async ({ page }) => {
    await page.goto('/login');
    await page.click('[data-testid="register-link"]');
    await expect(page).toHaveURL('/register');

    // Fill registration form
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    const testName = `Test User ${timestamp}`;
    const testPassword = 'TestPass123!';

    await page.fill('[data-testid="name-input"]', testName);
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', testPassword);
    await page.fill('[data-testid="confirm-password-input"]', testPassword);

    await page.click('[data-testid="register-button"]');

    // Should redirect to dashboard after successful registration. The greeting shows
    // only the first name (correct product behavior), not the full timestamped test name.
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText(testName.split(' ')[0]);
  });

  test('should login existing user', async ({ page }) => {
    await page.goto('/login');

    // Use default seeded user
    await page.fill('[data-testid="email-input"]', 'admin@ironlog.com');
    await page.fill('[data-testid="password-input"]', 'admin123');

    await page.click('[data-testid="login-button"]');

    // Should redirect to dashboard after successful login
    await expect(page).toHaveURL('/dashboard');

    // Should see the dashboard content
    await expect(page.getByText("Today's Workout")).toBeVisible();
  });

  test('should show validation errors for invalid inputs', async ({ page }) => {
    await page.goto('/login');

    // Try to submit with empty fields
    await page.click('[data-testid="login-button"]');

    // Should show inline field validation errors
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@ironlog.com');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="login-button"]');

    await expect(page).toHaveURL('/dashboard');

    // Logout - the sidebar's logout button is only visible at desktop widths
    // (`hidden md:flex`); on mobile it's the account menu's own entry instead.
    const sidebarLogout = page.locator('[data-testid="logout-button"]').first();
    if (await sidebarLogout.isVisible()) {
      await sidebarLogout.click();
    } else {
      await page.click('[data-testid="account-menu-button"]');
      await page.click('[data-testid="logout-button"]');
    }
    await expect(page).toHaveURL('/login');
  });
});
