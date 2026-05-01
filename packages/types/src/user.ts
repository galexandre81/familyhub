import type { Timestamp } from "./common";

export interface OAuthTokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresAt: Timestamp;
}

export interface UserServiceTokens {
  googleCalendar?: OAuthTokenBundle;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  householdsIds: string[];
  defaultHouseholdId: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  serviceTokens: UserServiceTokens;
}
