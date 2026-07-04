import { WebClient } from '@slack/web-api';
import { z } from 'zod';

export const getUserInfoSchema = z.object({
  user_id: z.string().min(1, 'user_id is required'),
  include_locale: z.boolean().default(false),
});

export const listUsersSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  include_bots: z.boolean().default(false),
});

export interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  display_name: string;
  email?: string;
  title?: string;
  phone?: string;
  timezone?: string;
  is_admin: boolean;
  is_bot: boolean;
  is_restricted: boolean;
  deleted: boolean;
  status_text?: string;
  status_emoji?: string;
  avatar_url?: string;
}

function mapUser(
  user: Record<string, unknown>,
  includeLocale: boolean
): SlackUser {
  const profile = (user.profile as Record<string, unknown>) ?? {};
  return {
    id: String(user.id ?? ''),
    name: String(user.name ?? ''),
    real_name: String(user.real_name ?? profile.real_name ?? ''),
    display_name: String(profile.display_name ?? user.name ?? ''),
    email: profile.email ? String(profile.email) : undefined,
    title: profile.title ? String(profile.title) : undefined,
    phone: profile.phone ? String(profile.phone) : undefined,
    timezone: includeLocale && user.tz ? String(user.tz) : undefined,
    is_admin: Boolean(user.is_admin),
    is_bot: Boolean(user.is_bot),
    is_restricted: Boolean(user.is_restricted),
    deleted: Boolean(user.deleted),
    status_text: profile.status_text ? String(profile.status_text) : undefined,
    status_emoji: profile.status_emoji
      ? String(profile.status_emoji)
      : undefined,
    avatar_url:
      profile.image_512
        ? String(profile.image_512)
        : profile.image_192
        ? String(profile.image_192)
        : undefined,
  };
}

export async function getUserInfo(
  client: WebClient,
  params: z.infer<typeof getUserInfoSchema>
): Promise<SlackUser> {
  const result = await client.users.info({
    user: params.user_id,
    include_locale: params.include_locale,
  });

  if (!result.ok || !result.user) {
    throw new Error(`Slack API error: ${result.error ?? 'user not found'}`);
  }

  return mapUser(
    result.user as Record<string, unknown>,
    params.include_locale
  );
}

export async function listUsers(
  client: WebClient,
  params: z.infer<typeof listUsersSchema>
): Promise<{ users: SlackUser[]; next_cursor?: string }> {
  const result = await client.users.list({
    limit: params.limit,
    cursor: params.cursor,
  });

  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error ?? 'unknown'}`);
  }

  let users = (result.members ?? []).map((m) =>
    mapUser(m as Record<string, unknown>, false)
  );

  if (!params.include_bots) {
    users = users.filter((u) => !u.is_bot && !u.deleted);
  }

  return {
    users,
    next_cursor: result.response_metadata?.next_cursor,
  };
}
