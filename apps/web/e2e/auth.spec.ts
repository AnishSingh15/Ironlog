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

    // Should redirect to dashboard after successful registration
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText(testName);
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
    await expect(page.locator('h5')).toContainText('Ready to Start Your Workout?');
  });

  test('should show validation errors for invalid inputs', async ({ page }) => {
    await page.goto('/login');

    // Try to submit with empty fields
    await page.click('[data-testid="login-button"]');

    // Should show validation errors
    await expect(page.locator('.MuiAlert-message')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@ironlog.com');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="login-button"]');

    await expect(page).toHaveURL('/dashboard');

    // Logout
    await page.click('[data-testid="logout-button"]');
    await expect(page).toHaveURL('/');
  });
});
