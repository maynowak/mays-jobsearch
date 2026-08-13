import type { StatusMessage } from "../types";

export default function Status({ status }: { status: StatusMessage | null }) {
  if (!status) return null;
  return (
    <section id="status" aria-live="polite">
      <div className={`alert alert-${status.type}`}>{status.message}</div>
    </section>
  );
}