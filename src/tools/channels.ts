import { WebClient } from '@slack/web-api';
import { z } from 'zod';

export const listChannelsSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  exclude_archived: z.boolean().default(true),
  cursor: z.string().optional(),
});

export const getChannelHistorySchema = z.object({
  channel_id: z.string().min(1, 'channel_id is required'),
  limit: z.number().int().min(1).max(100).default(20),
  oldest: z.string().optional().describe('Unix timestamp — fetch messages after this time'),
  latest: z.string().optional().describe('Unix timestamp — fetch messages before this time'),
});

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_archived: boolean;
  num_members: number;
  topic: string;
  purpose: string;
  created: number;
}

export interface SlackMessage {
  ts: string;
  user: string;
  text: string;
  type: string;
  reactions?: Array<{ name: string; count: number }>;
  reply_count?: number;
  thread_ts?: string;
}

export async function listChannels(
  client: WebClient,
  params: z.infer<typeof listChannelsSchema>
): Promise<{ channels: SlackChannel[]; next_cursor?: string }> {
  const result = await client.conversations.list({
    limit: params.limit,
    exclude_archived: params.exclude_archived,
    types: 'public_channel,private_channel',
    cursor: params.cursor,
  });

  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error ?? 'unknown'}`);
  }

  const channels: SlackChannel[] = (result.channels ?? []).map((ch) => ({
    id: ch.id ?? '',
    name: ch.name ?? '',
    is_private: ch.is_private ?? false,
    is_archived: ch.is_archived ?? false,
    num_members: ch.num_members ?? 0,
    topic: ch.topic?.value ?? '',
    purpose: ch.purpose?.value ?? '',
    created: ch.created ?? 0,
  }));

  return {
    channels,
    next_cursor: result.response_metadata?.next_cursor,
  };
}

export async function getChannelHistory(
  client: WebClient,
  params: z.infer<typeof getChannelHistorySchema>
): Promise<{ messages: SlackMessage[]; has_more: boolean }> {
  const result = await client.conversations.history({
    channel: params.channel_id,
    limit: params.limit,
    oldest: params.oldest,
    latest: params.latest,
  });

  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error ?? 'unknown'}`);
  }

  const messages: SlackMessage[] = (result.messages ?? []).map((msg) => ({
    ts: msg.ts ?? '',
    user: (msg.user as string | undefined) ?? 'unknown',
    text: msg.text ?? '',
    type: msg.type ?? 'message',
    reactions: msg.reactions?.map((r) => ({
      name: r.name ?? '',
      count: r.count ?? 0,
    })),
    reply_count: msg.reply_count,
    thread_ts: msg.thread_ts,
  }));

  return {
    messages,
    has_more: result.has_more ?? false,
  };
}
