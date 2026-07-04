import { WebClient } from '@slack/web-api';
import { z } from 'zod';

export const sendMessageSchema = z.object({
  channel_id: z.string().min(1, 'channel_id is required'),
  text: z.string().min(1, 'text is required').max(40000),
  thread_ts: z
    .string()
    .optional()
    .describe('Timestamp of parent message to reply in thread'),
  mrkdwn: z.boolean().default(true).describe('Enable Slack markdown formatting'),
});

export const getThreadRepliesSchema = z.object({
  channel_id: z.string().min(1, 'channel_id is required'),
  thread_ts: z.string().min(1, 'thread_ts is required'),
  limit: z.number().int().min(1).max(100).default(20),
});

export interface SentMessage {
  ts: string;
  channel: string;
  text: string;
  permalink?: string;
}

export interface ThreadReply {
  ts: string;
  user: string;
  text: string;
  type: string;
}

export async function sendMessage(
  client: WebClient,
  params: z.infer<typeof sendMessageSchema>
): Promise<SentMessage> {
  const result = await client.chat.postMessage({
    channel: params.channel_id,
    text: params.text,
    thread_ts: params.thread_ts,
    mrkdwn: params.mrkdwn,
  });

  if (!result.ok || !result.ts) {
    throw new Error(`Slack API error: ${result.error ?? 'unknown'}`);
  }

  // Fetch permalink for the sent message
  let permalink: string | undefined;
  try {
    const permalinkResult = await client.chat.getPermalink({
      channel: params.channel_id,
      message_ts: result.ts,
    });
    if (permalinkResult.ok) {
      permalink = permalinkResult.permalink as string | undefined;
    }
  } catch {
    // Non-fatal — permalink is optional
  }

  return {
    ts: result.ts,
    channel: (result.channel as string | undefined) ?? params.channel_id,
    text: params.text,
    permalink,
  };
}

export async function getThreadReplies(
  client: WebClient,
  params: z.infer<typeof getThreadRepliesSchema>
): Promise<{ replies: ThreadReply[]; has_more: boolean }> {
  const result = await client.conversations.replies({
    channel: params.channel_id,
    ts: params.thread_ts,
    limit: params.limit,
  });

  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error ?? 'unknown'}`);
  }

  // Skip the first message — it is the parent thread message
  const replies: ThreadReply[] = (result.messages ?? [])
    .slice(1)
    .map((msg) => ({
      ts: msg.ts ?? '',
      user: (msg.user as string | undefined) ?? 'unknown',
      text: msg.text ?? '',
      type: msg.type ?? 'message',
    }));

  return {
    replies,
    has_more: result.has_more ?? false,
  };
}
