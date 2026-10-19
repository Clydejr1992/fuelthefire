# Fuel the Fire mobile app

This is the first mobile wrapper for Fuel the Fire. It loads the existing HTTPS app inside a React Native WebView, so sign-in and inventory data continue to use the existing web application and backend.

## Current release status

**Not ready for public launch yet.** The source scaffold is in the `app-development` branch only. No iOS IPA or Android AAB/APK has been built or device-tested. This repository connection cannot create the required Apple/Google developer accounts, accept legal agreements, register signing credentials, or submit an app to either store.

A web wrapper may not meet Apple App Store or Google Play review requirements by itself. Before spending on store submission, test the PWA install flow and confirm the mobile experience meets the actual staff workflow. If a store app is required, consider adding native capabilities that genuinely improve the workflow rather than submitting only a website wrapper.

## Local preview

Requirements: Node.js LTS and npm.

1. Open Terminal.
2. Run `cd mobile-app` from the downloaded repository folder.
3. Run `npm install`.
4. Run `npx expo start`.
5. Follow Expo's instructions to open the preview. For WebView and production behaviour, use a development build or EAS build and test on physical iOS and Android devices.

## EAS build setup

1. Install the current Expo/EAS CLI: `npm install --global eas-cli`.
2. Sign in with the owner's Expo account: `eas login`.
3. From this folder, run `eas build:configure`. This creates/links an EAS project and writes the real project ID into the app configuration.
4. Confirm the Apple bundle identifier `site.fuelthefire.app` and Android package `site.fuelthefire.app` are available and owned/controlled by the publisher. Change them before the first release if needed.
5. Build an internal Android test: `eas build --platform android --profile preview`.
6. Build an internal iOS test: `eas build --platform ios --profile preview`.
7. Install and test on real devices before considering a production build.

The Expo account, Apple Developer account, Google Play Console account, store listing, signing choices, and any fees require the owner's involvement. Do not share passwords or signing keys in chat.

## Required before public launch

- Real app icon and splash assets in the platform-required formats and sizes.
- Published privacy policy and support contact/URL linked in the store listings.
- Accurate Apple privacy and Google Play Data safety disclosures based on the actual data collected.
- End-to-end testing on current iOS and Android devices: staff/admin sign-in, session expiry, sign-out, back navigation, links, keyboard behaviour, accessibility, poor connection and server errors.
- Confirm the live production domain, authentication redirects, session persistence, and database Row Level Security policies.
- Verify account deletion/support obligations and age/content declarations applicable to the app.
- Review the current Apple and Google store policies. Approval cannot be guaranteed.

## Security

Never include a Supabase service-role key or other server secret in client-side or mobile source. A public/publishable client key is only safe when database access is correctly protected by Row Level Security and least-privilege policies. Test writes only with approved test accounts/data.

## Current web-app alternative

The existing web app can be added to a phone/tablet home screen from the live website using the instructions on `get-app.html`. This is a shortcut/PWA-style access path, not a native app-store download.
