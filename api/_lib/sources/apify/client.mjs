export async function startApifyRun(apiToken, actorId, input) {
  let response;
  try {
    response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch {
    return { error: "network" };
  }

  if (!response.ok) {
    return { error: `upstream_${response.status}` };
  }

  let run;
  try {
    const data = await response.json();
    run = data?.data ?? data;
  } catch {
    return { error: "unreadable" };
  }
  if (!run || typeof run !== "object" || typeof run.id !== "string") {
    return { error: "unexpected" };
  }
  return { run };
}

export async function waitForRun(apiToken, runId, maxWaitMs) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    let response;
    try {
      response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: "application/json",
        },
      });
    } catch {
      return { error: "network" };
    }

    if (!response.ok) {
      return { error: `upstream_${response.status}` };
    }

    let run;
    try {
      const data = await response.json();
      run = data?.data ?? data;
    } catch {
      return { error: "unreadable" };
    }
    if (!run || typeof run !== "object") {
      return { error: "unexpected" };
    }
    if (run.status === "SUCCEEDED") {
      return { run };
    }
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(run.status)) {
      return { error: `run_${run.status}` };
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return { error: "run_timeout" };
}

export async function readDataset(apiToken, datasetId) {
  let response;
  try {
    response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
      },
    });
  } catch {
    return { error: "network" };
  }

  if (!response.ok) {
    return { error: `upstream_${response.status}` };
  }

  let data;
  try {
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      console.error("[apify] dataset items body not JSON:", text.slice(0, 300));
      return { error: "unreadable" };
    }
  } catch {
    return { error: "unreadable" };
  }
  const records = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : null;
  if (!records) {
    return { error: "unexpected" };
  }
  return { records };
}