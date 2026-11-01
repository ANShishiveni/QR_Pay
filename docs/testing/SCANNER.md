# QR scanning and image import

The Phase 3 scanner accepts camera frames or a user-selected image. Both sources call the same `/api/qr/scan` endpoint with the original signed envelope. Only its verified `paymentRequest.id` is passed to `PaymentConfirm`; review reloads current server data. Client parsing rejects obviously unrelated or oversized content, but never authorizes a request or relies on the device clock for expiry.

## Permission, privacy and lifecycle

- The camera component mounts only after **Start camera**. There is no camera or photo-library permission prompt at app launch or onboarding. Photo import uses the system picker and remains available when camera access is denied.
- Native scanning uses Expo Camera SDK 53. Web scanning uses `getUserMedia` and bundled `jsqr` 1.4.0. It avoids Expo 53's web QR worker, which imports an older decoder from a CDN.
- Image bytes stay on the device. The server receives the signed QR envelope for verification, never the image, its filename, camera frames or an image URL. Image import does not fetch arbitrary URLs.
- Import accepts local raster images up to 10 MiB. Web decode canvases are bounded to 2048 pixels per side, with a 48-megapixel source limit and 15-second load timeout. Blob URLs, image references and canvases are released after success or failure. SVG is rejected. Native decoding rejects images with multiple detected codes; web users are instructed to provide one complete code because jsQR returns one result.
- Camera callbacks share a synchronous lock with gallery validation. Duplicate frames cannot open repeated reviews while the first result is being checked. Camera access stops during verification, navigation blur, app backgrounding and screen unmount. Returning requires an explicit restart. Late asynchronous results cannot navigate after leaving the scanner.
- Web torch controls appear only if the active video track reports torch capability. Expo 53's native public API exposes no torch-capability query, so native torch controls are intentionally unavailable until a verified hardware-capability implementation exists. Better lighting or gallery import remain available.
- Expired, paid, cancelled, self-payment, invalid-signature and unavailable requests produce recovery text and never enter review. Opening the scanner never creates or approves a payment.

## Automated checks

Run from `frontend`:

```sh
npm test -- --runTestsByPath \
  src/screens/qr/__tests__/QRScanScreen.test.js \
  src/components/qr/__tests__/CameraScanner.web.test.js \
  src/services/qr/__tests__/galleryDecoder.test.js
```

The decoder suite includes a real synthetic QR decoded by the bundled jsQR implementation. Screen tests cover explicit camera intent, duplicate events, gallery/server verification, malformed QR recovery, representative server denials, permission fallback, background/blur cleanup, stale requests and picker cancellation. Web camera tests verify microphone avoidance, stream cleanup, delayed permission cleanup, permission rejection and capability-gated torch controls.

For Playwright, navigate to `QRScan` through the Payments hub and set a generated local request image on `[data-testid="qr-gallery-input"]`. The visible picker action is **Choose QR image**. A valid image must reach the **PaymentConfirm** route only after a successful `/api/qr/scan` response. Use a second synthetic account; scanning one's own request must fail.

## Device verification still required

Actual Android/iOS camera focus, camera permission denial/settings recovery, real photo picker formats, native `scanFromURLAsync`, torch hardware, TalkBack/VoiceOver and camera behavior after rotation or application switching have not been verified on physical devices in this cloud environment. Browser media-track tests are controlled simulations, not proof of physical camera operation. Real-device verification remains in the release matrix.
