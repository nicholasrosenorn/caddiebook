import { Stack } from 'expo-router';

import { fontFamily } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

export default function CommunityStackLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: {
          color: colors.textPrimary,
          fontFamily: fontFamily.serifBold,
          fontSize: 22,
        },
        headerShadowVisible: false,
      }}>
      <Stack.Screen
        name="community"
        options={{
          title: '',
        }}
      />
      <Stack.Screen name="add-friend" options={{ title: 'Add friends' }} />
      <Stack.Screen name="requests" options={{ title: 'Friend requests' }} />
    </Stack>
  );
}
