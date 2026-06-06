import Constants from 'expo-constants';

// Runtime config sourced from app.json `extra`. apiUrl must be reachable from
// the device — `localhost` only works in the iOS simulator; on a physical
// device set it to your machine's LAN IP or the deployed server URL.
type Extra = {
  apiUrl?: string;
  googleWebClientId?: string;
  googleIosClientId?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const apiUrl = (extra.apiUrl || 'http://localhost:8080').replace(/\/+$/, '');
export const googleWebClientId = extra.googleWebClientId || '';
export const googleIosClientId = extra.googleIosClientId || '';
