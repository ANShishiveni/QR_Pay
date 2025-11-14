# Configuration

This guide explains how to configure the backend and frontend for local development and testing.

## Backend

- Location: `backend/`
- Create `.env` with the following variables:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
JWT_SECRET=your-jwt-secret
```

- Notes:
  - Keep secrets out of source control; do not commit `.env`.
  - The backend strips sensitive logging from Firebase initialization.
  - Start the server on `http://localhost:3000` using `npm run dev` from `backend/`.

### Dynamic Host IP detection

- The backend detects your local IPv4 address at runtime and updates CORS to allow the correct dev origins.
- You can override detection by setting `HOST_IP` in the backend `.env`:

```
HOST_IP=192.168.178.41
```

On startup, the server logs a `Network access:` URL using the detected IP.

## Frontend

- Location: `frontend/`
- API module: `src/config/api.js` (single source of truth)
- The API base URL is resolved in this order:
  1. `process.env.EXPO_PUBLIC_API_URL`
  2. `expo.expoConfig.extra.apiUrl` in `app.json`
  3. Fallback to `http://localhost:3000`

### Web / Development builds

Set the environment variable before starting the frontend:

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### Native devices/emulators

Set a reachable IP for your machine in `app.json`:

```
{
  "expo": {
    "extra": {
      "apiUrl": "http://192.168.1.5:3000"
    }
  }
}
```

Alternatively, for web/dev builds you can use the environment variable:

```
EXPO_PUBLIC_API_URL=http://192.168.178.41:3000
```

### Auth Token Storage

- The axios client adds `Authorization: Bearer <token>` automatically if `authToken` is present.
- Token helper: `frontend/src/utils/asyncStorage.js`.

### Start Commands

- From project root:
  - `npm run dev` (backend)
  - `npm run client` (frontend)

## Troubleshooting

- 401 Unauthorized: Ensure `authToken` is set and not expired; login again.
- Network errors on device: Use your machine’s IP via `extra.apiUrl`.
- CORS issues: Confirm backend `cors` is configured to allow the frontend origin.