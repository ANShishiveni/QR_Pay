# Versioned demonstration export evidence

Created 31 October 2026 from clean source commit
`5d2bd25264cafabc1574b843e4fde130741b1c8d` on `feat/nampay-2`.

This is an **Expo Metro export archive**, not an APK, IPA or installed native
application. The compiled API origin is `https://demo-api.example.invalid`,
a deliberate non-resolving placeholder. Rebuild with an authorized reachable
HTTPS demo API before end-to-end use of a distributed bundle.

| Output | Value |
| --- | --- |
| Package / app version | 2.0.0-demo.0 / 2.0.0 |
| Local archive | `.local/artifacts/nampay-2.0.0-demo.0-export-5d2bd252-20261031T064624224Z.tar.gz` |
| Local manifest | Same stem with `.manifest.json` |
| Archive bytes | 8,482,957 |
| Archive SHA256 | `d22d581d0f1de102dde6e923c15c9ad0f4cf816881dacc5624a39a740059e449` |
| Validated export files | 57, including web entry/bundle, Android/iOS Hermes bytecode and generated binary assets |
| Source state at packaging | Clean; exact source revision is embedded in both manifests |
| Runtime acceptance | Native Android/iOS and packaged web against a configured API remain unverified |

The archive and manifest are intentionally ignored local outputs, not committed
binary distributions. They have not been uploaded as a GitHub release or
deployed. The following commands produced them:

```sh
EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 \
  EXPO_PUBLIC_API_URL=https://demo-api.example.invalid \
  npm --prefix frontend run build:bundles
EXPO_PUBLIC_API_URL=https://demo-api.example.invalid node scripts/package-demo.cjs
```

The packaging helper validated actual Expo metadata, local paths, Hermes headers,
asset content, source freshness and API origin. An independent read-back checked
all 57 manifest file sizes/hashes inside the archive and its SHA256. No environment
files, provider credentials, dependency source trees or source maps are included.
The generated web font/image paths retain Expo's `assets/node_modules` prefix;
these are binary assets, not installed dependency packages.

The [pull request](https://github.com/ANShishiveni/QR_Pay/pull/6) is the live source
of remote CI status. Initial workflow runs were rejected before executing jobs
because `runner.temp` appeared in job-level environment configuration. Moving it
to the Firebase steps corrected the context error; actionlint 1.7.12 validated
the workflow locally. This validation does not assert that GitHub's tests passed.

The [native checklist](NATIVE_ACCEPTANCE.md) records the licensed SDK and device
prerequisites still required for an installable demonstration build and release
acceptance.
