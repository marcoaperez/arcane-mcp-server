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
      // Endpoint /pull returns NDJSON (newline-delimited JSON), not a single JSON object.
      const ndjsonBody = [
        '{"status":"starting project image pull"}',
        '{"status":"Pulling from adguard/adguardhome","id":"latest"}',
        '{"status":"Status: Image is up to date for adguard/adguardhome:latest"}',
        '{"status":"complete"}',
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
      expect(result.message).toContain("complete");
    });

    it(".pull(envId, stackId) - reports error when NDJSON contains errors", async () => {
      const ndjsonBody = [
        '{"status":"starting project image pull"}',
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

  describe("pull success criterion (Task 10 regression: absence of error is success)", () => {
    // Live evidence (2026-08-16, Arcane v2.7.0, env "0", stack "ical-bridge"):
    // a 2-event pull stream with no errors and no {"status":"complete"} sentinel
    // was reported as `success:false` ("Pull failed for stack 'ical-bridge':
    // Pull finished (2 events)") because the old code required that sentinel,
    // which has never been observed against a real server.
    const realisticNoSentinelStream = [
      '{"status":"Pulling from taiko/ical-bridge","id":"latest"}',
      '{"status":"Image is up to date for taiko/ical-bridge:latest"}',
    ].join("\n");

    const errorStream = [
      '{"status":"starting project image pull"}',
      '{"error":"manifest for ghcr.io/foo/bar:latest not found"}',
    ].join("\n");

    const singleObjectFallback = '{"success":true,"message":"Images pulled"}';

    const statusLineStream = [
      '{"status":"Pulling fs layer","id":"a1b2c3"}',
      '{"status":"Downloading","id":"a1b2c3"}',
      '{"status":"Status: Downloaded newer image for myapp/web:latest"}',
    ].join("\n");

    // openapi.txt declares /pull's 200 response with no `content`, so the stream
    // shape isn't specified anywhere. Arcane may report a failed layer via
    // `errorDetail` (an object, typically `{"message":"..."}`) instead of the
    // plain `error` string. Only checking `e.error` lets this fall through to
    // the "no errors observed" branch and report success:true on a broken pull.
    const errorDetailOnlyStream = [
      '{"status":"Pulling from foo/bar"}',
      '{"errorDetail":{"message":"manifest for ghcr.io/foo/bar:latest not found"}}',
    ].join("\n");

    // Same event carries both forms with identical text: the extracted error
    // message must not be duplicated.
    const bothErrorFormsSameTextStream = [
      '{"error":"pull access denied","errorDetail":{"message":"pull access denied"}}',
    ].join("\n");

    const emptyStream = "";

    // Realistic docker-pull progress: two layers pulled with repeated identical
    // progress ticks ("Downloading"/"Extracting" repeated per layer while the
    // byte counters that aren't captured here change), ending on a burst of
    // identical "Extracting" ticks for the slower layer.
    const repetitiveMultiLayerStream = [
      '{"status":"Pulling fs layer","id":"a1"}',
      '{"status":"Pulling fs layer","id":"b2"}',
      '{"status":"Downloading","id":"a1"}',
      '{"status":"Downloading","id":"b2"}',
      '{"status":"Downloading","id":"a1"}',
      '{"status":"Downloading","id":"b2"}',
      '{"status":"Downloading","id":"a1"}',
      '{"status":"Verifying Checksum","id":"a1"}',
      '{"status":"Download complete","id":"a1"}',
      '{"status":"Downloading","id":"b2"}',
      '{"status":"Verifying Checksum","id":"b2"}',
      '{"status":"Download complete","id":"b2"}',
      '{"status":"Extracting","id":"a1"}',
      '{"status":"Extracting","id":"b2"}',
      '{"status":"Extracting","id":"b2"}',
      '{"status":"Extracting","id":"b2"}',
      '{"status":"Extracting","id":"b2"}',
      '{"status":"Extracting","id":"b2"}',
    ].join("\n");

    describe("stacks.pull", () => {
      it("Test 1 (regression): a stream with no errors and no complete sentinel reports success:true", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => realisticNoSentinelStream } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result.success).toBe(true);
      });

      it("Test 2: a stream with an error event reports success:false with the error text", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => errorStream } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result.success).toBe(false);
        expect(result.message).toContain("manifest for ghcr.io/foo/bar:latest not found");
      });

      it("Test 3: single-object ActionResponse fallback is returned unchanged", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => singleObjectFallback } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result).toEqual({ success: true, message: "Images pulled" });
      });

      it("Test 4: a normal pull stream produces a message with real event info, not just a count", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => statusLineStream } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result.success).toBe(true);
        expect(result.message).not.toMatch(/^Pull finished \(\d+ events\)$/);
        expect(result.message).toContain("Downloaded newer image for myapp/web:latest");
      });

      it("Test 5 (regression): an error reported only via errorDetail (no plain `error` field) reports success:false", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => errorDetailOnlyStream } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result.success).toBe(false);
        expect(result.message).toContain("manifest for ghcr.io/foo/bar:latest not found");
      });

      it("Test 6: an event carrying both `error` and `errorDetail` with identical text does not duplicate it", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => bothErrorFormsSameTextStream } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Pull failed: pull access denied");
      });

      it("Test 7: an empty stream (0 events) cannot confirm success, so it reports success:false", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => emptyStream } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Pull returned no events; cannot confirm success");
      });

      it("Test 8: repeated identical status lines across layers are collapsed, not echoed 5x", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => repetitiveMultiLayerStream } as Response);

        const result = await client.stacks.pull("env123", "stack1");

        expect(result.success).toBe(true);
        expect(result.message).toBe(
          "b2: Downloading | b2: Verifying Checksum | b2: Download complete | a1: Extracting | b2: Extracting"
        );
      });
    });

    describe("projectAdditional.pullImages", () => {
      it("Test 1 (regression): a stream with no errors and no complete sentinel reports success:true", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => realisticNoSentinelStream } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result.success).toBe(true);
      });

      it("Test 2: a stream with an error event reports success:false with the error text", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => errorStream } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result.success).toBe(false);
        expect(result.message).toContain("manifest for ghcr.io/foo/bar:latest not found");
      });

      it("Test 3: single-object ActionResponse fallback is returned unchanged", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => singleObjectFallback } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result).toEqual({ success: true, message: "Images pulled" });
      });

      it("Test 4: a normal pull stream produces a message with real event info, not just a count", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => statusLineStream } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result.success).toBe(true);
        expect(result.message).not.toMatch(/^Pull finished \(\d+ events\)$/);
        expect(result.message).toContain("Downloaded newer image for myapp/web:latest");
      });

      it("Test 5 (regression): an error reported only via errorDetail (no plain `error` field) reports success:false", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => errorDetailOnlyStream } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result.success).toBe(false);
        expect(result.message).toContain("manifest for ghcr.io/foo/bar:latest not found");
      });

      it("Test 6: an event carrying both `error` and `errorDetail` with identical text does not duplicate it", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => bothErrorFormsSameTextStream } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Pull failed: pull access denied");
      });

      it("Test 7: an empty stream (0 events) cannot confirm success, so it reports success:false", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => emptyStream } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Pull returned no events; cannot confirm success");
      });

      it("Test 8: repeated identical status lines across layers are collapsed, not echoed 5x", async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => repetitiveMultiLayerStream } as Response);

        const result = await client.projectAdditional.pullImages("env123", "proj1");

        expect(result.success).toBe(true);
        expect(result.message).toBe(
          "b2: Downloading | b2: Verifying Checksum | b2: Download complete | a1: Extracting | b2: Extracting"
        );
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
});
