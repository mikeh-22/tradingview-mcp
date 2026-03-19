import { tvGet } from "./client.js";
import type { UserAccount } from "./types.js";

interface UserResponse {
  id: number;
  username: string;
  email?: string;
  plan?: string;
  avatar_url?: string;
  is_pro?: boolean;
  is_premium?: boolean;
  date_joined?: string;
  reputation?: number;
  following?: number;
  followers?: number;
}

export async function getAccount(): Promise<UserAccount & Record<string, unknown>> {
  const data = await tvGet<UserResponse>("/api/v1/user/");
  return {
    id: data.id,
    username: data.username,
    email: data.email,
    plan: data.plan,
    avatar: data.avatar_url,
    is_pro: data.is_pro,
    is_premium: data.is_premium,
    date_joined: data.date_joined,
    reputation: data.reputation,
    following: data.following,
    followers: data.followers,
  };
}

export async function getNotificationSettings(): Promise<Record<string, unknown>> {
  return await tvGet<Record<string, unknown>>("/api/v1/alert/notificationinfo/");
}
