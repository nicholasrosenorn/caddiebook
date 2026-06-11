import { router } from 'expo-router';

import { DEFAULT_AVATAR } from '@/components/avatar';
import { ProfileForm } from '@/components/profile-form';
import { Screen } from '@/components/screen';
import { useAuth } from '@/lib/auth/provider';

export default function EditProfileScreen() {
  const { session } = useAuth();
  const user = session?.user;

  return (
    <Screen>
      <ProfileForm
        initial={{
          firstName: user?.firstName ?? '',
          lastName: user?.lastName ?? '',
          username: user?.username ?? '',
          avatar: user?.avatar ?? DEFAULT_AVATAR,
        }}
        submitLabel="Save changes"
        onSaved={() => router.back()}
      />
    </Screen>
  );
}
