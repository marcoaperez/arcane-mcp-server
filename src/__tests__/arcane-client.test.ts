import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ArcaneClient, ArcaneApiError } from "../arcane-client";

describe("ArcaneClient", () => {
  let client: ArcaneClient;
  let mockFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("fetch not mocked");
    });
    client = new ArcaneClient("test-api-key");
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  describe("Constructor", () => {
    it("sets baseUrl to http://placeholder/api", () => {
      expect((client as any).baseUrl).toBe("http://placeholder/api");
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

    it(".start(envId, stackId) - POST /environments/{envId}/projects/{stackId}/up", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Started" }),
      } as Response);

      await client.stacks.start("env123", "stack1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/projects/stack1/up",
        expect.objectContaining({ method: "POST" })
      );
    });

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

      const dto = { name: "My Template", composeContent: "version: '3'" };
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

      const dto = { name: "Updated" };
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
    it(".version(current?) - GET /version", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { version: "1.2.3" } }),
      } as Response);

      await client.system.version();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/version",
        expect.objectContaining({ method: "GET" })
      );
    });
  });
});
