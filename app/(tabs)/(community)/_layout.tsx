import { Stack } from 'expo-router';

import { useColors, useFontSet } from '@/constants/theme-context';

export default function CommunityStackLayout() {
  const colors = useColors();
  const fonts = useFontSet();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: {
          color: colors.textPrimary,
          fontFamily: fonts.serifBold,
          fontSize: 22,
          lineHeight: 30,
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
      <Stack.Screen name="requests" options={{ title: 'Notifications' }} />
    </Stack>
  );
}
