# Phone OTP + Family Code (Auth0, Vercel BotID, Android Turnstile)

> **مسار سابق:** يصف هذا المستند تكامل Vercel BotID/Neon القديم. فرع الترحيل الحالي يطلب Turnstile من الويب وAndroid ويتحقق منه داخل Cloudflare Worker. راجع [مستودع الباك إند](https://github.com/fszazo5-design/famly-pluse-backend) و`ANDROID_BUILD.md` للإعداد الحالي.

## Authentication and bot-protection flow

- **Web (`famlypulse.vercel.app`)**: Vercel BotID Basic runs invisibly in the browser. The OTP API calls `checkBotId()` before accessing Neon or asking Auth0 to send an SMS.
- **Native app (Capacitor Android/iOS)**: the app embeds a small Turnstile widget page hosted on the Vercel API domain. The token is sent to the API and verified by Cloudflare Siteverify before any database query or SMS send.
- **OTP provider**: Auth0 Passwordless SMS remains the only OTP provider. The backend then verifies the code with Auth0 and creates the existing hashed Neon session.

Both checks are server-enforced. The 60-second resend limit and Auth0's own rate limits remain in place.

## Vercel BotID Basic (web)

BotID Basic is Vercel's invisible bot check and does not require Cloudflare credentials or a separate site key. The app initializes BotID for the web OTP `POST`; the server explicitly requests `checkLevel: 'basic'` so it does not use the paid Deep Analysis check.

Enable Vercel OIDC for the project because BotID's server check uses Vercel's request-scoped OIDC token:

1. Open the Vercel project **Settings → Security**.
2. Under **Secure backend access with OIDC federation**, enable/select an issuer mode and save.
3. Redeploy after the existing Vercel deployment block is cleared.

Local development bypasses BotID by default; its server check returns `isBot: false` outside production. The production build still needs Vercel routing rewrites in `vercel.json`.

## Cloudflare Turnstile (native app only)

The native app cannot send BotID's same-origin browser challenge to the cross-origin Vercel API. It instead embeds `/turnstile-widget.html` from the configured Vercel API origin, so the Turnstile challenge itself runs on the allowed Vercel hostname.

1. In Cloudflare Dashboard → **Turnstile**, create a widget using the **Managed** widget mode.
2. Add the exact hostname `famlypulse.vercel.app` to its allowed hostnames (add another Vercel hostname only if the native build uses it).
3. Store the **public Site Key** as the GitHub Actions secret `VITE_TURNSTILE_SITE_KEY` for Android builds. The release workflow injects it into the native bundle.
4. Store the **Secret Key** in Vercel Project → **Settings → Environment Variables** as `TURNSTILE_SECRET_KEY` (Production, and Preview only if needed). Never place this value in `VITE_*`, the Android app, or Git.
5. Set the Android build's `VITE_API_URL` to `https://famlypulse.vercel.app` (or the same Vercel hostname authorized in Cloudflare).

The widget sends the token to the app using `postMessage`; the app checks the Vercel frame origin and window source. The API validates the token, `request_otp` action, and matching Vercel hostname. Tokens are single-use and expire after five minutes. The hosted widget page restricts its allowed frame parents to Capacitor localhost origins.

## Auth0 setup

In the Auth0 tenant:

1. Enable the **SMS passwordless connection** and configure a Phone Message Provider under Branding / Phone Provider.
2. For the confidential Regular Web application used by the server, enable the **Passwordless OTP** grant under Advanced Settings → Grant Types.
3. Add `https://famlypulse.vercel.app/` to the application's **Allowed Callback URLs**.
4. If using Auth0's `auth0-forwarded-for` rate-limit header, enable **Trust IP Header** for the tenant/application.

Auth0 controls OTP generation, delivery, expiration, and invalid-attempt limits. Its default SMS OTP lifetime is three minutes; adjust it in the Auth0 SMS connection if needed.

## Vercel server environment

Keep these on the server only—never prefix secrets with `VITE_`:

```text
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_REDIRECT_URI=https://famlypulse.vercel.app/
TURNSTILE_SECRET_KEY=...
DATABASE_URL=...  # supplied by the Neon Vercel integration
# Or use NEON_DATABASE_URL instead of DATABASE_URL.
```

`TURNSTILE_SECRET_KEY` is needed for native Turnstile token verification. BotID uses Vercel OIDC, not an environment API key. `VITE_API_URL` may remain empty for the web deployment because the frontend and API share the same HTTPS origin.

## Database

Run `api/neon-schema.sql` once in the Neon SQL Editor. It creates the family tables and authentication tables `app_users`, `auth_sessions`, and `otp_requests` with idempotent `CREATE TABLE IF NOT EXISTS` statements.

## API flow

- `POST /api/auth/request-otp` with `{ phone }` from the web app; BotID verifies the request.
- `POST /api/auth/request-otp` with `{ phone, captchaToken }` from the native app; Turnstile verifies the token.
- `POST /api/auth/verify-otp` with `{ phone, code, display_name }`.
- After Auth0 confirms the phone, the backend creates/updates the user and returns a 30-day hashed bearer session.
- `POST /api/family/complete` with `Authorization: Bearer <token>` and either `{ action: 'create', family_name, display_name }` or `{ action: 'join', family_code, display_name }`.

The family join code is generated by Postgres and is never accepted from an unverified client identity.

## Security notes

- Auth0 credentials, the Turnstile secret, and Neon connection strings stay in Vercel server environment variables.
- The Turnstile Site Key is public and is embedded in the native app; only the secret key must remain confidential.
- Enforce HTTPS and use E.164 phone numbers.
- Do not send OTPs until BotID or Siteverify has succeeded.
- Keep the 60-second per-phone resend throttle; Auth0 also applies its own rate limits.
- Never log CAPTCHA tokens, OTP codes, access tokens, bearer sessions, secrets, or full phone numbers.
- Revoke sessions server-side after account compromise and review authorization checks on family data routes before launch.
