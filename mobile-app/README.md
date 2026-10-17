# Fuel the Fire Mobile App (separate project)

This is a separate Expo/React Native app scaffold. It does not change the live website files or deploy itself.

## Safety and current scope
- Uses the existing Supabase project via environment variables; never place a service-role key in the app.
- Sign-in uses the existing Supabase Auth account.
- Reads the signed-in user's profile and existing product rows subject to database RLS.
- Inventory screen is read-only in this starter build.
- Barcode scanning looks for an already-existing product; it does not create products or write stock movements.
- No demo/sample products or database writes are included.
- Purchase, meal, employee movement, and detailed reporting workflows are not implemented yet.

## Configure locally
1. Install Node.js LTS and run `cd mobile-app && npm install`.
2. Create a local `mobile-app/.env` file from `mobile-app/.env.example` and fill in the public Supabase URL and publishable/anon key.
3. Run `cd mobile-app && npx expo start`; use Expo Go to test the UI and camera on a device.
4. Never commit `.env`, service-role keys, or user credentials.

## Build a distributable app
Install EAS CLI, configure your own Expo account/project, then use EAS Build for iOS and Android. Apple App Store distribution requires an Apple Developer account. This repository currently has no EAS project ID, signing credentials, or published store build.

## Important
The existing website at https://fuelthefire.site remains the production web app. This folder is a new mobile app starter, not a replacement. Validate the mobile app against the actual Supabase schema and role policies before expanding it to write operations.
