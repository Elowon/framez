# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.


Framez — Mobile Social App (React Native / Expo)

A clean, auth-integrated social app built with React Native (Expo) that lets users create and share posts (text + image), view a global feed, and see their own profile and activity.
This project uses Supabase for data storage and authentication, and Convex for image storage/handling.

Key Features

Secure authentication (Sign up / Log in / Log out) using Supabase Auth

Persistent sessions — users remain logged in after app restart

Create posts with text and an optional image (images stored via Convex)

Global feed showing posts in reverse-chronological order (most recent first)

User profile displaying logged-in user info and that user’s posts

Smooth navigation and responsive UI inspired by Instagram-like layouts

Tech stack

Frontend: React Native + Expo

Backend / DB / Auth: Supabase (Postgres, Auth, real-time subscriptions)

Image storage / handlers: Convex (used for storing and serving post images as requested)

State management: React Context API (lightweight; easy to extend with Zustand/Redux)

Hosting / testing: Expo Go for local device testing; app preview hosted on appetize.io

Demo

 A 2–3 minute demo video highlighting:

Sign-up / login flow and persistent session

Creating a post with and without an image

Viewing the feed and the user's profile

App running in Expo Go / appetize preview link

https://appetize.io/app/b_jkicdwsws6qvlkdnrcgkci4jhy

https://drive.google.com/file/d/15oiG9V4ebSWoP8w2Kq_d_K8YBc3N_DWm/view?usp=drive_link

Repository structure (example)
/framez
├─ /assets
├─ /src
│  ├─ /components
│  ├─ /context        # Auth & global state
│  ├─ /screens        # HomeFeed, CreatePost, Profile, Auth screens
│  ├─ /services       # supabase.ts, convex.ts, helpers
│  ├─ /utils
│  └─ App.tsx
├─ .env.example
├─ app.json
├─ package.json
└─ README.md

Getting started (local development)
Prerequisites

Node.js (v16+ recommended)

npm or yarn

Expo CLI: npm install -g expo-cli (or use npx expo)

An Expo account (optional but helpful)

Supabase project (for Auth and DB)

Convex project or service for image storage (API keys / endpoint)

1. Clone the repo
git clone https://github.com/<your-username>/framez.git
cd framez

2. Install dependencies
npm install
# or
yarn

3. Environment variables

Create a .env (or use secrets in your CI) based on .env.example:

Example .env.example:

EXPO_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-if-needed
CONVEX_API_URL=https://your-convex-endpoint
CONVEX_API_KEY=your-convex-api-key
EXPO_PUBLIC_APP_AUTH_REDIRECT=http://localhost:19006


Security note: Keep service role keys or any secret keys out of client distribution. Use server-side functions / Convex or Supabase Edge Functions for any privileged operations.

4. Configure Supabase

Create tables:

users (profile data: id, name, email, avatar_url, created_at)

posts (id, author_id -> users.id, text, image_url, created_at)

Enable Row Level Security and write minimal policies for insert/select as appropriate for public feed and authenticated users.

Supabase Auth should be enabled and set up (email/password provider).

5. Configure Convex (image storage)

Set up your Convex instance or function that accepts image uploads and returns a public URL (or signed URL)

Update src/services/convex.ts with your Convex endpoint + API key

6. Running the app
npx expo start


Open in Expo Go (scan QR) or run on Android/iOS simulator.

For Appetize hosting, build a bundle (see below) and upload to appetize.io.

How features are implemented (high level)

Auth & Session: Supabase Auth; token stored in secure storage via Expo SecureStore (or AsyncStorage for simplicity). On app start, read session and navigate accordingly.

Posts: Posts saved to Supabase posts table. Each post stores a Convex image URL when an image is included.

Image upload flow: App uploads image to Convex endpoint (or uses Convex function) which returns an accessible URL; URL saved in posts.image_url.

Feed & Realtime updates: Feed fetched from Supabase ordered by created_at DESC; Subscriptions / real-time changes handled using Supabase real-time (or polling as fallback).

Profile screen: Query Supabase users and posts filtered by author_id === currentUser.id.

Scripts
"scripts": {
  "start": "expo start",
  "android": "expo run:android",
  "ios": "expo run:ios",
  "web": "expo start --web",
  "lint": "eslint . --ext .ts,.tsx"
}

Deployment & Appetize.io

Build a binary or JavaScript bundle (for appetize you can upload an iOS .app or an Android .apk/.aab, or use Expo’s managed build to get an artifact).

Upload to appetize.io
 — they will provide an embeddable link you can place in README or demo page.

Add the appetize link & demo video URL to the README.

Testing & QA

Test flows: register, login, logout, create post (text only), create post (with image), single post view, profile posts display.

Test auth persistence: close the app & reopen — the user should remain logged in.

Check real-time updates by posting from multiple devices/emulators.

Known issues & troubleshooting

Large images: ensure client-side resizing/compression before upload to reduce bandwidth and storage usage.

Supabase row-level security: if feed shows empty, check RLS policies for posts and users.

Convex image upload failures: verify API keys, CORS, and correct endpoint usage.

On Android emulator: make sure local server (if used) is accessible via proper host (10.0.2.2 for Android emulator) or use ngrok for tunneling.

Future improvements

Add likes/comments with real-time updates

Add image transformations / thumbnails for faster loading

Implement content moderation or reporting

Add push notifications for new comments/likes

Move image storage to a CDN-backed solution for production-scale traffic