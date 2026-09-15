/// <reference types="astro/client" />
interface ReaderPreferences { version: number; theme: 'light' | 'dark'; fontSize: number }
interface Window {
  readerSettings: { key: string; value: ReaderPreferences; available: boolean };
}
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
