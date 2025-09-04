# Firebase Database Rules Deployment Guide

## Overview
This guide explains how to deploy Firebase Realtime Database rules to resolve the performance warnings you're seeing in your server logs.

## Current Issue
The Firebase warnings indicate that queries on the `transactions` node are not using indexes, causing poor performance as all data is downloaded and filtered on the client side.

## Solution
Deploy the database rules file (`database.rules.json`) to Firebase to create the necessary indexes.

## Prerequisites
1. Firebase CLI installed: `npm install -g firebase-tools`
2. Firebase project access
3. Firebase project ID from your environment variables

## Deployment Steps

### 1. Install Firebase CLI (if not already installed)
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Initialize Firebase in your project (if not already done)
```bash
cd backend
firebase init database
```
- Select your Firebase project
- Choose "Use an existing project"
- Select your NamPay project
- Accept the default rules file location

### 4. Deploy the Database Rules
```bash
firebase deploy --only database
```

## Alternative: Manual Deployment via Firebase Console

If you prefer to deploy via the Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your NamPay project
3. Navigate to **Realtime Database** in the left sidebar
4. Click on the **Rules** tab
5. Replace the existing rules with the content from `database.rules.json`
6. Click **Publish**

## Rules Explanation

The deployed rules include:

### Indexes Created
- `transactions` node: Indexed on `userId`, `timestamp`, and `type`
- This allows efficient querying of transactions by user ID

### Security Rules
- **Users**: Users can only read/write their own data
- **Transactions**: Users can read transactions they're involved in (as sender or receiver)
- **QR Codes**: Authenticated users can read all QR codes, but only create their own

## Verification

After deployment, restart your backend server and check the logs. You should no longer see the Firebase index warnings:

```
@firebase/database: FIREBASE WARNING: Using an unspecified index...
```

## Performance Benefits

With proper indexes in place:
- Transaction queries will be much faster
- Reduced data transfer costs
- Better user experience with faster loading times
- Eliminated client-side filtering overhead

## Troubleshooting

### If warnings persist:
1. Verify the rules were deployed successfully
2. Check that your Firebase project ID matches the one in your environment variables
3. Ensure you're using the correct Firebase project

### If deployment fails:
1. Check your Firebase CLI authentication: `firebase login --reauth`
2. Verify project access: `firebase projects:list`
3. Check project ID: `firebase use --add`

## Next Steps

After deploying the rules:
1. Restart your backend server
2. Test the payment history endpoint
3. Monitor performance improvements
4. Consider implementing additional indexes if needed for other queries
