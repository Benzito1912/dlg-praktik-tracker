import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:4173', locale: 'da-DK', timezoneId: 'Europe/Copenhagen', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    env: { VITE_SUPABASE_URL: 'https://tracker-test.supabase.co', VITE_SUPABASE_ANON_KEY: 'test-publishable-key' },
    reuseExistingServer: false,
  },
})
