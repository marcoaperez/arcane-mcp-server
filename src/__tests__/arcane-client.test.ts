import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ArcaneClient, ArcaneApiError, type VersionInfo } from "../arcane-client";

describe("ArcaneClient", () => {
  let client: ArcaneClient;
  let mockFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("fetch not mocked");
    });
    // Local/Docker mode: a concrete base URL so request URLs are assertable.
    client = new ArcaneClient("test-api-key", "http://localhost:3552");
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  describe("Constructor", () => {
    it("sets baseUrl to http://placeholder/api in Cloudflare (VPC binding) mode", () => {
      const cfClient = new ArcaneClient("test-api-key");
      expect((cfClient as any).baseUrl).toBe("http://placeholder/api");
    });

    it("sets baseUrl from the provided host in local mode", () => {
      expect((client as any).baseUrl).toBe("http://localhost:3552/api");
    });

    it("stores the API key", () => {
      expect((client as any).apiKey).toBe("test-api-key");
    });
  });

  describe("request() internals", () => {
    it("sends X-API-Key header on every request", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { total: 0, start: 0, limit: 50 } }),
      } as Response);

      await client.environments.list();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-API-Key": "test-api-key",
          }),
        })
      );
    });

    it("sends Content-Type application/json on POST requests with body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: null, message: "created" }),
      } as Response);

      await client.environments.create({ name: "test", apiUrl: "http://localhost:2375" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("returns parsed JSON body on 2xx response", async () => {
      const mockData = { success: true, data: [], pagination: { total: 0, start: 0, limit: 50 } };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      } as Response);

      const result = await client.environments.list();
      expect(result).toEqual(mockData);
    });

    it("throws ArcaneApiError with status and message on non-2xx response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ detail: "Environment not found" }),
      } as Response);

      await expect(client.environments.get("123")).rejects.toThrow(ArcaneApiError);
      await expect(client.environments.get("123")).rejects.toThrow("Environment not found");
    });

    it("uses statusText as message if no detail field in error response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ title: "Server Error" }),
      } as Response);

      await expect(client.environments.get("123")).rejects.toThrow("Internal Server Error");
    });

    it("requestHead() no parsea cuerpo y devuelve el codigo de estado", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

      const resultado = await client.requestHead("/environments/env123/system/health");

      expect(resultado).toEqual({ ok: true, status: 200 });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/system/health",
        expect.objectContaining({ method: "HEAD" })
      );
    });

    it("requestHead() devuelve ok:false en vez de lanzar cuando el estado no es 2xx", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 503 } as Response);

      const resultado = await client.requestHead("/environments/env123/system/health");

      expect(resultado).toEqual({ ok: false, status: 503 });
    });
  });

  describe("environments", () => {
    it(".list(opts?) - GET /environments with optional query params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { total: 0, start: 0, limit: 50 } }),
      } as Response);

      await client.environments.list({ search: "test", limit: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments?search=test&limit=10",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".get(id) - GET /environments/{id}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: "123", name: "test" } }),
      } as Response);

      await client.environments.get("123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/123",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".create(dto) - POST /environments with body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: "123", name: "test" } }),
      } as Response);

      const dto = { name: "test", apiUrl: "http://localhost:2375" };
      await client.environments.create(dto);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(dto),
        })
      );
    });

    it(".update(id, dto) - PUT /environments/{id} with body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: "123", name: "updated" } }),
      } as Response);

      const dto = { name: "updated" };
      await client.environments.update("123", dto);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/123",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(dto),
        })
      );
    });

    it(".delete(id) - DELETE /environments/{id}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Deleted" }),
      } as Response);

      await client.environments.delete("123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/123",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("stacks", () => {
    it(".list(envId, opts?) - GET /environments/{envId}/projects", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { total: 0, start: 0, limit: 50 } }),
      } as Response);

      await client.stacks.list("env123", { search: "myapp" });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/projects?search=myapp",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".get(envId, stackId) - GET /environments/{envId}/projects/{stackId}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: "stack1", name: "myapp" } }),
      } as Response);

      await client.stacks.get("env123", "stack1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/projects/stack1",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".deploy(envId, dto) - POST /environments/{envId}/projects", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Deployed" }),
      } as Response);

      const dto = { name: "myapp", composeContent: "version: '3'" };
      await client.stacks.deploy("env123", dto);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/projects",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(dto),
        })
      );
    });

    it(".update(envId, stackId, dto) - PUT /environments/{envId}/projects/{stackId}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: "stack1", name: "updated" } }),
      } as Response);

      const dto = { composeContent: "version: '3.8'" };
      await client.stacks.update("env123", "stack1", dto);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/projects/stack1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(dto),
        })
      );
    });

    it(".delete(envId, stackId) - DELETE /environments/{envId}/projects/{stackId}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Deleted" }),
      } as Response);

      await client.stacks.delete("env123", "stack1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/projects/stack1/destroy",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    // NOTE: .start() (POST /up) streams NDJSON, not a single JSON object.
    // It is covered by the dedicated "NDJSON /up and /redeploy streams" describe block below.

    it(".stop(envId, stackId) - POST /environments/{envId}/projects/{stackId}/down", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Stopped" }),
      } as Response);

      await client.stacks.stop("env123", "stack1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/projects/stack1/down",
        expect.objectContaining({ method: "POST" })
      );
    });

    it(".restart(envId, stackId) - POST /environments/{envId}/projects/{stackId}/restart", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Restarted" }),
      } as Response);

      await client.stacks.restart("env123", "stack1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/projects/stack1/restart",
        expect.objectContaining({ method: "POST" })
      );
    });

    it(".pull(envId, stackId) - POST /environments/{envId}/projects/{stackId}/pull (NDJSON)", async () => {
      // Task 11: /pull streams the same {activityId,log,done} shape as /up
      // and /redeploy, not docker-pull-style {status,id}. Fixture captured
      // verbatim from a real Arcane v2.7.0 stream (2026-08-16, stack
      // "ical-bridge", local image, no registry involved).
      const ndjsonBody = [
        '{"type":"activity","activityId":"bf40d2c4-53a0-4058-9b1b-296442fdf6b1"}',
        '{"done":true}',
      ].join("\n");

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => ndjsonBody,
      } as Response);

      const result = await client.stacks.pull("env123", "stack1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/projects/stack1/pull",
        expect.objectContaining({ method: "POST" })
      );
      expect(result.success).toBe(true);
    });

    it(".pull(envId, stackId) - reports error when NDJSON contains an `error` field", async () => {
      const ndjsonBody = [
        '{"type":"activity","activityId":"abc"}',
        '{"error":"manifest not found"}',
      ].join("\n");

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => ndjsonBody,
      } as Response);

      const result = await client.stacks.pull("env123", "stack1");
      expect(result.success).toBe(false);
      expect(result.message).toContain("manifest not found");
    });
  });

  describe("Task 11: /pull uses summarizeComposeStream, same shape as /up and /redeploy", () => {
    // Origin: real stream captured against Arcane v2.7.0 (2026-08-16),
    // POST /api/environments/0/projects/{id}/pull. Keys observed across the
    // whole capture: activityId, done, log, type — `status`/`id` (the
    // docker-pull shape the old, now-deleted summarizePullStream() assumed)
    // never appear.

    // Caso A: local image, no registry involved (stack "ical-bridge").
    const localImagePullStream = [
      '{"type":"activity","activityId":"bf40d2c4-53a0-4058-9b1b-296442fdf6b1"}',
      '{"done":true}',
    ].join("\n");

    // Caso B: registry image (stack "gitea", image gitea/gitea:1.25.5).
    const giteaPullStream = [
      '{"type":"activity","activityId":"77c852a9-af6e-4e05-9180-1e021b22c8b6"}',
      '{"log":"1.25.5: Pulling from gitea/gitea"}',
      '{"log":"Digest: sha256:f846d26a4fc389c5806a580a765e00bfdd1fd181e6f2060da98ea2669d914472"}',
      '{"log":"Status: Image is up to date for gitea/gitea:1.25.5"}',
      '{"done":true}',
    ].join("\n");

    // Log lines with no terminal {"done":true} — deliberate behavior change:
    // the old summarizePullStream() treated "no error observed" as success
    // even without a sentinel; summarizeComposeStream() requires {"done":true}.
    const noDoneStream = [
      '{"type":"activity","activityId":"xyz"}',
      '{"log":"Pulling fs layer"}',
    ].join("\n");

    // errorDetail-only failure (no plain `error` field). openapi.txt declares
    // no content schema for /pull's 200 response, so this shape — first
    // observed on /pull — must keep being recognized through the shared helper.
    const errorDetailOnlyStream = [
      '{"type":"activity","activityId":"xyz"}',
      '{"errorDetail":{"message":"manifest for foo/bar:latest not found"}}',
    ].join("\n");

    // Defensive fallback: a single {success,message} object instead of a
    // stream. requestNdjson() yields it as one event; summarizeComposeStream()
    // must pass it through unchanged rather than trying to aggregate it.
    const singleObjectFallback = '{"success":true,"message":"Project images pulled"}';

    // Zero events: no {"done":true} was ever observed, so success must be
    // false. Deliberate decision (same rationale as noDoneStream above) —
    // an empty stream is not vacuous success.
    const emptyStream = "";

    // Same event carries both `error` and `errorDetail.message` with
    // identical text. extractStreamError() returns the first match it finds
    // (`error`) and never falls through to `errorDetail`, so the message
    // must appear exactly once in the aggregated result, not twice.
    const duplicateErrorStream = [
      '{"type":"activity","activityId":"xyz"}',
      '{"error":"manifest for foo/bar:latest not found","errorDetail":{"message":"manifest for foo/bar:latest not found"}}',
    ].join("\n");

    describe("stacks.pull", () => {
      it("Test 1 (regression): the gitea fixture message contains real docker output, not a bare event count", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => giteaPullStream } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result.message).toContain("Status: Image is up to date for gitea/gitea:1.25.5");
        expect(result.message).not.toMatch(/^Pull finished \(\d+ events\)$/);
      });

      it('Test 2: a stream ending in {"done":true} with no log lines reports success:true', async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => localImagePullStream } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result.success).toBe(true);
      });

      it('Test 3 (deliberate behavior change): log lines with no {"done":true} report success:false', async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => noDoneStream } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result.success).toBe(false);
      });

      it("Test 4: an error reported only via errorDetail (no plain `error` field) is still detected", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => errorDetailOnlyStream } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result.success).toBe(false);
        expect(result.message).toContain("manifest for foo/bar:latest not found");
      });

      it("Test 5: falls back to a single ActionResponse object if the endpoint does not stream", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => singleObjectFallback } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result.success).toBe(true);
        expect(result.message).toBe("Project images pulled");
      });

      it("Test 6: an empty stream (0 events) reports success:false", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => emptyStream } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result.success).toBe(false);
      });

      it("Test 7: `error` and `errorDetail` on the same event do not duplicate the message", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => duplicateErrorStream } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result.success).toBe(false);
        const occurrences = (result.message.match(/manifest for foo\/bar:latest not found/g) ?? []).length;
        expect(occurrences).toBe(1);
      });
    });

    describe("projectAdditional.pullImages", () => {
      it("Test 1 (regression): the gitea fixture message contains real docker output, not a bare event count", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => giteaPullStream } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result.message).toContain("Status: Image is up to date for gitea/gitea:1.25.5");
        expect(result.message).not.toMatch(/^Pull finished \(\d+ events\)$/);
      });

      it('Test 2: a stream ending in {"done":true} with no log lines reports success:true', async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => localImagePullStream } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result.success).toBe(true);
      });

      it('Test 3 (deliberate behavior change): log lines with no {"done":true} report success:false', async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => noDoneStream } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result.success).toBe(false);
      });

      it("Test 4: an error reported only via errorDetail (no plain `error` field) is still detected", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => errorDetailOnlyStream } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result.success).toBe(false);
        expect(result.message).toContain("manifest for foo/bar:latest not found");
      });

      it("Test 5: falls back to a single ActionResponse object if the endpoint does not stream", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => singleObjectFallback } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result.success).toBe(true);
        expect(result.message).toBe("Project images pulled");
      });

      it("Test 6: an empty stream (0 events) reports success:false", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => emptyStream } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result.success).toBe(false);
      });

      it("Test 7: `error` and `errorDetail` on the same event do not duplicate the message", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => duplicateErrorStream } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result.success).toBe(false);
        const occurrences = (result.message.match(/manifest for foo\/bar:latest not found/g) ?? []).length;
        expect(occurrences).toBe(1);
      });
    });
  });

  describe("NDJSON /up and /redeploy streams", () => {
    // Endpoints /up (stacks.start) and /redeploy stream `application/x-json-stream`
    // (NDJSON), NOT a single JSON object. Parsing the whole body with response.json()
    // throws "Unexpected non-whitespace character after JSON..." on the 2nd line.
    // Real event shape captured from Arcane: {type,activityId}, {log}, {done:true}, {error}.
    let localClient: ArcaneClient;

    beforeEach(() => {
      // Local/Docker mode so the request URL resolves to a concrete host.
      localClient = new ArcaneClient("test-api-key", "http://localhost:3552");
    });

    const upStream = [
      '{"type":"activity","activityId":"195296d1-f692-401e-b56f-0d6421c8bb9d"}',
      '{"log":" Container ical-bridge Recreate "}',
      '{"log":" Container ical-bridge Recreated "}',
      '{"log":" Container ical-bridge Starting "}',
      '{"log":" Container ical-bridge Started "}',
      '{"log":" Container ical-bridge Waiting "}',
      '{"log":" Container ical-bridge Healthy "}',
      '{"done":true}',
    ].join("\n");

    it("start() does NOT throw on a multi-line NDJSON /up body (regression for JSON.parse crash)", async () => {
      mockFetch.mockResolvedValue({ ok: true, text: async () => upStream } as Response);
      await expect(localClient.stacks.start("env123", "stack1")).resolves.toBeDefined();
    });

    it("start() - POST /up parses NDJSON and returns an aggregated success", async () => {
      mockFetch.mockResolvedValue({ ok: true, text: async () => upStream } as Response);

      const result = await localClient.stacks.start("env123", "stack1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/projects/stack1/up",
        expect.objectContaining({ method: "POST" })
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain("Healthy");
    });

    it("start() reports failure when the /up stream contains an error event", async () => {
      const errStream = [
        '{"type":"activity","activityId":"x"}',
        '{"log":" Container web Building "}',
        '{"error":"failed to build: exit code 1"}',
      ].join("\n");
      mockFetch.mockResolvedValue({ ok: true, text: async () => errStream } as Response);

      const result = await localClient.stacks.start("env123", "stack1");
      expect(result.success).toBe(false);
      expect(result.message).toContain("failed to build");
    });

    it("redeploy() - POST /redeploy parses NDJSON and returns success", async () => {
      const redeployStream = [
        '{"type":"activity","activityId":"9ae9f9d2-2503-4d22-9b0b-fcade4d3e155"}',
        '{"log":" Container ical-bridge Running "}',
        '{"log":" Container ical-bridge Healthy "}',
        '{"done":true}',
      ].join("\n");
      mockFetch.mockResolvedValue({ ok: true, text: async () => redeployStream } as Response);

      const result = await localClient.projectAdditional.redeploy("env123", "proj1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/projects/proj1/redeploy",
        expect.objectContaining({ method: "POST" })
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain("Healthy");
    });

    it("redeploy() reports failure when the /redeploy stream contains an error event", async () => {
      const errStream = [
        '{"type":"activity","activityId":"x"}',
        '{"error":"no such image: ghcr.io/foo/bar:latest"}',
      ].join("\n");
      mockFetch.mockResolvedValue({ ok: true, text: async () => errStream } as Response);

      const result = await localClient.projectAdditional.redeploy("env123", "proj1");
      expect(result.success).toBe(false);
      expect(result.message).toContain("no such image");
    });

    it("start() falls back to a single ActionResponse object if the endpoint does not stream", async () => {
      // Defensive: OpenAPI declares /redeploy as application/json, and some Arcane
      // versions may return a single {success,message} object instead of a stream.
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '{"success":true,"message":"Project started"}',
      } as Response);

      const result = await localClient.stacks.start("env123", "stack1");
      expect(result.success).toBe(true);
      expect(result.message).toContain("Project started");
    });
  });

  describe("containers", () => {
    it(".list(envId, opts?) - GET /environments/{envId}/containers", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { total: 0, start: 0, limit: 50 } }),
      } as Response);

      await client.containers.list("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/containers",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".get(envId, containerId) - GET /environments/{envId}/containers/{containerId}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: "cont1", name: "web" } }),
      } as Response);

      await client.containers.get("env123", "cont1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/containers/cont1",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".start(envId, containerId) - POST /environments/{envId}/containers/{containerId}/start", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Started" }),
      } as Response);

      await client.containers.start("env123", "cont1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/containers/cont1/start",
        expect.objectContaining({ method: "POST" })
      );
    });

    it(".stop(envId, containerId) - POST /environments/{envId}/containers/{containerId}/stop", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Stopped" }),
      } as Response);

      await client.containers.stop("env123", "cont1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/containers/cont1/stop",
        expect.objectContaining({ method: "POST" })
      );
    });

    it(".restart(envId, containerId) - POST /environments/{envId}/containers/{containerId}/restart", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Restarted" }),
      } as Response);

      await client.containers.restart("env123", "cont1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/containers/cont1/restart",
        expect.objectContaining({ method: "POST" })
      );
    });

    it(".kill(envId, containerId) - POST /environments/{envId}/containers/{containerId}/update (kill action)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Killed" }),
      } as Response);

      await client.containers.kill("env123", "cont1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/containers/cont1/update",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "kill" }),
        })
      );
    });
  });

  describe("images", () => {
    it(".list(envId) - GET /environments/{envId}/images", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { total: 0, start: 0, limit: 50 } }),
      } as Response);

      await client.images.list("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/images",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".pull(envId, dto) - POST /environments/{envId}/images/pull", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Pulled" }),
      } as Response);

      const dto = { imageName: "nginx:latest" };
      await client.images.pull("env123", dto);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/images/pull",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(dto),
        })
      );
    });

    it(".remove(envId, imageId) - DELETE /environments/{envId}/images/{imageId}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Removed" }),
      } as Response);

      await client.images.remove("env123", "img123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/images/img123",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it(".prune(envId) - POST /environments/{envId}/images/prune", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { imagesDeleted: 0, spaceReclaimed: 0 } }),
      } as Response);

      await client.images.prune("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/images/prune",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("volumes", () => {
    it(".list(envId) - GET /environments/{envId}/volumes", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { total: 0, start: 0, limit: 50 } }),
      } as Response);

      await client.volumes.list("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/volumes",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".inspect(envId, name) - GET /environments/{envId}/volumes/{name}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { name: "data-vol" } }),
      } as Response);

      await client.volumes.inspect("env123", "data-vol");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/volumes/data-vol",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".remove(envId, name) - DELETE /environments/{envId}/volumes/{name}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Removed" }),
      } as Response);

      await client.volumes.remove("env123", "data-vol");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/volumes/data-vol",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it(".prune(envId) - POST /environments/{envId}/volumes/prune", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { volumesDeleted: 0, spaceReclaimed: 0 } }),
      } as Response);

      await client.volumes.prune("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/volumes/prune",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  // Arcane 2.8.0 eliminó la familia /browse y la sustituyó por /workspace.
  // Comprobado en vivo contra la instancia: /browse devuelve 404.
  describe("volumeFiles (API workspace de 2.8.0)", () => {
    const workspaceVacio = {
      success: true,
      data: { files: [], fileTreeRevision: "rev-abc", fileTreeTruncated: false },
    };

    it(".getWorkspace(envId, name) - GET /environments/{envId}/volumes/{name}/workspace", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => workspaceVacio } as Response);

      const resultado = await client.volumeFiles.getWorkspace("env123", "data-vol");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/volumes/data-vol/workspace",
        expect.objectContaining({ method: "GET" })
      );
      expect(resultado.data.fileTreeRevision).toBe("rev-abc");
    });

    it(".uploadFile() - PUT multipart con manifiesto create_file y el fichero en uploadIndex 0", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => workspaceVacio } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, message: "Workspace updated" }),
        } as Response);

      await client.volumeFiles.uploadFile("env123", "data-vol", "notas/hola.txt", "hola mundo");

      // Primero lee el workspace para obtener el testigo de concurrencia.
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        "http://localhost:3552/api/environments/env123/volumes/data-vol/workspace",
        expect.objectContaining({ method: "GET" })
      );

      const [url, init] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect(url).toBe("http://localhost:3552/api/environments/env123/volumes/data-vol/workspace");
      expect(init.method).toBe("PUT");

      // El boundary lo pone el runtime: fijar Content-Type a mano lo rompería.
      const headers = init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBeUndefined();

      const form = init.body as FormData;
      expect(form).toBeInstanceOf(FormData);
      const manifiesto = JSON.parse(form.get("manifest") as string);
      expect(manifiesto).toEqual({
        fileTreeRevision: "rev-abc",
        fileChanges: [{ operation: "create_file", relativePath: "notas/hola.txt", uploadIndex: 0 }],
      });
      expect(await (form.getAll("files")[0] as File).text()).toBe("hola mundo");
    });
  });

  describe("activities", () => {
    it(".list(envId, opts) - GET /environments/{envId}/activities con filtros", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { totalItems: 0 } }),
      } as Response);

      await client.activities.list("env123", { status: "failed", limit: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/activities?limit=10&status=failed",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".get(envId, activityId) - GET /environments/{envId}/activities/{activityId}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { activity: { id: "act1" }, messages: [] } }),
      } as Response);

      await client.activities.get("env123", "act1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/activities/act1",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".get(envId, activityId, limit) - añade ?limit= para no truncar el log en el default de 500 del servidor", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { activity: { id: "act1" }, messages: [] } }),
      } as Response);

      await client.activities.get("env123", "act1", 2000);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/activities/act1?limit=2000",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".cancel(envId, activityId) - POST /environments/{envId}/activities/{activityId}/cancel", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "act1",
            status: "cancelled",
            type: "deploy",
            environmentId: "env1",
            startedAt: "2026-08-16T10:00:00Z",
            createdAt: "2026-08-16T10:00:00Z",
          },
        }),
      } as Response);

      await client.activities.cancel("env123", "act1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/activities/act1/cancel",
        expect.objectContaining({ method: "POST" })
      );
    });

    it(".get(envId, activityId) codifica un activityId hostil en vez de dejarlo saltar de ruta", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { activity: { id: "act1" }, messages: [] } }),
      } as Response);

      // Un activityId adversario que, sin encodeURIComponent, escaparia de
      // /activities/ y aterrizaria en /api/users (dominio de administracion
      // fuera de la superficie de escritura del MCP).
      await client.activities.get("env123", "../../../users?");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("/activities/");
      expect(calledUrl).not.toContain("/api/users");
      expect(calledUrl).toBe(
        "http://localhost:3552/api/environments/env123/activities/..%2F..%2F..%2Fusers%3F"
      );
    });
  });

  describe("events", () => {
    it(".list() sin environmentId - GET /events", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { totalItems: 0 } }),
      } as Response);

      await client.events.list({ severity: "error", limit: 5 });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/events?limit=5&severity=error",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".list() con environmentId - GET /events/environment/{envId}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { totalItems: 0 } }),
      } as Response);

      await client.events.list({ environmentId: "env123", limit: 5 });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/events/environment/env123?limit=5",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".stats() - GET /events/stats", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { total: 0, info: 0, success: 0, warning: 0, error: 0 } }),
      } as Response);

      await client.events.stats();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/events/stats",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("jobs", () => {
    it(".list(envId) - GET /environments/{envId}/jobs con el sobre {jobs}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ isAgent: false, jobs: [{ id: "auto-heal", name: "Auto Heal" }] }),
      } as Response);

      const resultado = await client.jobs.list("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/jobs",
        expect.objectContaining({ method: "GET" })
      );
      // El sobre NO es {data,pagination}: leerlo como paginado devolveria vacio.
      expect(resultado.jobs?.[0].id).toBe("auto-heal");
    });

    it(".run(envId, jobId) - POST /environments/{envId}/jobs/{jobId}/run", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Job started" }),
      } as Response);

      await client.jobs.run("env123", "auto-heal");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/jobs/auto-heal/run",
        expect.objectContaining({ method: "POST" })
      );
    });

    it(".getSchedules(envId) - GET /environments/{envId}/job-schedules", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ autoHealInterval: "30s" }),
      } as Response);

      await client.jobs.getSchedules("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/job-schedules",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".updateSchedules(envId, cambios) - PUT con el cuerpo recibido, devuelve {success,data}", async () => {
      // El spec declara BaseApiResponseJobscheduleConfig: {success, data: JobSchedulesConfig}.
      // No hay campo `message` en ningun nivel (verificado contra openapi.txt).
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { autoHealInterval: "30s" } }),
      } as Response);

      const resultado = await client.jobs.updateSchedules("env123", { autoHealInterval: "30s" });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/job-schedules",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ autoHealInterval: "30s" }),
        })
      );
      expect(resultado.data.autoHealInterval).toBe("30s");
    });
  });

  describe("ImageUpdatesMethods", () => {
    const ok = (data: unknown) =>
      ({ ok: true, json: async () => ({ success: true, data }) }) as Response;

    it("summary(envId) - GET /environments/{envId}/image-updates/summary", async () => {
      mockFetch.mockResolvedValue(ok({ totalImages: 18, imagesWithUpdates: 4, digestUpdates: 4, errorsCount: 2 }));
      const r = await client.imageUpdates.summary("env1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/image-updates/summary",
        expect.objectContaining({ method: "GET" }),
      );
      expect(r.data.imagesWithUpdates).toBe(4);
    });

    it("byRefs(envId, refs) une las referencias con comas en un solo parametro", async () => {
      mockFetch.mockResolvedValue(ok({}));
      await client.imageUpdates.byRefs("env1", ["nginx:latest", "redis:7"]);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/image-updates/by-refs?imageRefs=nginx%3Alatest%2Credis%3A7",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("check(envId, {imageRef}) usa el endpoint por referencia", async () => {
      mockFetch.mockResolvedValue(ok({ checkTime: "t", currentVersion: "1", hasUpdate: true, responseTimeMs: 5, updateType: "digest" }));
      await client.imageUpdates.check("env1", { imageRef: "nginx:latest" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/image-updates/check?imageRef=nginx%3Alatest",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("check(envId, {imageId}) usa el endpoint por ID", async () => {
      mockFetch.mockResolvedValue(ok({ checkTime: "t", currentVersion: "1", hasUpdate: false, responseTimeMs: 5, updateType: "digest" }));
      await client.imageUpdates.check("env1", { imageId: "sha256:abc" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/image-updates/check/sha256%3Aabc",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("check(envId, {}) sin referencia ni ID lanza sin llamar a la API", async () => {
      await expect(client.imageUpdates.check("env1", {})).rejects.toThrow(/imageRef o imageId/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("checkBatch(envId, refs) manda la lista en el cuerpo", async () => {
      mockFetch.mockResolvedValue(ok({}));
      await client.imageUpdates.checkBatch("env1", ["nginx:latest"]);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/image-updates/check-batch",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ imageRefs: ["nginx:latest"] }) }),
      );
    });
  });

  describe("UpdaterMethods", () => {
    const ok = (data: unknown) =>
      ({ ok: true, json: async () => ({ success: true, data }) }) as Response;

    it("status(envId) - GET /environments/{envId}/updater/status", async () => {
      mockFetch.mockResolvedValue(ok({ updatingContainers: 0, updatingProjects: 0, containerIds: [], projectIds: [] }));
      await client.updater.status("env1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/updater/status",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("history(envId, limit) envia el limit", async () => {
      mockFetch.mockResolvedValue(ok([]));
      await client.updater.history("env1", 10);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/updater/history?limit=10",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("history(envId) sin limit no anade query string", async () => {
      mockFetch.mockResolvedValue(ok([]));
      await client.updater.history("env1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/updater/history",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("run(envId, opts) manda resourceIds, type y dryRun en el cuerpo", async () => {
      mockFetch.mockResolvedValue(ok({ checked: 1, updated: 0, skipped: 1, failed: 0, duration: "1s", items: [] }));
      await client.updater.run("env1", { resourceIds: ["c1"], type: "container", dryRun: true });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/updater/run",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ resourceIds: ["c1"], type: "container", dryRun: true }),
        }),
      );
    });

    it("run(envId, {resourceIds: []}) lanza sin llamar a la API", async () => {
      await expect(client.updater.run("env1", { resourceIds: [] })).rejects.toThrow(/resourceIds/);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("VulnerabilitiesMethods", () => {
    it(".scannerStatus(envId) - GET /vulnerabilities/scanner-status", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { available: true, version: "0.73.0" } }),
      } as Response);
      const r = await client.vulnerabilities.scannerStatus("env1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/vulnerabilities/scanner-status",
        expect.objectContaining({ method: "GET" })
      );
      expect(r.data.available).toBe(true);
    });

    it(".environmentSummary(envId) - GET /vulnerabilities/summary", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { totalImages: 19, scannedImages: 1 } }),
      } as Response);
      await client.vulnerabilities.environmentSummary("env1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/vulnerabilities/summary",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".listAll con todos los filtros construye la query completa", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { totalPages: 1, totalItems: 0, currentPage: 1, itemsPerPage: 5 } }),
      } as Response);
      await client.vulnerabilities.listAll("env1", {
        sort: "severity", limit: 5, severity: "high", imageName: "curlimages/curl:8.5.0",
      });
      // URL literal completa: si severity o imageName dejan de escribirse, esto falla.
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/vulnerabilities/all?sort=severity&limit=5&severity=high&imageName=curlimages%2Fcurl%3A8.5.0",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".listAll sin opciones no lleva query", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { totalPages: 1, totalItems: 0, currentPage: 1, itemsPerPage: 20 } }),
      } as Response);
      await client.vulnerabilities.listAll("env1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/vulnerabilities/all",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".imageOptions con severity y sin severity", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      } as Response);
      await client.vulnerabilities.imageOptions("env1", "critical");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/vulnerabilities/image-options?severity=critical",
        expect.objectContaining({ method: "GET" })
      );
      await client.vulnerabilities.imageOptions("env1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/vulnerabilities/image-options",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".scanResult codifica el imageId en la ruta", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { imageId: "sha256:abc", imageName: "x", scanTime: "t", status: "completed" } }),
      } as Response);
      await client.vulnerabilities.scanResult("env1", "sha256:abc");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/images/sha256%3Aabc/vulnerabilities",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".imageList con severity construye la query", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { totalPages: 1, totalItems: 0, currentPage: 1, itemsPerPage: 3 } }),
      } as Response);
      await client.vulnerabilities.imageList("env1", "sha256:abc", { sort: "severity", limit: 3, severity: "high" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/images/sha256%3Aabc/vulnerabilities/list?sort=severity&limit=3&severity=high",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".imageSummary - GET /images/{id}/vulnerabilities/summary", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { imageId: "sha256:abc", scanTime: "t", status: "completed" } }),
      } as Response);
      await client.vulnerabilities.imageSummary("env1", "sha256:abc");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/images/sha256%3Aabc/vulnerabilities/summary",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".imageSummaries envía el body {imageIds}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { summaries: {} } }),
      } as Response);
      await client.vulnerabilities.imageSummaries("env1", ["sha256:a", "sha256:b"]);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/images/vulnerabilities/summaries",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ imageIds: ["sha256:a", "sha256:b"] }) })
      );
    });

    it(".ignoredList con y sin query", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { totalPages: 1, totalItems: 0, currentPage: 1, itemsPerPage: 20 } }),
      } as Response);
      await client.vulnerabilities.ignoredList("env1", { sort: "id", limit: 200 });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/vulnerabilities/ignored?sort=id&limit=200",
        expect.objectContaining({ method: "GET" })
      );
      await client.vulnerabilities.ignoredList("env1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/vulnerabilities/ignored",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("networks", () => {
    it(".list(envId) - GET /environments/{envId}/networks", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { total: 0, start: 0, limit: 50 } }),
      } as Response);

      await client.networks.list("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/networks",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".inspect(envId, networkId) - GET /environments/{envId}/networks/{networkId}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: "net1", name: "my-network" } }),
      } as Response);

      await client.networks.inspect("env123", "net1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/networks/net1",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".remove(envId, networkId) - DELETE /environments/{envId}/networks/{networkId}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Removed" }),
      } as Response);

      await client.networks.remove("env123", "net1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/networks/net1",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it(".prune(envId) - POST /environments/{envId}/networks/prune", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { networksDeleted: 0 } }),
      } as Response);

      await client.networks.prune("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/networks/prune",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("gitOpsSyncs", () => {
    it(".list(envId) devuelve el objeto counts que trae la API (cuarto endpoint con counts, hallazgo 3)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          counts: { totalSyncs: 5, activeSyncs: 3, successfulSyncs: 4 },
          pagination: { totalItems: 5, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
        }),
      } as Response);

      const r = await client.gitOpsSyncs.list("env123");

      expect(r.counts).toEqual({ totalSyncs: 5, activeSyncs: 3, successfulSyncs: 4 });
      expect(r.pagination.totalItems).toBe(5);
    });
  });

  describe("templates", () => {
    it(".list(opts?) - GET /templates", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { total: 0, start: 0, limit: 50 } }),
      } as Response);

      await client.templates.list({ search: "wordpress" });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/templates?search=wordpress",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".get(id) - GET /templates/{id}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: "tpl1", name: "WordPress" } }),
      } as Response);

      await client.templates.get("tpl1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/templates/tpl1",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".create(dto) - POST /templates", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: "tpl1", name: "My Template" } }),
      } as Response);

      const dto = { name: "My Template", description: "A template", content: "version: '3'", envContent: "" };
      await client.templates.create(dto);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/templates",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(dto),
        })
      );
    });

    it(".update(id, dto) - PUT /templates/{id}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: "tpl1", name: "Updated" } }),
      } as Response);

      const dto = { name: "Updated", description: "Updated template", content: "version: '3'", envContent: "" };
      await client.templates.update("tpl1", dto);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/templates/tpl1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(dto),
        })
      );
    });

    it(".delete(id) - DELETE /templates/{id}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Deleted" }),
      } as Response);

      await client.templates.delete("tpl1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/templates/tpl1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("system", () => {
    it(".version() - GET /app-version", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { version: "1.2.3" } }),
      } as Response);

      await client.system.version();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/app-version",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".version() devuelve un VersionInfo tipado con currentVersion", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          currentVersion: "v2.7.0",
          displayVersion: "v2.7.0",
          goVersion: "go1.26.5",
          nodeVersion: "v22.11.0",
          svelteKitVersion: "2.9.0",
          revision: "a4a84fe5",
          shortRevision: "a4a84fe5",
          isSemverVersion: true,
          updateAvailable: true,
        }),
      } as Response);

      const info: VersionInfo = await client.system.version();

      expect(info.currentVersion).toBe("v2.7.0");
      expect(info.updateAvailable).toBe(true);
    });
  });

  describe("system (F2)", () => {
    it(".dockerInfo(envId) - GET /environments/{envId}/system/docker/info", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, ServerVersion: "29.2.1" }),
      } as Response);

      await client.system.dockerInfo("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/system/docker/info",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".health(envId) - HEAD, sin parsear cuerpo", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

      const resultado = await client.system.health("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/system/health",
        expect.objectContaining({ method: "HEAD" })
      );
      expect(resultado).toEqual({ ok: true, status: 200 });
    });

    it(".prune(envId, opciones) - POST con las opciones como cuerpo", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { success: true, spaceReclaimed: 0 } }),
      } as Response);

      await client.system.prune("env123", { buildCache: { mode: "dangling" } });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/system/prune",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ buildCache: { mode: "dangling" } }),
        })
      );
    });

    it(".convert(envId, comando) - POST /system/convert", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, dockerCompose: "services:", envVars: "", serviceName: "nginx" }),
      } as Response);

      await client.system.convert("env123", "docker run -d nginx");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/system/convert",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ dockerRunCommand: "docker run -d nginx" }),
        })
      );
    });
  });

  describe("Parametros de listado (containers, images, volumes, networks)", () => {
    const okVacio = () =>
      ({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          counts: {},
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
        }),
      }) as Response;

    it("containers.list envia los cinco comunes mas includeInternal y standalone", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.containers.list("env1", {
        search: "web", sort: "name", order: "asc", start: 20, limit: 50,
        includeInternal: true, standalone: "false",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/containers?search=web&sort=name&order=asc&start=20&limit=50&includeInternal=true&standalone=false",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("containers.list sin opciones no anade query string", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.containers.list("env1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/containers",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("start=0 se envia (es un valor valido, no una ausencia)", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.containers.list("env1", { start: 0 });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/containers?start=0",
        expect.objectContaining({ method: "GET" }),
      );
    });

    // gitRepositories, gitOpsSyncs y volumeBackups construian su query a mano
    // con `if (opts?.start)` en vez de usar appendListParams: start=0 se
    // perdia por veracidad. Ahora los tres usan el helper, igual que el resto.
    it("gitRepositories.list: start=0 se envia (es un valor valido, no una ausencia)", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.gitRepositories.list({ start: 0 });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/customize/git-repositories?start=0",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("gitOpsSyncs.list: start=0 se envia (es un valor valido, no una ausencia)", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.gitOpsSyncs.list("env1", { start: 0 });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/gitops-syncs?start=0",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("volumeBackups.list: start=0 se envia (es un valor valido, no una ausencia)", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.volumeBackups.list("env1", "data-vol", { start: 0 });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/volumes/data-vol/backups?start=0",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("images.list envia los cinco comunes mas inUse", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.images.list("env1", { search: "nginx", sort: "size", order: "desc", start: 10, limit: 5, inUse: "true" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/images?search=nginx&sort=size&order=desc&start=10&limit=5&inUse=true",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("volumes.list envia los cinco comunes mas inUse e includeInternal", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.volumes.list("env1", { limit: 200, inUse: "false", includeInternal: true });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/volumes?limit=200&inUse=false&includeInternal=true",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("networks.list envia los cinco comunes mas inUse", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.networks.list("env1", { search: "bridge", inUse: "true" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/networks?search=bridge&inUse=true",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("volumes.list devuelve el objeto counts que trae la API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          counts: { inuse: 8, unused: 24, total: 32 },
          pagination: { totalItems: 32, totalPages: 2, currentPage: 1, itemsPerPage: 20 },
        }),
      } as Response);
      const r = await client.volumes.list("env1");
      expect(r.counts).toEqual({ inuse: 8, unused: 24, total: 32 });
      expect(r.pagination.totalItems).toBe(32);
    });
  });

  describe("Parametros de listado descartados en silencio", () => {
    const okVacio = () =>
      ({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
        }),
      }) as Response;

    it("stacks.list envia limit, que hasta ahora tiraba", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.stacks.list("env1", { search: "app", limit: 50 });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/projects?search=app&limit=50",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("stacks.list envia tambien sort, order, start y los filtros propios", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.stacks.list("env1", {
        sort: "name", order: "desc", start: 20, limit: 10,
        status: "running", archived: "all", tags: "prod,web",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/projects?sort=name&order=desc&start=20&limit=10&status=running&archived=all&tags=prod%2Cweb",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("templates.list envia limit, que hasta ahora tiraba", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.templates.list({ search: "nginx", limit: 50, type: "compose" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/templates?search=nginx&limit=50&type=compose",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("environments.list envia sort, order, start y type", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.environments.list({ sort: "name", order: "asc", start: 5, limit: 10, type: "local" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments?sort=name&order=asc&start=5&limit=10&type=local",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("activities.list reenvia sort, order y start, que declaraba y no mandaba", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.activities.list("env1", { sort: "createdAt", order: "desc", start: 50, limit: 10, status: "failed" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/activities?sort=createdAt&order=desc&start=50&limit=10&status=failed",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("events.list reenvia sort, order y start en la ruta global", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.events.list({ sort: "timestamp", order: "desc", start: 20, limit: 5, severity: "error" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/events?sort=timestamp&order=desc&start=20&limit=5&severity=error",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("events.list reenvia sort, order y start en la ruta por entorno", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.events.list({ environmentId: "env1", sort: "timestamp", start: 10 });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/events/environment/env1?sort=timestamp&start=10",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  describe("El filtro updates", () => {
    const okVacio = () =>
      ({ ok: true, json: async () => ({ success: true, data: [], counts: {}, pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 } }) }) as Response;

    it("containers.list envia updates", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.containers.list("env1", { updates: "has_update" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/containers?updates=has_update",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("images.list envia updates junto a los demas filtros", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.images.list("env1", { inUse: "true", updates: "true" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/images?inUse=true&updates=true",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("stacks.list envia updates", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.stacks.list("env1", { updates: "up_to_date" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/projects?updates=up_to_date",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });
});
