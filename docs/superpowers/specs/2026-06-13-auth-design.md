# Authentication — KYC Sentinel Design Spec

**Date:** 2026-06-13
**Status:** Approved

## Context

KYC Sentinel (kyc-agentic2) currently has no authentication. All routes are publicly accessible. This spec covers adding Supabase email+password auth — the same pattern used in forge-test-harness — so that users must sign in before accessing the app, and their name is displayed throughout.

## Decisions

### 1. Supabase Project

Reuse the **existing forge-test-harness Supabase project** (`tbinrohphlzipnrmdvqd.supabase.co`). Users only need one account across both apps. The anon key is the same public key already in use in the test harness.

Credentials live in `src/lib/supabase.ts` (same pattern as forge-test-harness `src/lib/supabase.js`). Copy the `SUPABASE_URL` and `SUPABASE_ANON_KEY` values from `/Users/user/kyc-test-harness/forge-test-harness/src/lib/supabase.js`.

### 2. Domain Restriction

Sign-in and sign-up both require a `@kpmg.com` email address. Enforced client-side on submit with the error: `"Access is restricted to @kpmg.com email addresses."` Supabase handles the actual credential verification server-side.

### 3. Login Page — Split Panel

**Route:** `/login` (public, redirects to `/` if already authenticated)

Layout: full-screen, two columns.

**Left panel** (`bg-gradient-to-br from-blue-900 to-indigo-900`, `w-2/5`):
- KYC Sentinel brand block: 3px vertical gradient accent bar + `"KYC Sentinel"` (bold, 16px, white) + `"Powered by Forge"` (9px, muted, uppercase)
- Tagline: `"Intelligent KYC compliance, powered by AI"` in `text-blue-200`

**Right panel** (`bg-background`, `flex-1`), centered form:
- Two tabs: **Sign In** / **Sign Up** — toggle between forms, same URL `/login`
- **Sign In form:** Email input + Password input + "Sign In" button
- **Sign Up form:** Full Name input + Email input + Password input + "Create Account" button
  - Name stored via `supabase.auth.signUp({ data: { full_name: name } })`
  - Minimum password length: 8 characters (client-side validation)
- `@kpmg.com` check runs on submit for both forms
- Inline error message (red, below form) for auth failures and validation errors
- Button shows loading state (spinner) while awaiting Supabase response
- Uses existing shadcn/ui `Input` and `Button` components; respects light/dark mode

### 4. Auth Context

**File:** `src/contexts/AuthContext.tsx`

Provides `AuthContext` with:
```ts
interface AuthContextValue {
  user: User | null;   // Supabase User object (has user_metadata.full_name, email)
  loading: boolean;    // true during initial session restore
  signOut: () => Promise<void>;
}
```

On mount: calls `supabase.auth.getSession()` to restore existing session, then subscribes to `supabase.auth.onAuthStateChange` for subsequent login/logout events. Subscription cleaned up on unmount.

Exports `useAuth()` hook — throws if used outside `AuthProvider`.

### 5. Route Protection

**File:** `src/App.tsx`

- Wrap entire app with `<AuthProvider>`
- During `loading`, render a full-screen centered spinner (prevents flash of login page on refresh)
- If `user` is null, render only `<Route path="/login" element={<Login />} />` and redirect all other paths to `/login`
- If `user` is set, render `<Route path="/login" element={<Navigate to="/" />} />` + all existing app routes inside `AppLayout`

### 6. Sidebar — User Display & Logout

**File:** `src/components/AppLayout.tsx`

Replace the static `User` icon button in the nav header with a sidebar **footer section** (pinned to bottom of nav):

```
┌─────────────────────────┐
│  ● JD  John Doe         │
│        john@kpmg.com    │
│  [Log out]              │
└─────────────────────────┘
```

- Avatar circle: initials from `full_name` (first letter of first + last name), `bg-primary/20 text-primary`
- Full name: `text-[13px] font-medium text-nav-foreground`
- Email: `text-[11px] text-nav-muted`
- Log out button: `text-nav-muted hover:text-nav-foreground`, calls `signOut()` from `useAuth()`

Remove the existing static `User` icon from the header icon group (keep Bell and Sun/Moon toggle).

### 7. Name Personalization

**Files:** `src/pages/Dashboard.tsx`, `src/pages/WorkQueue.tsx`

Extract first name from `user_metadata.full_name`:
```ts
const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "My";
```

- `"Alex's Dashboard"` → `"{firstName}'s Dashboard"`
- `"Alex's Work Queue"` → `"{firstName}'s Work Queue"`

## Files Changed

| File | Change |
|------|--------|
| `src/lib/supabase.ts` | Create — Supabase client singleton |
| `src/contexts/AuthContext.tsx` | Create — auth context + useAuth hook |
| `src/pages/Login.tsx` | Create — split-panel login/signup page |
| `src/App.tsx` | Modify — AuthProvider wrapper + route guard |
| `src/components/AppLayout.tsx` | Modify — sidebar footer with user info + logout; remove User icon from header |
| `src/pages/Dashboard.tsx` | Modify — replace "Alex's" with firstName |
| `src/pages/WorkQueue.tsx` | Modify — replace "Alex's" with firstName |

## Out of Scope

- Password reset / forgot password flow
- OAuth providers (Google, Microsoft)
- Role-based access control
- Per-user data isolation (all users see same mock data)
- Email verification on sign-up (Supabase project setting — not configured here)

## Verification

1. `npm run dev` — app redirects to `/login` immediately
2. Sign up with `test@kpmg.com` — account created, redirected to dashboard
3. Sign up with `test@gmail.com` — blocked with domain error
4. Reload page — session restored, stays on dashboard (no flash to login)
5. Sidebar shows name + email + logout button
6. Dashboard h1 shows `"{firstName}'s Dashboard"` with actual name
7. Log out — redirected to `/login`, session cleared
8. Toggle dark mode on login page — form and panels adapt correctly
