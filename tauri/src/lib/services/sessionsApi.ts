import { http } from "./http";

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

export const sessionsApi = {
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
};
