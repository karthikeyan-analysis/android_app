# Karthikeyan Analysis - Student Portal Android App

A production-grade, high-performance Android mobile application built with React Native and Expo targeting Android SDK 34+. The app replicates 100% of student learning, examination, and live classroom features with single-device restriction, proctored CBT engine, anti-piracy document/video protection, and real-time Firebase sync.

> **Note**: This application is strictly for enrolled and guest students. Administrative consoles, question creation tools, and co-host panels are intentionally excluded.

---

## 🚀 Key Features

### 1. Authentication & Single-Device Enforcement
- **Google Sign-In**: Authenticates via `@react-native-google-signin/google-signin` and links to the official institute enrollment record in the `students` collection.
- **Username & Password Login**: Direct client-side authentication supporting student IDs, portal usernames, and emails.
- **Guest CBT Exam Join**: Instant mock test entry for open public tests using exam ID and SHA-256 access passcode.
- **Strict Anti-Account Sharing**:
  - Generates a 36-character unique session token upon login.
  - Updates Firestore `students/{studentRecordId}` with active device model, OS, and session token.
  - Background `onSnapshot` listener automatically kicks duplicate active sessions from other devices with an instant alert.
- **Multi-Batch Gateway & Switcher**: Allows students enrolled in multiple coaching batches to toggle active syllabus and tests at any time.

### 2. Student Dashboard
- Time-of-day greeting ("Good morning", "Good afternoon", "Good evening") with student avatar and active batch details.
- Real-time **Live Now** banner with pulsing status and one-tap join button.
- Top metrics row showing total study notes, video lectures, and today's scheduled tests.
- Today's Scheduled Tests card with direct "Take Test" action.
- Batch syllabus and subject directory.

### 3. Anti-Piracy Media Library
- Subject folder accordion hierarchy (Physics, Chemistry, Biology, Mathematics, etc.).
- Content filtering: PDF Notes, Recorded Video Lessons, and Live Class Archives.
- **Native Android `FLAG_SECURE`**: Completely disables screenshots, screen recording, and system task switcher previews on document and video screens.
- **Dynamic Bouncing Watermark**: Floats continuous diagonal watermark over PDFs and videos displaying `{Candidate Name} | {Student ID / Email} | {Live Timestamp}`.
- Hardened Video Player with custom seek controls, playback speed selector (0.5x - 2.0x), and auto-pause on phone calls or app backgrounding.

### 4. NTA/JEE/NEET Standard CBT Examination Engine
- **Pre-Exam Instructions**: Duration, total marks, positive (+4) and negative (-1) marking rules, and official 5-color status legend.
- **Lockdown Exam Screen**:
  - Synchronized countdown timer with critical warning (< 5 mins).
  - Question viewport with Markdown, KaTeX mathematical formulas, and biological/physics diagram zoom modal.
  - Supports Single Choice MCQ, Multiple Choice, and Numerical inputs with on-screen keypad.
  - 5-Status Question Palette Drawer:
    - ⚪ Not Visited
    - 🔴 Not Answered
    - 🟢 Answered
    - 🟣 Marked for Review
    - 🟣🟢 Answered & Marked for Review
  - Bottom action bar: *Save & Next*, *Mark for Review & Next*, *Clear Response*, *Previous*, and *Submit Test*.
- **Anti-Cheat Proctoring**:
  - Monitors `AppState` (Active / Background / Inactive).
  - Logs strikes if candidate leaves or backgrounds the app with warning modal.
  - Automatic force-submission upon reaching 3 strikes or when timer expires (00:00).
  - Automatic progress backup to Firestore and local offline storage every 30 seconds.

### 5. Exam Results & Official Response Sheet
- Scorecard with score obtained, accuracy percentage, correct/incorrect/skipped counts.
- Question-by-question review with candidate response vs correct key and step-by-step solutions (respecting `showAnswersAfter` setting).
- Official digital response sheet matching national testing agency format.

### 6. Interactive Live Online Classrooms
- Filters classes by Subject and Status (Live Now, Scheduled, Completed).
- Automatic participant attendance tracking (`recordAttendanceJoin` on entry, `recordAttendanceLeave` on exit).
- Student audio/mic and video camera controls.
- **Class Doubt Messenger**: Real-time doubt submission to faculty with status (Pending / Answered) and reply alerts.
- **In-Class Live Test Alert**: Real-time listener for tests launched by the teacher during class with one-tap exam launch.

---

## 🛠️ Tech Stack

- **Framework**: React Native 0.88 + Expo SDK 58 (Targeting Android SDK 34+)
- **Language**: TypeScript 5+ (Strict mode)
- **Database & Auth**: Firebase Modular SDK (Firestore, Auth, Storage, Functions)
- **Navigation**: React Navigation 7 (Native Stack + Bottom Tabs)
- **Math Formulas**: KaTeX via React Native WebView
- **DRM & Security**: `expo-screen-capture` (`FLAG_SECURE`) + Custom Canvas Watermark
- **Storage**: `@react-native-async-storage/async-storage`

---

## 📲 Running & Building the Android App

### Development:
```bash
# Start Metro bundler
npm run start

# Run on connected Android device or emulator
npm run android
```

### Android Production Build:
```bash
# Generate native Android project files
npx expo prebuild --platform android

# Compile release APK
cd android
./gradlew assembleRelease
```
The compiled APK will be generated at:
`android/app/build/outputs/apk/release/app-release.apk`

