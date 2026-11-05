import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRisApplicationRepository } from './risRepository';
import { ApplicationRepositoryError } from '../repositoryTypes';

const RIS_APP = {
  applicationId: 'app-1',
  job: {
    jobId: 'job-1',
    title: 'Engineer',
    company: 'Synthetic Co',
    location: 'Berlin',
    source: 'jobsearch',
    url: 'https://example.invalid/job-1',
  },
  documents: {
    coverLetterDraft: 'Hello',
    coverLetterVersions: [],
    documentStatus: 'draft',
  },
  salary: {
    expectation: { amount: 50000.5, currency: 'EUR', period: 'year' },
  },
  status: 'DRAFT',
  stage: 'draft',
  version: 1,
  createdAt: '2026-11-05T00:00:00Z',
  updatedAt: '2026-11-05T00:00:00Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function repository(fetchImpl: typeof fetch, token: string | null = 'access-token') {
  return createRisApplicationRepository({
    basePath: '/api/ris',
    getAccessToken: () => token,
    fetchImpl,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RIS application repository', () => {
  it('creates through the BFF without browser-owned identity fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(RIS_APP, 201));
    const repo = repository(fetchMock as unknown as typeof fetch);

    const created = await repo.create({
      job: {
        jobId: 'job-1',
        title: 'Engineer',
        companyName: 'Synthetic Co',
        location: ['Berlin'],
        source: ['jobsearch'],
        originalUrl: 'https://example.invalid/job-1',
      },
      coverLetter: 'Hello',
      idempotencyKey: 'idem-1',
    });

    expect(created.localId).toBe('app-1');
    expect(created.status).toBe('draft');
    expect(created.salary?.expectation?.amount).toBe(50000.5);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/ris/applications');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
    expect((init.headers as Record<string, string>)['X-Api-Credential']).toBeUndefined();
    const body = JSON.parse(String(init.body));
    expect(body.job).toMatchObject({
      jobId: 'job-1',
      company: 'Synthetic Co',
      location: 'Berlin',
      source: 'jobsearch',
    });
    expect(body.idempotencyKey).toBe('idem-1');
    expect(body.applicationId).toBeUndefined();
    expect(body.ownerId).toBeUndefined();
    expect(body.localId).toBeUndefined();
  });

  it('lists with limit/cursor/status and maps pages', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      items: [RIS_APP],
      nextCursor: 'next-1',
    }));
    const repo = repository(fetchMock as unknown as typeof fetch);

    const page = await repo.list({ limit: 2, cursor: 'cursor-1', status: 'draft' });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].localId).toBe('app-1');
    expect(page.nextCursor).toBe('next-1');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('limit=2');
    expect(url).toContain('cursor=cursor-1');
    expect(url).toContain('status=DRAFT');
  });

  it('reads RIS metrics through the port', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      metrics: {
        total: 1,
        drafts: 1,
        submitted: 0,
        interviews: 0,
        openFollowUps: 0,
        overdueFollowUps: 0,
      },
    }));
    const repo = createRisApplicationRepository({
      basePath: '/api/ris',
      getAccessToken: () => 'access-token',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    // The UI repository does not expose metrics; the port does.
    const port = (await import('./risClient')).createRisApplicationPersistencePort({
      basePath: '/api/ris',
      getAccessToken: () => 'access-token',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const metrics = await port.metrics();
    expect(metrics.total).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ris/applications/metrics',
      expect.objectContaining({ method: 'GET' })
    );
    expect(repo).toBeDefined();
  });

  it('updates with expectedVersion and maps the new version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      ...RIS_APP,
      version: 2,
      notes: 'updated',
    }));
    const repo = repository(fetchMock as unknown as typeof fetch);

    const updated = await repo.update('app-1', {
      expectedVersion: 1,
      changes: { notes: 'updated', salary: { expectation: { amount: 60000.75, currency: 'EUR', period: 'year' } } },
    });

    expect(updated.version).toBe(2);
    expect(updated.notes).toBe('updated');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/ris/applications/app-1');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(String(init.body));
    expect(body.expectedVersion).toBe(1);
    expect(body.salary.expectation.amount).toBe(60000.75);
    expect(body.localId).toBeUndefined();
  });

  it('exports a remote resource without claiming a local draft', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      application: RIS_APP,
      exportedAt: '2026-11-05T01:00:00Z',
    }));
    const repo = repository(fetchMock as unknown as typeof fetch);

    const exported = await repo.export('app-1');
    expect(exported.localDraft).toBe(false);
    expect(exported.application.localId).toBe('app-1');
    expect(exported.exportedAt).toBe('2026-11-05T01:00:00Z');
  });

  it('deletes with expectedVersion and returns a remote result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const repo = repository(fetchMock as unknown as typeof fetch);

    const result = await repo.delete('app-1', { expectedVersion: 2 });
    expect(result).toEqual({ deleted: true, localId: 'app-1', idempotent: false });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/ris/applications/app-1');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(String(init.body))).toEqual({ expectedVersion: 2 });
  });

  it('returns null for a missing application', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      { error: 'Application not found.', code: 'not_found' }, 404));
    const repo = repository(fetchMock as unknown as typeof fetch);
    await expect(repo.get('missing')).resolves.toBeNull();
  });

  it('maps version conflicts to version_conflict', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      { error: 'conflict', code: 'VERSION_CONFLICT' }, 409));
    const repo = repository(fetchMock as unknown as typeof fetch);
    await expect(repo.update('app-1', { expectedVersion: 1, changes: { notes: 'x' } }))
      .rejects.toMatchObject({ code: 'version_conflict' });
  });

  it('marks unsupported RIS operations explicitly', async () => {
    const repo = repository(vi.fn() as unknown as typeof fetch);
    await expect(repo.transitionStatus('app-1', {
      expectedVersion: 1,
      to: 'submitted',
      at: '2026-11-05T00:00:00Z',
    })).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('fails before fetch when no access token exists', async () => {
    const fetchMock = vi.fn();
    const repo = repository(fetchMock as unknown as typeof fetch, null);
    await expect(repo.list()).rejects.toBeInstanceOf(ApplicationRepositoryError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('finds an application by job across pages', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ items: [], nextCursor: 'p2' }))
      .mockResolvedValueOnce(jsonResponse({ items: [RIS_APP], nextCursor: null }));
    const repo = repository(fetchMock as unknown as typeof fetch);
    const found = await repo.findByJob('job-1');
    expect(found?.localId).toBe('app-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
