import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import ApplicationsSection from "./ApplicationsSection";
import { createSessionApplication } from "../lib/applications/sessionApplications";
import type { SessionApplicationV1 } from "../lib/applications/sessionApplications";
import { createSessionApplicationRepository } from "../lib/applications/sessionRepository";
import {
  ApplicationRepositoryError,
  type ApplicationPage,
  type ApplicationRepository,
} from "../lib/applications/repositoryTypes";

const NOW = "2026-11-02T10:00:00.000Z";

function application(localId: string, title: string): SessionApplicationV1 {
  return createSessionApplication({
    localId,
    now: NOW,
    coverLetter: "",
    job: {
      jobId: `job-${localId}`,
      title,
      companyName: "Synthetic Company",
      location: ["Berlin"],
      source: ["synthetic"],
      originalUrl: `https://example.com/jobs/${localId}`,
    },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function repositoryWithList(
  list: ApplicationRepository["list"],
  initial: SessionApplicationV1[] = []
): ApplicationRepository {
  const base = createSessionApplicationRepository({ initial });
  return { ...base, list };
}

function renderSection(repository: ApplicationRepository, refreshToken = 0) {
  return render(
    <LangProvider>
      <ApplicationsSection repository={repository} refreshToken={refreshToken} />
    </LangProvider>
  );
}

function cardTitles(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".applications-list__item")).map(
    (node) => node.querySelector("strong")?.textContent ?? ""
  );
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("JM-APPLICATION-LOADING-STATE-01 applications load states", () => {
  it("shows a distinct loading state and never the empty state while loading", async () => {
    const pending = deferred<ApplicationPage>();
    const list = vi.fn<ApplicationRepository["list"]>(() => pending.promise);
    renderSection(repositoryWithList(list));

    expect(screen.getByText("Bewerbungen werden geladen…")).toBeInTheDocument();
    expect(screen.queryByText("Noch keine Bewerbungen")).toBeNull();

    await act(async () => {
      pending.resolve({ items: [], nextCursor: null });
      await pending.promise;
    });

    expect(await screen.findByText("Noch keine Bewerbungen")).toBeInTheDocument();
    expect(screen.queryByText("Bewerbungen werden geladen…")).toBeNull();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state only after a successful empty response", async () => {
    const list = vi.fn<ApplicationRepository["list"]>(async () => ({
      items: [],
      nextCursor: null,
    }));
    renderSection(repositoryWithList(list));

    expect(await screen.findByText("Noch keine Bewerbungen")).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("shows an error with retry and replaces it with data after a successful retry", async () => {
    const list = vi
      .fn<ApplicationRepository["list"]>()
      .mockRejectedValueOnce(new ApplicationRepositoryError("load failed", "unavailable"))
      .mockResolvedValueOnce({ items: [application("a", "Recovered Job")], nextCursor: null });
    renderSection(repositoryWithList(list));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Bewerbungsaktion konnte nicht abgeschlossen/i);
    expect(screen.queryByText("Noch keine Bewerbungen")).toBeNull();
    expect(list).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));

    expect(await screen.findByText("Recovered Job")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Noch keine Bewerbungen")).toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("ignores a stale first-page response after refreshToken changes", async () => {
    const first = deferred<ApplicationPage>();
    const list = vi
      .fn<ApplicationRepository["list"]>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ items: [application("b", "Newest Job")], nextCursor: null });
    const repository = repositoryWithList(list);
    const view = renderSection(repository, 0);

    view.rerender(
      <LangProvider>
        <ApplicationsSection repository={repository} refreshToken={1} />
      </LangProvider>
    );

    expect(await screen.findByText("Newest Job")).toBeInTheDocument();

    await act(async () => {
      first.resolve({ items: [application("a", "Stale Job")], nextCursor: null });
      await first.promise;
    });

    expect(screen.queryByText("Stale Job")).toBeNull();
    expect(screen.getAllByText("Newest Job").length).toBeGreaterThan(0);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("appends the next page without duplicates and hides load more at the end", async () => {
    const list = vi
      .fn<ApplicationRepository["list"]>()
      .mockResolvedValueOnce({ items: [application("a", "First Job")], nextCursor: "cursor-2" })
      .mockResolvedValueOnce({
        items: [application("b", "Second Job"), application("a", "First Job")],
        nextCursor: null,
      });
    renderSection(repositoryWithList(list));

    expect(await screen.findByText("First Job")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Weitere Bewerbungen laden" }));

    expect(await screen.findByText("Second Job")).toBeInTheDocument();
    expect(cardTitles()).toEqual(["First Job", "Second Job"]);
    expect(screen.queryByRole("button", { name: "Weitere Bewerbungen laden" })).toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls[1][0]).toMatchObject({ cursor: "cursor-2" });
  });

  it("prevents concurrent duplicate load-more requests", async () => {
    const second = deferred<ApplicationPage>();
    const list = vi
      .fn<ApplicationRepository["list"]>()
      .mockResolvedValueOnce({ items: [application("a", "First Job")], nextCursor: "cursor-2" })
      .mockReturnValueOnce(second.promise);
    renderSection(repositoryWithList(list));

    expect(await screen.findByText("First Job")).toBeInTheDocument();
    const loadMore = screen.getByRole("button", { name: "Weitere Bewerbungen laden" });
    fireEvent.click(loadMore);
    fireEvent.click(loadMore);

    expect(list).toHaveBeenCalledTimes(2);

    await act(async () => {
      second.resolve({ items: [application("b", "Second Job")], nextCursor: null });
      await second.promise;
    });

    expect(await screen.findByText("Second Job")).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("keeps loaded items and offers an inline retry when a page fails", async () => {
    const list = vi
      .fn<ApplicationRepository["list"]>()
      .mockResolvedValueOnce({ items: [application("a", "Existing Job")], nextCursor: "cursor-2" })
      .mockRejectedValueOnce(new ApplicationRepositoryError("page failed", "unavailable"))
      .mockResolvedValueOnce({
        items: [application("b", "More Job"), application("a", "Existing Job")],
        nextCursor: null,
      });
    renderSection(repositoryWithList(list));

    expect(await screen.findByText("Existing Job")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Weitere Bewerbungen laden" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Bewerbungsaktion konnte nicht abgeschlossen/i);
    expect(cardTitles()).toEqual(["Existing Job"]);

    fireEvent.click(screen.getByRole("button", { name: "Weitere Bewerbungen erneut laden" }));

    expect(await screen.findByText("More Job")).toBeInTheDocument();
    expect(cardTitles()).toEqual(["Existing Job", "More Job"]);
    expect(list).toHaveBeenCalledTimes(3);
    expect(list.mock.calls[2][0]).toMatchObject({ cursor: "cursor-2" });
  });
});
