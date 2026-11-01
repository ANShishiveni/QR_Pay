# Dependency audit and remediation evidence

Updated **30 October 2026**, after Phase 6 dependency remediation and a clean installation from all three lockfiles. The final full-tree and omit-dev audits report **zero high and zero critical findings**. Lower-severity findings remain: backend 14 and frontend 19 in the full trees. This is a dated dependency result, not a clean audit or blanket release approval.

## Audit evidence

The final commands were `npm audit --json` and `npm audit --omit=dev --json`, run separately from the repository root, `backend`, and `frontend`. The primary agent saved the complete reports in ignored `.local/audits/`; this document's counts and leaf findings were checked against those files. The `runtime` filenames mean **npm's omit-dev dependency classification**, not a measurement of code included in a device bundle.

| Snapshot / package root | Low | Moderate | High | Critical | Total | Command exit | Report in `.local/audits/` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 29 Oct before / root | 0 | 0 | 0 | 0 | 0 | 0 | `root-before.json` |
| 29 Oct before / backend | 6 | 8 | 1 | 0 | 15 | 1 | `backend-before.json` |
| 29 Oct before / frontend | 17 | 29 | 32 | 5 | 83 | 1 | `frontend-before.json` |
| 30 Oct final full / root | 0 | 0 | 0 | 0 | 0 | 0 | `root-release-full.json` |
| 30 Oct final full / backend | 6 | 8 | 0 | 0 | 14 | 1 | `backend-release-full.json` |
| 30 Oct final full / frontend | 12 | 7 | 0 | 0 | 19 | 1 | `frontend-release-full.json` |
| 30 Oct final omit-dev / root | 0 | 0 | 0 | 0 | 0 | 0 | `root-release-runtime.json` |
| 30 Oct final omit-dev / backend | 0 | 8 | 0 | 0 | 8 | 1 | `backend-release-runtime.json` |
| 30 Oct final omit-dev / frontend | 4 | 7 | 0 | 0 | 11 | 1 | `frontend-release-runtime.json` |

Totals include affected parent packages propagated from a vulnerable dependency; they are not counts of independent exploits. Backend/frontend exit 1 reflects the remaining findings. A zero-high/critical threshold passes for these reports; a zero-findings threshold does not.

The intermediate file `frontend-final.json` predates the last decoder remediation despite its filename. It reported seven high nodes from `decode-uri-component` and is superseded by `frontend-release-full.json`. No before report was overwritten to represent an after result.

Final lockfile SHA-256:

```text
package-lock.json          6340b1ccfa0bf5667a67f2b7920005769fe9e7808fea5a61cf77a0b74cd9c11f
backend/package-lock.json  aa0150a933c2ffa9ad225f52480d8aca7d6cc1ec502384ac80ac5a2f1c503651
frontend/package-lock.json 11f113d96e3a747e5a49a592e3d37416a3d804f0f22ee4dabc8b74abf3045f10
```

Before lockfile SHA-256:

```text
package-lock.json          574809b6e429bb155925b5be5c31f8311bf8e47862d0240cfe35db3997c7d4bf
backend/package-lock.json  bd32eb0dba498271f53b5858e77aa64b806145a160652ea8a12c0cc211c8ac06
frontend/package-lock.json b7a451c18d08ca94e3c7f233172e24df87225b4f89acd17f55454b5ca364c951
```

The JSON reports are local evidence, not guaranteed to exist in a fresh checkout. Regenerate them before a later release and preserve their date, command exit, and corresponding lock hashes. These audits do not cover browser binaries, operating-system packages, native SDKs, or the separately installed Firebase emulator tooling.

## Changes that removed the high and critical paths

The frontend now uses Expo's Metro bundler for web and native. The obsolete `@expo/webpack-config`, webpack and webpack-dev-server trees, custom webpack files, and their explicit browserify shim dependencies were removed. Unused frontend Firebase was removed, eliminating its old protobuf/grpc/database dependencies. Source review also removed unused direct permissions/barcode/device and duplicate icon dependencies. Some utility packages such as `buffer` and `ansi-escapes` remain transitively where retained tools require them; removal of a direct dependency is not a claim that every copy vanished.

`qrcode` remains as a frontend **development** dependency because the gallery-decoder tests use it; backend QR generation still uses its own runtime dependency. `jsqr` 1.4.0 remains active in web camera/gallery decoding. Neither was removed solely to improve audit totals.

Compatible dependency updates and three narrowly scoped overrides produced these concrete resolutions:

| Finding or dependency path | Final resolution | Evidence and scope |
| --- | --- | --- |
| Backend Express → body-parser compressed-body DoS, [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828), `<1.20.9` | **body-parser 1.20.9** | Real API parsing path; absent from both final backend reports. |
| Frontend Firebase → protobufjs, including critical code generation findings | **Removed from frontend tree** | No frontend Firebase or protobufjs lock node remains. Backend's retained protobufjs is **7.6.6**. |
| Frontend webpack server → proxy-addr / websocket-driver critical findings | **Removed from frontend tree** | No frontend webpack, proxy-addr or websocket-driver lock node remains. Backend retains proxy-addr **2.0.8**. |
| Expo CLI archive/shell tooling critical paths | **tar 7.5.22**, **shell-quote 1.12.0** | Outside the before report's affected ranges; neither appears in final findings. |
| Axios HTTP dependencies | **1.21.0** in both application roots | Refreshed within the existing major version. |
| Expo certificate tooling → node-forge, including [RSA verifier finding through 1.4.0](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | **node-forge 1.4.2** | Version 1.4.0 was insufficient for the final advisory range. No verifier checks were disabled. |
| Metro → image-size parser loops, [JXL/HEIF](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) and [ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr), through `2.0.2` | **image-size 2.0.3**, scoped override plus API adapter | Crosses Metro's declared `^1.0.2` range; compatibility work is documented below. |
| Expo Metro config → PostCSS source-map file disclosure, including [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), through `8.5.22` | **PostCSS 8.5.23**, scoped override | Crosses the parent's `~8.4.32` range; CSS transformations and source maps checked. |
| Navigation → query-string → decoder malformed-percent DoS, [exponential](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) through `0.4.2` and [quadratic](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) through `0.5.0` | **decode-uri-component 0.5.1**, scoped override plus import adapter | Fixes the newly detected second advisory while retaining React Navigation 6. |

Other retained patched resolutions include branch-specific brace-expansion **1.1.21 / 2.1.7**, js-yaml **3.15.2 / 4.3.2**, ws **6.2.6 / 7.5.13 / 8.22.0**, Undici **6.29.1**, nanoid **3.3.20**, and source-map-js **1.2.2**. The complete final reports, rather than this representative list, establish which advisory matches remain.

No forced Expo or React Native major upgrade was used. The locked framework matrix is Expo **53.0.27**, React/React DOM/test renderer **19.0.0**, React Native **0.79.6**, Expo Metro config **0.20.18**, Metro **0.82.5**, and React Navigation **6.x**. Jest remains on **29.x** with jest-expo **53.x**.

## Scoped overrides and compatibility patch maintenance

`frontend/package.json` contains exactly these overrides:

```json
{
  "metro@0.82.5": { "image-size": "2.0.3" },
  "@expo/metro-config@0.20.18": { "postcss": "8.5.23" },
  "query-string@7.1.3": { "decode-uri-component": "0.5.1" }
}
```

The frontend postinstall runs [`scripts/patch-dependencies.cjs`](../../scripts/patch-dependencies.cjs). It verifies exact parent versions and SHA-256 hashes of the original files, adapts their imports, verifies the expected resulting hashes, and accepts an already-patched file idempotently. Unexpected source/version drift stops installation. `--check`, included in `npm run check`, verifies the patch without applying it.

Metro's original `require("image-size")` expects a callable CommonJS export and accepts both buffers and file paths. The adapter imports the fixed package's named `imageSize` export and reads a string path into a buffer before passing it to that API. It preserves Metro's supported call shapes while using the patched parser.

Query-string's original `require('decode-uri-component')` expects a callable CommonJS export. Decoder 0.5.1 is ESM; the adapter uses `.default`. This path is validated on the project's pinned **Node 24.19.0** and through Metro exports. Do not assume an older Node release can synchronously require this ESM dependency merely because the decoder's own package engine field allows it.

| Patched parent source | Original SHA-256 | Patched SHA-256 |
| --- | --- | --- |
| `metro@0.82.5/src/Assets.js` | `afb0698f853774aa7a6274eeb50c3283c56c6ada7aeb799e6cae19dd7d43ce2b` | `cb1805ca5066e7c859e3e819cd5d97e94f879682ae9aaa923fa1ba2bb423f92a` |
| `query-string@7.1.3/index.js` | `caa3f2c8b45dfe1e91db22ae10743af68de8d96f26515132bb52485ec0f037fa` | `fc1ca6e1961ba005e554b1bc0de932d6454bf59bfaea03d02c7261dbdcafcdbd` |

PostCSS needs no source patch. These are maintained compatibility changes, not ordinary upstream-supported resolutions within all parent version ranges. Owners of frontend dependencies must review/remove the adapters when upgrading the parents, and repeat clean installation, audit, compatibility smoke checks, tests, typecheck, and exports. Do not blindly replace expected hashes to bypass a failure. The lockfile integrity fields and normal TLS validation remain in use.

## Remaining findings and exposure

The final reports have two underlying advisory families. npm's severity labels below are preserved even where the advisory's numerical CVSS differs. These findings remain open; this document does not approve an exception or dismiss build tooling as harmless.

| Remaining path | Audit classification / nodes | Evidence, mitigation, and follow-up owner |
| --- | --- | --- |
| Backend Firebase Admin → Google client libraries → **uuid 9.0.1** | **Moderate**, 8 full and omit-dev nodes; [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), affected `<11.1.1` | Advisory concerns v3/v5/v6 calls with a caller-provided output buffer. Inspected gaxios, google-gax and teeny-request calls use `v4()` without such a buffer. This narrows demonstrated exposure but does not prove every dependency path safe. **Backend maintainers:** track a supported Firebase/Google dependency update; evaluate migration before exposing additional SDK features. Audit proposes Firebase Admin 14.5.0, a major upgrade requiring auth/RTDB/session compatibility tests. No untested global UUID major override was applied. |
| Frontend Expo tooling → xcode → **uuid 7.0.3** | **Moderate**, 7 full and omit-dev nodes; same advisory | `xcode/lib/pbxProject.js` generates IDs with `uuid.v4()`, outside the stated v3/v5/v6 buffered condition. This is native project/build tooling in npm's runtime tree, not evidence of a phone HTTP endpoint. **Frontend maintainers:** retain trusted project inputs, monitor compatible Expo/xcode fixes, and validate any UUID API/module-format migration. |
| Backend Jest config → **deepmerge 4.3.1** | **Low**, 6 full-tree nodes; zero omit-dev nodes; [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), affected `>=4.2.0 <=4.3.1` | Prototype poisoning of returned merged objects. Test configuration is repository-controlled. **Test-tooling maintainers:** avoid accepting untrusted configuration, track a supported parent/patched release, and test merge behavior before replacement. Audit proposes Jest 25.1.0, a major downgrade unsuitable as an automatic fix. |
| Frontend Expo/Jest config → **deepmerge 4.3.1** | **Low**, 12 full-tree nodes; 4 omit-dev nodes; same advisory | Expo config processing remains installed without dev dependencies. Treat build configuration/plugins as trusted code and review changes. **Frontend maintainers:** track a compatible fix and test configuration merging/prebuild/export before migration. React Native Paper's theme provider separately resolves **deepmerge 3.3.0**, outside this report's affected range; the audited 4.3.1 path should not be mislabeled as that runtime theme merger. |

Backend UUID's eight propagated nodes are `uuid`, `gaxios`, `google-gax`, `teeny-request`, `retry-request`, `@google-cloud/firestore`, `@google-cloud/storage`, and `firebase-admin`. Frontend UUID's seven are `uuid`, `xcode`, `@expo/config-plugins`, `@expo/config`, `@expo/prebuild-config`, `@expo/cli`, and `expo`.

The application currently requests Firebase Auth and Realtime Database services, not Firestore/Storage APIs. Firebase Admin still installs those affected dependency paths, and gaxios also serves authentication-related uses; this observation does not justify deleting optional packages or asserting absence of runtime risk.

The final reports propose jest-expo 58.0.13 or Expo 51.0.39 for parts of the frontend graph. Those are framework migrations/downgrades, not safe automatic fixes for SDK 53. No `npm audit fix --force` was used. Restricting build/test inputs and the observed UUID call sites reduce relevant exposure; they do not patch the retained packages. Reassess these findings when dependencies or input boundaries change and before a production release.

## Verification and limits

The primary agent completed a clean lockfile installation in all three roots, using the frontend's required `--legacy-peer-deps`, and the frontend postinstall reproduced both adapters. Final lock hashes above were checked after installation. The following post-decoder checks are recorded:

| Verification | Result and scope |
| --- | --- |
| `npm run check` | Passed: ESLint, source-check self-tests, 157 source files / 14 configuration files with zero source-check findings, patch integrity checks, and compatibility smoke tests. |
| `scripts/tooling-compat-smoke.cjs` | Passed: Metro PNG/JPEG/SVG dimensions through byte input, real PNG through filename asset loading, empty/invalid rejection; PostCSS transformation/media rule/source-map output; query-string Unicode, repeated keys, encoding roundtrip, malformed percent inputs, and a bounded repeated-malformed-input fixture. |
| Frontend Jest and TypeScript | **368 tests / 33 suites passed** after decoder change; typecheck passed. |
| Real Firebase emulator integration | `.local/evidence/firebase-release.log` records successful rules, repository/payment concurrency, real server startup/persistence/session verification, and clean emulator shutdown with exit 0. |
| Metro web / Android / iOS bundle export | `.local/evidence/bundles-release.log` records `Exported: dist-native`, including web output and Android/iOS Hermes bundles after decoder remediation. These are JavaScript/asset exports, not compiled or device-tested applications. |
| Browser release regression | Passed on 30 October: all five disposable Chromium runs, including auth/recovery/privacy, two-account payment with lost response, features, and reliability in normal/reduced motion. Metro root-layout regression was corrected before this passing run. |
| Native device acceptance | Physical Android/iOS, camera, sharing, biometric, accessibility and installation acceptance remain unverified in this cloud environment. |

The smoke fixtures check compatibility, not exhaustive security properties. In particular, they do not independently reproduce every image parser, certificate verifier, source-map disclosure or decoder advisory. Patched version selection plus the dated audit results establishes removal of known package matches; it does not establish absence of all vulnerabilities.

The fresh 29/30 October audits no longer report `braces` or `micromatch`, although braces 3.0.3 remains installed. Earlier 21 October backend/frontend counts of 41/118 are superseded. This is an observed advisory-result change, not a code fix or independently verified advisory withdrawal.

Dependency remediation has cleared the reported high/critical findings while retaining the SDK 53 framework. The moderate/low findings above and native-device gate remain explicit limits on any broader release claim.
