import { parseSessionMessage, type SessionMessage } from "$lib/data/sessionMessages";
import { http, type HttpClient } from "./http";

export interface MessagesPage {
  items: SessionMessage[];
  startIndex: number;
  hasMore: boolean;
  contextTokens: number | null;
}

export interface RewindPoint {
  id: string;
  rewindId: string;
  text: string;
}

export interface RewindPreview {
  canRewind: boolean;
  error: string | null;
  filesChanged: string[];
  insertions: number;
  deletions: number;
}

interface RewindWire {
  can_rewind?: boolean;
  error?: string;
  files_changed?: string[];
  insertions?: number;
  deletions?: number;
}

const toPreview = (data: RewindWire | null): RewindPreview | null =>
  data && {
    canRewind: data.can_rewind === true,
    error: data.error ?? null,
    filesChanged: data.files_changed ?? [],
    insertions: data.insertions ?? 0,
    deletions: data.deletions ?? 0,
  };

export const createSessionsApi = (http: HttpClient) => ({
  async messages(
    sessionId: string,
    project: string,
    limit = 200,
    beforeIndex: number | null = null,
  ): Promise<MessagesPage | null> {
    const data = await http.get<{
      items?: Record<string, unknown>[];
      start_index?: number;
      has_more?: boolean | string;
      context_tokens?: number;
    }>(`/sessions/${sessionId}/messages`, {
      project,
      limit,
      ...(beforeIndex === null ? {} : { before_index: beforeIndex }),
    });
    if (!data) return null;
    return {
      items: (data.items ?? []).map(parseSessionMessage),
      startIndex: data.start_index ?? 0,
      hasMore: data.has_more === true || data.has_more === "true",
      contextTokens: data.context_tokens ?? null,
    };
  },

  async checkpoints(sessionId: string, project: string): Promise<RewindPoint[]> {
    const data = await http.get<Array<{ id?: string; rewind_id?: string; text?: string }>>(
      `/sessions/${sessionId}/checkpoints`,
      { project },
    );
    if (!Array.isArray(data)) return [];
    return data
      .filter((point) => point.id && point.rewind_id)
      .map((point) => ({ id: point.id!, rewindId: point.rewind_id!, text: point.text ?? "" }));
  },

  async rewindPreview(sessionId: string, project: string, userMessageId: string) {
    return toPreview(
      await http.post<RewindWire>(`/sessions/${sessionId}/rewind/preview`, {
        project,
        user_message_id: userMessageId,
      }),
    );
  },

  async rewind(sessionId: string, project: string, point: RewindPoint, mode: "both" | "conversation") {
    return toPreview(
      await http.post<RewindWire>(`/sessions/${sessionId}/rewind`, {
        project,
        user_message_id: point.id,
        rewind_id: point.rewindId,
        mode,
      }),
    );
  },

  async remove(sessionId: string, project: string): Promise<boolean> {
    return (await http.delete(`/sessions/${sessionId}`, { project })) !== null;
  },

  async rename(sessionId: string, project: string, title: string): Promise<boolean> {
    return (await http.post(`/sessions/${sessionId}/rename`, { project, title })) !== null;
  },

  async autoRename(sessionId: string, project: string): Promise<string | null> {
    const data = await http.post<{ title?: string }>(`/sessions/${sessionId}/auto-rename`, { project });
    return data?.title ?? null;
  },

  async setColor(sessionId: string, project: string, color: string): Promise<boolean> {
    return (await http.post(`/sessions/${sessionId}/color`, { project, color })) !== null;
  },
});

export type SessionsApi = ReturnType<typeof createSessionsApi>;

export const sessionsApi = createSessionsApi(http);
