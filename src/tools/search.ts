import { WebClient } from '@slack/web-api';
import { z } from 'zod';

export const searchMessagesSchema = z.object({
  query: z.string().min(1, 'query is required').max(500),
  count: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(1).default(1),
  sort: z.enum(['score', 'timestamp']).default('score'),
  sort_dir: z.enum(['asc', 'desc']).default('desc'),
  highlight: z.boolean().default(false),
});

export interface SearchResult {
  query: string;
  total: number;
  page: number;
  pages: number;
  messages: SearchMessage[];
}

export interface SearchMessage {
  ts: string;
  text: string;
  user: string;
  username: string;
  channel: {
    id: string;
    name: string;
  };
  permalink: string;
  previous_2?: { text: string; user: string };
}

export async function searchMessages(
  client: WebClient,
  params: z.infer<typeof searchMessagesSchema>
): Promise<SearchResult> {
  const result = await client.search.messages({
    query: params.query,
    count: params.count,
    page: params.page,
    sort: params.sort,
    sort_dir: params.sort_dir,
    highlight: params.highlight,
  });

  if (!result.ok || !result.messages) {
    throw new Error(`Slack API error: ${result.error ?? 'search failed'}`);
  }

  const matches = result.messages.matches ?? [];

  const messages: SearchMessage[] = matches.map((match) => {
    const channel = match.channel as
      | { id?: string; name?: string }
      | undefined;
    const previous = match.previous_2 as
      | { text?: string; user?: string }
      | undefined;

    return {
      ts: match.ts ?? '',
      text: match.text ?? '',
      user: (match.user as string | undefined) ?? '',
      username: (match.username as string | undefined) ?? '',
      channel: {
        id: channel?.id ?? '',
        name: channel?.name ?? '',
      },
      permalink: (match.permalink as string | undefined) ?? '',
      ...(previous?.text
        ? { previous_2: { text: previous.text, user: previous.user ?? '' } }
        : {}),
    };
  });

  return {
    query: params.query,
    total: result.messages.total ?? 0,
    page: result.messages.pagination?.page ?? params.page,
    pages: result.messages.pagination?.page_count ?? 1,
    messages,
  };
}
