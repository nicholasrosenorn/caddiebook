import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Show a banner + play a sound even when a push arrives while the app is in the
// foreground (otherwise iOS suppresses it). Set once at module load.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// The EAS project id is required to mint an Expo push token; it already lives in
// app.json under extra.eas.projectId.
function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    // Fallback for bare/EAS runtime where it surfaces under easConfig.
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

// Request permission and return this device's Expo push token, or null if we
// can't get one (simulator, denied permission, or misconfigured project). Safe
// to call repeatedly — it's idempotent and cheap.
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push only works on physical devices.
  if (!Device.isDevice) return null;

  // Android requires a channel for notifications to display.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  const projectId = getProjectId();
  if (!projectId) return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}
