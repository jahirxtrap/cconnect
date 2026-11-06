export interface TransferState {
  status: "idle" | "active" | "done" | "failed";
  bytes: number;
  total: number;
}

export const followTransfer =
  (onProgress: (value: number) => void, settle: (done: boolean) => void) => (state: TransferState) => {
    if (state.total > 0) onProgress(Math.min(1, state.bytes / state.total));
    if (state.status !== "active") settle(state.status === "done");
  };
