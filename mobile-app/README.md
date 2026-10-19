# Fuel the Fire mobile app (preview scaffold)

This folder contains an Expo/React Native scaffold for iOS and Android. It currently opens the existing Fuel the Fire HTTPS web application in a WebView, so it does not duplicate the backend or invent a second set of inventory records.

## Important status

This is a **preview scaffold, not a store-ready release**. It has not been built on an Apple/Android build service, tested on real devices, or reviewed against current Apple App Store / Google Play policies. Store approval is not guaranteed. A thin web wrapper may be rejected by a store; before submission, we should confirm that the native app offers sufficient platform-specific value and complete device, accessibility, privacy, and security testing.

## Run locally

1. Install Node.js LTS and Git.
2. From this folder, run `npm install`.
3. Run `npx expo start`.
4. Use Expo Go or a simulator to preview; native WebView support and release builds should be tested using development builds / EAS.

## Build requirements

- Create an Expo/EAS project and replace `REPLACE_WITH_EAS_PROJECT_ID` in `app.json`.
- Confirm the production URL and authentication redirect behaviour before release.
- Set unique Apple bundle and Android package identifiers if these are not available.
- Add app icon, splash assets, store screenshots, privacy policy URL, support URL, and app-store privacy/data-safety disclosures.
- Test employee and administrator sign-in, session persistence, sign-out, permissions, inventory updates, accessibility, offline/error states, and account deletion/support requirements where applicable.
- Apple Developer Program and Google Play Console developer registration are managed by the owner and require owner approval/payment.

## Safety

Never add Supabase service-role keys to mobile app source. Only public client keys may be shipped, with server-side access controls/RLS correctly configured.
