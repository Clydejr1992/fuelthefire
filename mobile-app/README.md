# Fuel the Fire Mobile App

A separate Expo/React Native app project. It does not change or deploy the live website at https://fuelthefire.site.

## What is included now
- Existing Supabase Auth sign-in.
- Profile/active-account check and the site's required first-login password-change gate.
- Read-only product inventory list and search.
- Camera barcode scan that checks only products already loaded from the database.
- Simple dashboard and summary screen.
- Expo build profiles and a configuration-check workflow.

## Safety and limitations
- The mobile app is **read-only** for inventory in this first stage.
- Scanning a barcode does not create a product or write a stock movement.
- No demo/sample products or database writes are included.
- Purchase receiving, stock movements, meal counts, supplier workflows, and detailed reports are not implemented in this mobile app yet.
- The app must be run and tested against the actual Supabase schema and RLS policies before it is considered ready.
- Camera operation has not yet been tested on a physical iPhone or Android device.
- The repository does not contain a signed IPA/APK, an App Store release, or a Google Play release.

## Run on a computer and test with an iPhone
1. Install Node.js LTS on a computer.
2. In a terminal, go into the project folder: `cd mobile-app`.
3. Install dependencies: `npm install`.
4. Copy `.env.example` to `.env`. The example contains the existing Supabase **public client** URL/key; never add a service-role key.
5. Start Expo: `npx expo start`.
6. Install **Expo Go** on the iPhone from the App Store.
7. Ensure the computer and iPhone are on the same Wi-Fi, then scan the QR code shown by Expo using the iPhone camera and open it in Expo Go.
8. Sign in with an existing Fuel the Fire account. Do not share the password in chat. Test sign-in, profile access, inventory loading, and camera permissions.

If your terminal reports an Expo SDK/dependency compatibility issue, follow the specific message from Expo and adjust versions before testing.

## Build for distribution
1. Install and sign into the Expo Application Services (EAS) CLI.
2. Run `eas build:configure` from this directory to attach the app to your own Expo account/project.
3. Build an iOS or Android package using the `preview` or `production` profile in `eas.json`.
4. iPhone installation outside Expo Go and App Store distribution require appropriate Apple signing/account setup. Android distribution requires Android signing configuration.
5. Validate permissions, authentication, app privacy details, and every data workflow before public release.

## Important
This is a development starter, not a finished release. The production website remains separate and unchanged. Mobile app changes are on the `app/fuel-the-fire-expo` development branch and are not merged into `main`.
