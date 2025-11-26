## Mamacare

This project is a Firebase-backed Next.js dashboard for pregnancy tracking.

### Firebase setup

The Firebase SDK is configured in `lib/firebase.ts` with production keys for `mamacare-c6b3f`. If you prefer to supply your own project credentials, create a `.env.local` file with the following values:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

Restart the dev server after changing env values.


