// The e2e owner account. scripts/e2e-db.ts creates it in the throwaway
// cv_e2e database before every run; these values never reach a real database.
export const E2E_ADMIN = {
  email: "owner@e2e.example.com",
  password: "e2e-owner-password-0001",
  secret: "e2e-only-better-auth-secret-0000000000",
} as const;
