// Root-stack entry to the add-friends search, so it pushes onto the current
// stack (e.g. Settings → Friends → Add friends) with proper back navigation
// instead of jumping into the Community tab's stack. Renders the same screen
// the Community tab uses.
export { default } from './(tabs)/(community)/add-friend';
