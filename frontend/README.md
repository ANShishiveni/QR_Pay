# NamPay frontend

Expo 53, React 19.0.0 and React Native 0.79.6; Metro builds both web and native.
Install with `npm ci --legacy-peer-deps` from this directory. The postinstall
hook applies a hash-checked Metro adaptation for the patched image-size API.
Keep the repository's sibling `scripts/` directory when installing/building.

```sh
EXPO_PUBLIC_API_URL=http://localhost:3000 npm run web -- --localhost
npm test -- --ci
npm run typecheck
EXPO_PUBLIC_API_URL=https://demo-api.example.invalid npm run build:web
```

Web runs on localhost:8081. The placeholder HTTPS export command proves bundle
compilation only; it does not produce a configured payment service. Set an actual
reachable HTTPS demo API for a distributed build. Every `EXPO_PUBLIC_*` value is
public client configuration; never put secrets there.

See [repository setup](../docs/SETUP.md), [design system](../docs/design/DESIGN_SYSTEM.md),
[accessibility evidence](../docs/testing/ACCESSIBILITY.md), and
[native build/acceptance](../docs/testing/NATIVE_ACCEPTANCE.md). Device behavior is
not inferred from browser or component tests. No warning-free compatibility or
production-readiness guarantee is made.
