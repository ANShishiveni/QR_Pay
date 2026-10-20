# Implementation decisions

## Scope and baseline

The user requested implementation of the attached NamPay 2.0 blueprint after cloud onboarding. Application changes are now authorized. The initial checkout was clean at `998d2ec571289edbf777a52d9edea50652cf257b`, matching remote `main`. Work uses the existing isolated checkout on `feat/nampay-2`; no additional worktree is needed. Original repository history and all existing data remain intact.

## Phase gates and verification

Implement phases in order. Record unavailable hardware and external capabilities explicitly; continue independent work after documenting a blocker. Automated browser checks supplement, but never replace, physical Android and native secure-storage verification. Tests that execute zero assertions are not passes. Machine-readable task state is maintained in `progress.json`, rendered by `node scripts/report-progress.js`.

## Sandbox architecture

Retain Express, Expo/React Native and Firebase Realtime Database. Local development uses a `demo-` Firebase emulator project, synthetic accounts and allowlisted test instruments. No real card capture, live payment API call, paid SMS, production migration or cloud billing is authorized. Mock verification uses server-generated challenges delivered only to a local operator outbox; it never bypasses payment authorization or claims real phone ownership.

## Atomicity and compatibility

The small demonstration backend uses a repository abstraction with a real Firebase root transaction and a serialized in-memory implementation for deterministic tests. The payment request, verification consumption, canonical transaction and both user projections must be committed together. This deliberately favors demonstrable integrity over production-scale throughput. Existing UID values, routes and legacy email-keyed records require an explicit compatibility adapter and fixtures; no automatic destructive migration is allowed.

## Credentials and sessions

Native sessions use the operating system secure credential store. Browser sessions use an HttpOnly cookie, exact-origin checks and credentialed requests, without localStorage tokens. The server validates signature, issuer, audience, expiration and current account/session status. Production defaults fail closed; development configuration cannot enable a production mock provider.

## Toolchain baseline

Node 24.19.0, npm 11.9.0, Java 21 and Chromium 154 were available. All three original lockfiles installed with `npm ci`; frontend requires its documented `--legacy-peer-deps`. Expo SDK 53 Webpack development and production builds passed. The original backend could not start because credentials were absent and route imports contain a JWT initialization ReferenceError; both original Jest suites initially failed on undeclared `supertest` with zero tests executed.

## Access limitations

HTTPS Git read access succeeds. Listing open pull requests through GitHub GraphQL returned HTTP 403; that does not imply a new personal token is needed. Native device, EAS and App Store capabilities remain unverified. No publication or deployment is implied by local builds or saved cloud configuration.
