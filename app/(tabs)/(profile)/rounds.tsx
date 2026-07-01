import { MyRoundsView } from '@/components/my-rounds-view';
import { Screen } from '@/components/screen';

// The full rounds list, reached from the "My rounds" link on the Me tab. It
// keeps the bottom tab bar (it's a primary destination), so it lives inside the
// profile stack rather than over the tabs.
export default function RoundsScreen() {
  return (
    <Screen padded={false} marks>
      <MyRoundsView />
    </Screen>
  );
}
