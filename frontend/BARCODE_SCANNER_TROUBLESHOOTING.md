# Barcode Scanner Troubleshooting Guide

## Issue Description
The error `Cannot find native module 'ExpoBarCodeScanner'` occurs when the Expo barcode scanner package isn't properly configured or installed.

## Root Cause
The `expo-barcode-scanner` package requires:
1. Proper plugin configuration in `app.json`
2. Compatible version with your Expo SDK
3. Clean installation without cache conflicts

## Solution Steps

### 1. Quick Fix (Recommended)
Run the automated fix script:
```bash
cd frontend
node fix-barcode-scanner.js
```

### 2. Manual Fix

#### Step 1: Update app.json
Make sure your `app.json` includes the barcode scanner plugin:
```json
{
  "expo": {
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "Allow NamPay to access your camera to scan QR codes."
        }
      ],
      [
        "expo-barcode-scanner",
        {
          "cameraPermission": "Allow NamPay to access your camera to scan QR codes."
        }
      ]
    ]
  }
}
```

#### Step 2: Update package.json
Ensure you have the latest compatible version:
```json
{
  "dependencies": {
    "expo-barcode-scanner": "~12.9.2"
  }
}
```

#### Step 3: Clean and Reinstall

**Windows:**
```cmd
cd frontend
rmdir /s /q node_modules
del package-lock.json
npm install --legacy-peer-deps
```

**macOS/Linux:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

#### Step 4: Clear Expo Cache
```bash
npx expo start --clear
```

### 3. Alternative Solutions

#### Option A: Use expo install
```bash
cd frontend
npx expo install expo-barcode-scanner
```

#### Option B: Force Reinstall
```bash
cd frontend
npm uninstall expo-barcode-scanner
npm install expo-barcode-scanner@~12.9.2
```

#### Option C: Check Expo CLI Version
```bash
npm install -g @expo/cli@latest
```

## Verification

After applying the fix:

1. **Check Installation**:
   ```bash
   ls node_modules/expo-barcode-scanner
   ```

2. **Test Import**:
   ```javascript
   import { BarCodeScanner } from 'expo-barcode-scanner';
   console.log(BarCodeScanner.Constants.BarCodeType.qr);
   ```

3. **Run on Device**:
   - Start Expo: `npx expo start`
   - Scan QR code with Expo Go app
   - Navigate to QR scan screen
   - Should work without errors

## Common Issues

### Issue 1: Still Getting Native Module Error
**Solution**: 
- Make sure you're running on a physical device, not web
- Barcode scanner doesn't work in web builds
- Use Expo Go app or build a development build

### Issue 2: Permission Denied
**Solution**:
- Grant camera permission when prompted
- Check device settings if permission was denied
- Restart the app after granting permission

### Issue 3: Expo Go App Issues
**Solution**:
- Update Expo Go to latest version
- Clear Expo Go cache
- Reinstall Expo Go app

### Issue 4: Network Issues
**Solution**:
- Ensure phone and computer are on same network
- Try using tunnel mode: `npx expo start --tunnel`
- Check firewall settings

## Platform-Specific Notes

### iOS
- Requires camera permission in Info.plist
- Works with Expo Go and development builds
- Test on physical device (not simulator)

### Android
- Requires camera permission in AndroidManifest.xml
- Works with Expo Go and development builds
- May need additional permissions for older Android versions

### Web
- Barcode scanner doesn't work in web builds
- Use alternative web-based QR scanning libraries
- Consider using device camera API for web

## Development vs Production

### Development
- Use Expo Go app for testing
- Native modules work automatically
- No additional configuration needed

### Production
- Build standalone app with `expo build`
- Native modules are bundled automatically
- Test thoroughly on physical devices

## Additional Resources

- [Expo Barcode Scanner Documentation](https://docs.expo.dev/versions/latest/sdk/barcode-scanner/)
- [Expo Camera Documentation](https://docs.expo.dev/versions/latest/sdk/camera/)
- [Expo Plugin Configuration](https://docs.expo.dev/guides/config-plugins/)

## Support

If issues persist:
1. Check Expo SDK compatibility
2. Verify all dependencies are compatible
3. Try creating a fresh Expo project
4. Contact Expo support or check GitHub issues
