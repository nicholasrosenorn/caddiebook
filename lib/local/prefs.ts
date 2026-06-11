import AsyncStorage from '@react-native-async-storage/async-storage';

// Device-local preferences (theme, intro flag, migration markers). These are
// deliberately NOT account data: they must be readable before sign-in and they
// describe this device, so they live in AsyncStorage rather than on the server.

const PREFIX = 'pref:';

export async function getPref(key: string): Promise<string | null> {
  return AsyncStorage.getItem(`${PREFIX}${key}`);
}

export async function setPref(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(`${PREFIX}${key}`, value);
}

export async function removePref(key: string): Promise<void> {
  await AsyncStorage.removeItem(`${PREFIX}${key}`);
}
