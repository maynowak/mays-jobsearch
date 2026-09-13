import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";
import RemainingCard from "./RemainingCard";
import { LangProvider } from "../i18n";
import "@testing-library/jest-dom";

const createTestJob = (overrides = {}) => ({
  slug: "test-job",
  title: "Software Engineer",
  company_name: "Test Company",
  location: ["Berlin"],
  remote: false,
  tags: ["JavaScript", "React"],
  url: "https://example.com/job",
  created_at: Date.now(),
  source: ["arbeitnow"],
  description: "<p><strong>About Sony Music Entertainment</strong></p><p>At Sony Music Entertainment, we fuel the creative journey...</p>",
  descriptionPlain: "About Sony Music Entertainment At Sony Music Entertainment, we fuel the creative journey... ".repeat(10), // Long enough for toggle
  jobTypes: ["full_time"],
  contractType: "UNBEFRISTET",
  salary: "60000",
  ...overrides,
});

function renderWithProvider(job: ReturnType<typeof createTestJob>, lang: "en" | "de" = "de") {
  // Force language by setting localStorage before render
  try {
    localStorage.setItem("mj-lang", lang);
  } catch {}
  return render(
    <LangProvider>
      <RemainingCard job={job as any} />
    </LangProvider>
  );
}

describe("RemainingCard - canonical HTML rendering", () => {
  afterEach(() => {
    cleanup();
    try { localStorage.clear(); } catch {}
  });

  it("renders collapsed preview as plain text (no HTML tags visible)", () => {
    renderWithProvider(createTestJob());
    // Should show plain text preview, not HTML tags
    expect(screen.getByText(/About Sony Music Entertainment/i)).toBeInTheDocument();
    expect(screen.getByText(/fuel the creative journey/i)).toBeInTheDocument();
    // Should NOT contain literal HTML tags as text
    expect(screen.queryByText(/<p>/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<strong>/i)).not.toBeInTheDocument();
  });

it("renders expanded description as actual HTML (DOM elements) when expanded", async () => {
    const { container } = renderWithProvider(createTestJob());
    // Click "Mehr anzeigen" to expand (German locale)
    const moreButton = screen.getByRole("button", { name: /mehr anzeigen/i });
    moreButton.click();

    // Wait for the expanded content to appear
    await screen.findByText(/About Sony Music Entertainment/i);

    // Should render actual HTML elements via dangerouslySetInnerHTML
    const strongElement = container.querySelector("strong");
    expect(strongElement).toBeInTheDocument();
    expect(strongElement?.tagName).toBe("STRONG");
    expect(strongElement?.textContent).toContain("About Sony Music Entertainment");

    // Should NOT contain literal HTML tags as visible text
    expect(screen.queryByText(/<p>/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<strong>/i)).not.toBeInTheDocument();
  });

  it("renders expanded view directly when description is short (no toggle)", () => {
    // Short description - should render expanded directly
    const shortJob = createTestJob({
      descriptionPlain: "Short description",
    });
    renderWithProvider(shortJob);
    
    // Should render expanded view directly (no toggle button)
    expect(screen.queryByRole("button", { name: /mehr anzeigen/i })).not.toBeInTheDocument();
    
    // Should have actual HTML elements
    const strongElements = document.querySelectorAll("strong");
    expect(strongElements.length).toBeGreaterThan(0);
    expect(strongElements[0]?.textContent).toContain("About Sony Music Entertainment");
  });

  it("removes dangerous markup in expanded view", () => {
    const maliciousJob = createTestJob({
      description: '<p>Hello</p><img src=x onerror="alert(1)"><script>alert(1)</script>',
      descriptionPlain: "Hello ".repeat(50), // Long enough for toggle
    });
    const { unmount } = renderWithProvider(maliciousJob);
    const moreButton = screen.getByRole("button", { name: /mehr anzeigen/i });
    moreButton.click();
    unmount();

    // Dangerous elements should be removed by DOMPurify
    expect(screen.queryByText(/onerror/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/alert/i)).not.toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });
});