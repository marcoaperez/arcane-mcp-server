import { describe, it, expect, vi } from "vitest";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId, resolveStackId, resolveContainerId } from "../tools/resolve";

describe("resolve helpers", () => {
  describe("resolveEnvironmentId", () => {
    it("returns envId immediately if provided (no API call)", async () => {
      const mockClient = {
        environments: { list: vi.fn() },
      } as unknown as ArcaneClient;

      const result = await resolveEnvironmentId(mockClient, "env123", undefined);
      expect(result).toBe("env123");
      expect(mockClient.environments.list).not.toHaveBeenCalled();
    });

    it("calls client.environments.list() if only envName given, returns matched ID", async () => {
      const mockClient = {
        environments: {
          list: vi.fn().mockResolvedValue({
            success: true,
            data: [
              { id: "env123", name: "production" },
              { id: "env456", name: "staging" },
            ],
            pagination: { totalItems: 2, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
          }),
        },
      } as unknown as ArcaneClient;

      const result = await resolveEnvironmentId(mockClient, undefined, "production");
      expect(result).toBe("env123");
      // Ahora resuelve con collectAllPages: search sigue siendo filtrado en
      // servidor, pero start/limit/sort vienen del paginador, no de un limit:50 fijo.
      expect(mockClient.environments.list).toHaveBeenCalledWith({
        search: "production",
        start: 0,
        limit: 200,
        sort: "name",
      });
    });

    it("throws with list of available names if no match found", async () => {
      const mockClient = {
        environments: {
          list: vi.fn().mockResolvedValue({
            success: true,
            data: [
              { id: "env123", name: "production" },
              { id: "env456", name: "staging" },
            ],
            pagination: { totalItems: 2, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
          }),
        },
      } as unknown as ArcaneClient;

      await expect(resolveEnvironmentId(mockClient, undefined, "dev")).rejects.toThrow(
        "No environment found with name 'dev'. Available environments: production, staging"
      );
    });

    it("throws with instruction to use ID if multiple matches found", async () => {
      const mockClient = {
        environments: {
          list: vi.fn().mockResolvedValue({
            success: true,
            data: [
              { id: "env123", name: "app" },
              { id: "env456", name: "app" },
            ],
            pagination: { totalItems: 2, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
          }),
        },
      } as unknown as ArcaneClient;

      await expect(resolveEnvironmentId(mockClient, undefined, "app")).rejects.toThrow(
        "Multiple environments found with name 'app'. Please use the environment ID instead. Matching IDs: env123, env456"
      );
    });

    it("throws if neither envId nor envName provided", async () => {
      const mockClient = {} as unknown as ArcaneClient;

      await expect(resolveEnvironmentId(mockClient, undefined, undefined)).rejects.toThrow(
        "Either environmentId or environmentName must be provided"
      );
    });
  });

  describe("resolveStackId", () => {
    it("returns stackId immediately if provided (no API call)", async () => {
      const mockClient = {
        stacks: { list: vi.fn() },
      } as unknown as ArcaneClient;

      const result = await resolveStackId(mockClient, "env123", "stack456", undefined);
      expect(result).toBe("stack456");
      expect(mockClient.stacks.list).not.toHaveBeenCalled();
    });

    it("calls client.stacks.list() if only stackName given, returns matched ID", async () => {
      const mockClient = {
        stacks: {
          list: vi.fn().mockResolvedValue({
            success: true,
            data: [
              { id: "stack456", name: "myapp" },
              { id: "stack789", name: "db" },
            ],
            pagination: { totalItems: 2, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
          }),
        },
      } as unknown as ArcaneClient;

      const result = await resolveStackId(mockClient, "env123", undefined, "myapp");
      expect(result).toBe("stack456");
      expect(mockClient.stacks.list).toHaveBeenCalledWith("env123", {
        search: "myapp",
        start: 0,
        limit: 200,
        sort: "name",
      });
    });

    it("throws with list of available names if no match found", async () => {
      const mockClient = {
        stacks: {
          list: vi.fn().mockResolvedValue({
            success: true,
            data: [
              { id: "stack456", name: "myapp" },
              { id: "stack789", name: "db" },
            ],
            pagination: { totalItems: 2, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
          }),
        },
      } as unknown as ArcaneClient;

      await expect(resolveStackId(mockClient, "env123", undefined, "redis")).rejects.toThrow(
        "No stack found with name 'redis' in environment 'env123'. Available stacks: myapp, db"
      );
    });

    it("throws with instruction to use ID if multiple matches found", async () => {
      const mockClient = {
        stacks: {
          list: vi.fn().mockResolvedValue({
            success: true,
            data: [
              { id: "stack456", name: "web" },
              { id: "stack789", name: "web" },
            ],
            pagination: { totalItems: 2, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
          }),
        },
      } as unknown as ArcaneClient;

      await expect(resolveStackId(mockClient, "env123", undefined, "web")).rejects.toThrow(
        "Multiple stacks found with name 'web' in environment 'env123'. Please use the stack ID instead. Matching IDs: stack456, stack789"
      );
    });

    it("throws if neither stackId nor stackName provided", async () => {
      const mockClient = {} as unknown as ArcaneClient;

      await expect(resolveStackId(mockClient, "env123", undefined, undefined)).rejects.toThrow(
        "Either stackId or stackName must be provided"
      );
    });
  });

  describe("resolveContainerId", () => {
    it("returns containerId immediately if provided (no API call)", async () => {
      const mockClient = {
        containers: { list: vi.fn() },
      } as unknown as ArcaneClient;

      const result = await resolveContainerId(mockClient, "env123", "cont456", undefined);
      expect(result).toBe("cont456");
      expect(mockClient.containers.list).not.toHaveBeenCalled();
    });

    it("calls client.containers.list() if only containerName given, returns matched ID", async () => {
      const mockClient = {
        containers: {
          list: vi.fn().mockResolvedValue({
            success: true,
            data: [
              { id: "cont456", names: ["/myapp"], image: "nginx:latest", created: 123456, state: "running", status: "Up 5 minutes", ports: [], labels: {}, hostConfig: {}, networkSettings: {}, mounts: [] },
              { id: "cont789", names: ["/db"], image: "postgres:14", created: 123457, state: "running", status: "Up 10 minutes", ports: [], labels: {}, hostConfig: {}, networkSettings: {}, mounts: [] },
            ],
            pagination: { totalItems: 2, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
          }),
        },
      } as unknown as ArcaneClient;

      const result = await resolveContainerId(mockClient, "env123", undefined, "myapp");
      expect(result).toBe("cont456");
      // Sin `search`: la semantica de ese parametro no esta documentada para este
      // endpoint (ver resolveContainerId). Solo start/limit/sort del paginador.
      expect(mockClient.containers.list).toHaveBeenCalledWith("env123", { start: 0, limit: 200, sort: "name" });
    });

    it("throws with list of available names if no match found", async () => {
      const mockClient = {
        containers: {
          list: vi.fn().mockResolvedValue({
            success: true,
            data: [
              { id: "cont456", names: ["/myapp"], image: "nginx:latest", created: 123456, state: "running", status: "Up 5 minutes", ports: [], labels: {}, hostConfig: {}, networkSettings: {}, mounts: [] },
            ],
            pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
          }),
        },
      } as unknown as ArcaneClient;

      await expect(resolveContainerId(mockClient, "env123", undefined, "redis")).rejects.toThrow(
        "No container found with name 'redis' in environment 'env123'. Available containers: myapp"
      );
    });

    it("throws with instruction to use ID if multiple matches found", async () => {
      const mockClient = {
        containers: {
          list: vi.fn().mockResolvedValue({
            success: true,
            data: [
              { id: "cont456", names: ["/web"], image: "nginx:latest", created: 123456, state: "running", status: "Up 5 minutes", ports: [], labels: {}, hostConfig: {}, networkSettings: {}, mounts: [] },
              { id: "cont789", names: ["/web"], image: "nginx:latest", created: 123457, state: "running", status: "Up 3 minutes", ports: [], labels: {}, hostConfig: {}, networkSettings: {}, mounts: [] },
            ],
            pagination: { totalItems: 2, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
          }),
        },
      } as unknown as ArcaneClient;

      await expect(resolveContainerId(mockClient, "env123", undefined, "web")).rejects.toThrow(
        "Multiple containers found with name 'web' in environment 'env123'. Please use the container ID instead. Matching IDs: cont456, cont789"
      );
    });

    it("throws if neither containerId nor containerName provided", async () => {
      const mockClient = {} as unknown as ArcaneClient;

      await expect(resolveContainerId(mockClient, "env123", undefined, undefined)).rejects.toThrow(
        "Either containerId or containerName must be provided"
      );
    });
  });

  describe("resolvers y truncamiento", () => {
    /** Sirve `total` contenedores paginados, el buscado en la posicion `donde`. */
    const containersPaginados = (total: number, donde: number, nombre: string) =>
      vi.fn(async (envId: string, opts?: { start?: number; limit?: number }) => {
        const start = opts?.start ?? 0;
        const limit = opts?.limit ?? 20;
        const data = Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, i) => {
          const idx = start + i;
          return { id: `c${idx}`, names: [`/${idx === donde ? nombre : `relleno${idx}`}`] };
        });
        return {
          success: true,
          data,
          counts: { runningContainers: total, stoppedContainers: 0, totalContainers: total },
          pagination: {
            totalItems: total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            currentPage: Math.floor(start / limit) + 1,
            itemsPerPage: limit,
          },
        };
      });

    it("encuentra un contenedor que cae fuera de la primera pagina", async () => {
      const list = containersPaginados(500, 350, "buscado");
      const mockClient = { containers: { list } } as unknown as ArcaneClient;

      const id = await resolveContainerId(mockClient, "env1", undefined, "buscado");
      expect(id).toBe("c350");
      expect(list.mock.calls.length).toBeGreaterThan(1);
    });

    it("cuando agota el tope, el error dice que no ha mirado todo", async () => {
      const list = containersPaginados(5000, 4999, "buscado");
      const mockClient = { containers: { list } } as unknown as ArcaneClient;

      await expect(resolveContainerId(mockClient, "env1", undefined, "buscado")).rejects.toThrow(
        /among the first 2000 of 5000 containers/,
      );
    });

    it("cuando la busqueda fue completa, el error dice que no existe", async () => {
      const list = containersPaginados(30, -1, "buscado");
      const mockClient = { containers: { list } } as unknown as ArcaneClient;

      await expect(resolveContainerId(mockClient, "env1", undefined, "buscado")).rejects.toThrow(
        /No container found with name 'buscado'/,
      );
    });

    it("la lista de disponibles se capa y declara cuantos oculta", async () => {
      const list = containersPaginados(100, -1, "buscado");
      const mockClient = { containers: { list } } as unknown as ArcaneClient;

      await expect(resolveContainerId(mockClient, "env1", undefined, "buscado")).rejects.toThrow(/and 70 more/);
    });
  });
});
