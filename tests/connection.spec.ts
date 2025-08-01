import { test, expect } from '@playwright/test';

test.describe('KDB+ Visualizer Connection', () => {
  test('should display connection form on landing page', async ({ page }) => {
    await page.goto('/');
    
    // Check if the connection form is visible
    await expect(page.getByText('KDB+ Visualizer')).toBeVisible();
    await expect(page.getByLabel('Host')).toBeVisible();
    await expect(page.getByLabel('Port')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    await page.goto('/');
    
    // Clear the host field and try to connect
    await page.getByLabel('Host').clear();
    await page.getByLabel('Port').clear();
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Check for validation errors
    await expect(page.getByText('Host is required')).toBeVisible();
    await expect(page.getByText('Port is required')).toBeVisible();
  });

  test('should connect to localhost successfully', async ({ page }) => {
    await page.goto('/');
    
    // Fill in connection details
    await page.getByLabel('Host').fill('localhost');
    await page.getByLabel('Port').fill('4000');
    
    // Click connect
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Wait for the dashboard to load
    await expect(page.getByText('Connected to localhost:4000')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Tables')).toBeVisible();
  });

  test('should display tables in sidebar after connection', async ({ page }) => {
    await page.goto('/');
    
    // Connect
    await page.getByLabel('Host').fill('localhost');
    await page.getByLabel('Port').fill('4000');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Wait for dashboard and check tables
    await expect(page.getByText('Tables')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('trades')).toBeVisible();
    await expect(page.getByText('quotes')).toBeVisible();
  });
});