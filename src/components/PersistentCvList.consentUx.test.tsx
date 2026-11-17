import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import PersistentCvList from "./PersistentCvList";
import type { CvConsentState } from "../lib/cvStorageApi";

function consent(): CvConsentState {
  return {
    consent: {
      purpose: "cv-storage",
      status: "NOT_GRANTED",
      noticeVersion: "1.0",
      grantedAt: null,
      withdrawnAt: null,
      version: 0,
      specialCategoriesConsent: false,
      specialCategories: [],
      externalTextVersion: null,
      externalTextSha256: null,
    },
    noticeVersion: "1.0",
    noticeState: "APPROVED",
    noticeApproved: true,
    acceptedForNewGrant: true,
    grantAllowed: true,
    noticeReason: null,
    textVersion: "cv-storage-consent-2026-11-08-v1",
    textHash: "test",
    textState: "APPROVED",
    textMapped: true,
    textApproved: true,
    textReason: null,
    specialCategoriesConsent: false,
    specialCategories: [],
    externalTextVersion: null,
    externalTextSha256: null,
  };
}

beforeEach(() => localStorage.setItem("mj-lang", "de"));
afterEach(() => cleanup());

it("verlinkt bei fehlender CV-Freigabe direkt zu den Einwilligungen", () => {
  render(
    <LangProvider>
      <PersistentCvList
        documents={[]}
        consent={consent()}
        loading={false}
        consentLoading={false}
        busy={false}
        error={null}
        notice={null}
        onUpload={vi.fn(async () => true)}
        onDownload={vi.fn(async () => undefined)}
        onDelete={vi.fn(async () => true)}
        onGrantConsent={vi.fn(async () => true)}
        onWithdrawConsent={vi.fn(async () => true)}
      />
    </LangProvider>
  );

  expect(screen.getByText(/CV-Speicherfreigabe ist von der ApplicationV1-Speicherfreigabe getrennt/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Einwilligungen in den Einstellungen öffnen" })).toHaveAttribute(
    "href",
    "/profil?tab=settings"
  );
});
