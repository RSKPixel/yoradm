import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Hardware-backed storage, never synced or restored to another phone.
const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const KEYS = {
  uid: 'device_uid',
  secret: 'device_secret',
} as const;

export type DeviceCreds = { device_uid: string; device_secret: string };

export async function getCreds(): Promise<DeviceCreds | null> {
  const [uid, secret] = await Promise.all([
    SecureStore.getItemAsync(KEYS.uid, OPTS),
    SecureStore.getItemAsync(KEYS.secret, OPTS),
  ]);
  return uid && secret ? { device_uid: uid, device_secret: secret } : null;
}

// Fresh identity for each activation attempt; saved only once the server accepts it.
export function newCreds(): DeviceCreds {
  const bytes = Crypto.getRandomBytes(32);
  const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return { device_uid: Crypto.randomUUID(), device_secret: secret };
}

export async function saveCreds(creds: DeviceCreds) {
  await SecureStore.setItemAsync(KEYS.uid, creds.device_uid, OPTS);
  await SecureStore.setItemAsync(KEYS.secret, creds.device_secret, OPTS);
}

// Revoked or unknown phone: forget everything so it must be activated again.
export async function wipeDevice() {
  await Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k, OPTS)));
}

export async function deviceInfo() {
  let hardwareId: string | null = null;
  try {
    hardwareId = Platform.OS === 'android' ? Application.getAndroidId() : await Application.getIosIdForVendorAsync();
  } catch {
    hardwareId = null;
  }
  return {
    android_id: hardwareId,
    model: [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || null,
    os_version: `${Device.osName ?? Platform.OS} ${Device.osVersion ?? ''}`.trim(),
    app_version: Application.nativeApplicationVersion,
  };
}
