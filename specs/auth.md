# Authentication

Status: draft. Priority: Should (built in week 1 as a parallel track, so that later features can rely on it). Related: `CLAUDE.md` (Authentication rules), `specs/trips-and-ratings.md`, `specs/favorites.md`.

## Purpose

Let people create an account and log in, so that logged-in users can save trips, favorite places, and rate trips. Authentication is **optional**: the core planning flow must work for guests with no account.

## User stories

- As a guest, I can plan a trip (geocode, route, break points, accommodation suggestions) without registering.
- As a guest, I can register with an email and password.
- As a registered user, I can log in and stay logged in when I reload the page.
- As a logged-in user, I can log out.
- As a guest who tries to save a trip or favorite a place, I see a clear prompt to log in or register, not a raw error.
- As a logged-in user, I can never see or change another user's data.

## Acceptance criteria

Registration
- [ ] `POST /api/auth/register` with a valid email, password, and display name creates a user and returns 201 with a token and the user object.
- [ ] Registering with an email that already exists (case-insensitive) returns 409 `EMAIL_TAKEN`.
- [ ] Invalid input (bad email format, password too short or too long, missing fields) returns 400 `VALIDATION_ERROR` with a readable message.
- [ ] The password is stored only as a bcrypt hash. The hash is never returned by any endpoint.

Login
- [ ] `POST /api/auth/login` with correct credentials returns 200 with a token and the user object.
- [ ] Wrong password and unknown email both return the same 401 `INVALID_CREDENTIALS` with the same message (do not reveal which one was wrong).

Current user
- [ ] `GET /api/auth/me` with a valid token returns the current user.
- [ ] `GET /api/auth/me` with no token, an invalid token, or an expired token returns 401 `UNAUTHORIZED`.
- [ ] If the token is valid but the user no longer exists, `/me` returns 401 `UNAUTHORIZED`.

Middleware
- [ ] `optionalAuth`: with a valid token, sets `req.user`; with no token **or an invalid/expired token**, continues as a guest and does not return an error.
- [ ] `requireAuth`: returns 401 `UNAUTHORIZED` when there is no authenticated user.
- [ ] `/api/geocode` and `/api/trips/plan` use `optionalAuth` and work identically for guests and logged-in users.
- [ ] All trip and favorite endpoints use `requireAuth` and filter by the authenticated user's id.

Frontend
- [ ] Register and login forms show validation errors and server errors in plain language.
- [ ] After a page reload, a stored valid token restores the logged-in state (via `/api/auth/me`).
- [ ] If any request returns 401 while the user thought they were logged in, the token is cleared and the user is asked to log in again.
- [ ] Log out clears the token and returns the UI to guest mode.
- [ ] Buttons for account-only features (save trip, favorite) are visible to guests and open a "Log in to save" prompt.

## API

All error responses use the shape from `CLAUDE.md`:
`{ "error": { "code": "STRING", "message": "Human readable" } }`

### POST /api/auth/register

Auth: none.

Request:
```json
{ "email": "anna@example.com", "password": "at-least-8-chars", "displayName": "Anna" }
```

Response 201:
```json
{
  "token": "<jwt>",
  "user": { "id": "665f...", "email": "anna@example.com", "displayName": "Anna" }
}
```

Errors: 400 `VALIDATION_ERROR`, 409 `EMAIL_TAKEN`.

### POST /api/auth/login

Auth: none.

Request:
```json
{ "email": "anna@example.com", "password": "at-least-8-chars" }
```

Response 200: same shape as register.

Errors: 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS`.

### GET /api/auth/me

Auth: `requireAuth`. Header: `Authorization: Bearer <token>`.

Response 200:
```json
{ "user": { "id": "665f...", "email": "anna@example.com", "displayName": "Anna" } }
```

Errors: 401 `UNAUTHORIZED`.

## Data

`User` (Mongoose):

| Field | Type | Notes |
|---|---|---|
| `email` | String | Required, unique index, stored lowercase and trimmed |
| `passwordHash` | String | Required, `select: false` so it is never loaded by default |
| `displayName` | String | Required, 1-50 characters |
| `createdAt` | Date | Timestamps enabled |

Validation (Zod, in the backend):
- `email`: valid email format, max 254 characters.
- `password`: 8 to 72 characters. The upper limit exists because bcrypt only uses the first 72 bytes.
- `displayName`: trimmed, 1 to 50 characters.

## Token and security rules

- Hashing: `bcrypt` with a cost factor of 10-12. Compare with `bcrypt.compare`. Never log passwords or hashes.
- JWT: signed with `JWT_SECRET` from the environment (never hardcoded, never committed). Algorithm HS256 (library default). Expiry from `JWT_EXPIRES_IN` (default `7d`).
- JWT payload: `sub` (the user id) plus the standard `iat` and `exp`. Do **not** put email, password, or any personal data in the token.
- No refresh tokens. When a token expires the user logs in again.
- Logout is client-side only: the frontend deletes the token. (A stolen token stays valid until it expires. This is an accepted limitation, see Known limitations.)
- `requireAuth` only verifies the token and does not hit the database on every request. Endpoints that read user-owned data query by `owner: req.user.id`. `/me` loads the user and fails if the user is gone.
- Ownership: every query on trips and favorites includes the owner id. Returning 404 (not 403) for someone else's resource avoids revealing that it exists.
- Frontend token storage: `localStorage`, key `auth_token`. Sent as `Authorization: Bearer <token>` by the API client. See Open questions for the trade-off.
- CORS: `CORS_ORIGIN` must be set to the exact frontend origin in production.

## UI behavior

- `AuthContext` (frontend) holds `user`, `token`, `login()`, `register()`, `logout()`, and a `loading` flag.
- On app start: if a token exists, call `/api/auth/me`. While waiting, show a loading state (not the guest UI flashing before the user appears). If it fails, clear the token and continue as a guest.
- Header shows "Log in / Register" for guests and the display name plus "Log out" for users.
- Guest prompt: a small modal or inline message, "Log in or create an account to save trips and favorites", with links to the forms. The user keeps their current planned trip on screen while doing this.
- Forms: disable the submit button while the request is running, show field-level validation errors, and show a generic message if the server is unreachable.

## Edge cases

- Expired or malformed token on a public endpoint: treated as a guest, the request still succeeds.
- Expired or malformed token on a protected endpoint: 401, and the frontend sends the user to log in.
- `Authorization` header present but not in `Bearer <token>` form: treated as no token.
- Same email with different casing (`Anna@x.com` vs `anna@x.com`): the same account. Normalize to lowercase before saving and before lookup.
- Two simultaneous registrations with the same email: the unique index decides, and the loser gets 409 (catch the Mongo duplicate key error and map it to `EMAIL_TAKEN`).
- Very long password: rejected by validation at 72 characters.
- Database unavailable: 500 with a generic message. Never expose stack traces or connection strings to the client.
- User logs in on two devices: both tokens work independently.

## Tests

Automated (Should), against a test database or in-memory MongoDB:
- Register success, and the response contains no `passwordHash`.
- Register with a duplicate email, including different casing, returns 409.
- Register with invalid input returns 400.
- Login success, wrong password, and unknown email (the last two return the identical response).
- `/me` with a valid token, no token, a tampered token, and an expired token.
- `optionalAuth` with an invalid token continues as a guest.
- Ownership: user A cannot read, update, or delete user B's trip or favorite (add this to the trips and favorites tests once those endpoints exist).

Manual:
- Register, reload the page, still logged in.
- Log out, guest UI returns.
- Click "Save" as a guest and get the login prompt.
- Log in again and the saved flow works.

## Out of scope

- OAuth / social login (Google, Facebook, etc.)
- Email verification and "forgot password" flow
- Roles, permissions, and admin users
- Refresh tokens and server-side logout or token revocation
- Account deletion and profile editing
- Two-factor authentication

## Known limitations (to mention in the report)

- A token in `localStorage` can be read by injected scripts (XSS), and a stolen token cannot be revoked before it expires.
- No rate limiting on login by default, so brute-force attempts are not blocked.
- No email verification, so anyone can register with any email address.

## Open questions

- **Token storage:** `localStorage` is simple and works across the Vercel and Render domains, but an httpOnly cookie is safer. Cookies across two different domains require `SameSite=None; Secure` and CORS with credentials, which adds complexity. Current decision: `localStorage`, documented as a limitation. Revisit only if time allows.
- **Rate limiting:** adding `express-rate-limit` on `/login` and `/register` is cheap. Decide in week 4 whether to include it (Could).

## Things I must be able to explain (oral exam)

- Why passwords are hashed rather than encrypted, and what a salt and cost factor do.
- What a JWT contains, who can read it, and why the signature stops it from being edited.
- What happens when a token expires, and why there is no server-side logout.
- Why `optionalAuth` exists, and why an invalid token on a public endpoint is not an error.
- Why login returns the same error for wrong password and unknown email.
- How ownership checks stop one user from reading another user's trips.

## Definition of Done

Follow the Definition of Done in `CLAUDE.md`. For this spec specifically, also confirm:
- [ ] No endpoint ever returns `passwordHash`.
- [ ] `JWT_SECRET` is set as an environment variable in local and deployed environments, and is not in git.
- [ ] Auth flow verified in the deployed version (CORS and the `Authorization` header work across Vercel and Render).