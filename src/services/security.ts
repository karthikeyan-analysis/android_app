import * as ScreenCapture from 'expo-screen-capture';

/**
 * Activates Android FLAG_SECURE to block screen recording and screenshots
 */
export async function enableScreenSecurity(tag: string = 'secure-view'): Promise<void> {
  try {
    await ScreenCapture.preventScreenCaptureAsync(tag);
  } catch (err) {
    console.warn('[SECURITY] Could not enable screen security:', err);
  }
}

/**
 * Releases Android FLAG_SECURE
 */
export async function disableScreenSecurity(tag: string = 'secure-view'): Promise<void> {
  try {
    await ScreenCapture.allowScreenCaptureAsync(tag);
  } catch (err) {
    console.warn('[SECURITY] Could not disable screen security:', err);
  }
}

