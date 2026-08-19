import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ArcaneApiError } from "../arcane-client";
import type { ArcaneClient, ListOptions } from "../arcane-client";
import { registerEnvironmentTools } from "../tools/environments";
import { registerStackTools } from "../tools/stacks";
import { registerContainerTools } from "../tools/containers";
import { registerImageTools } from "../tools/images";
import { registerVolumeTools } from "../tools/volumes";
import { registerNetworkTools } from "../tools/networks";
import { registerTemplateTools } from "../tools/templates";
import { registerSystemTools } from "../tools/system";
import { registerVolumeFileTools } from "../tools/volume-files";
import { registerActivityTools } from "../tools/activities";
import { registerEventTools } from "../tools/events";
import { registerJobTools } from "../tools/jobs";
import { registerGitRepositoryTools } from "../tools/git-repositories";
import { registerGitOpsSyncTools } from "../tools/gitops-syncs";
import { registerVolumeBackupTools } from "../tools/volume-backups";
import { registerImageUpdateTools } from "../tools/image-updates";
import { registerUpdaterTools } from "../tools/updater";
import { registerVulnerabilityTools } from "../tools/vulnerabilities";
import { registerContainerRegistryTools } from "../tools/container-registries";

type MockedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): ReturnType<T>;
  mockResolvedValue: (value: ReturnType<T>) => MockedFunction<T>;
  mockRejectedValue: (error: any) => MockedFunction<T>;
};

describe("MCP Tools", () => {
  const createMockClient = () => {
    const mockClient = {
      environments: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
        }) as MockedFunction<(opts?: ListOptions) => any>,
        get: vi.fn().mockResolvedValue({
          success: true,
          data: { id: "env1", name: "production", apiUrl: "http://localhost", status: "connected", enabled: true, isEdge: false },
        }) as MockedFunction<(id: string) => any>,
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      stacks: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
        }) as MockedFunction<(envId: string, opts?: ListOptions) => any>,
        get: vi.fn().mockResolvedValue({
          success: true,
          data: { id: "stack1", name: "myapp", path: "/myapp", status: "running", serviceCount: 2, runningCount: 2, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
        }) as MockedFunction<(envId: string, stackId: string) => any>,
        deploy: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        start: vi.fn().mockResolvedValue({ success: true, message: "Started" }) as MockedFunction<(envId: string, stackId: string) => any>,
        stop: vi.fn(),
        restart: vi.fn(),
        pull: vi.fn(),
      },
      containers: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
        }) as MockedFunction<(envId: string) => any>,
        get: vi.fn(),
        start: vi.fn().mockResolvedValue({ success: true, message: "Started" }) as MockedFunction<(envId: string, containerId: string) => any>,
        stop: vi.fn(),
        restart: vi.fn(),
        kill: vi.fn(),
      },
      images: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
        }) as MockedFunction<(envId: string) => any>,
        pull: vi.fn(),
        remove: vi.fn(),
        prune: vi.fn(),
      },
      volumes: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
        }) as MockedFunction<(envId: string) => any>,
        inspect: vi.fn(),
        remove: vi.fn(),
        prune: vi.fn(),
      },
      networks: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
        }) as MockedFunction<(envId: string) => any>,
        inspect: vi.fn(),
        remove: vi.fn(),
        prune: vi.fn(),
      },
      templates: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
        }) as MockedFunction<(opts?: ListOptions) => any>,
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      activities: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
        }) as MockedFunction<(envId: string, opts?: ListOptions) => any>,
        get: vi.fn(),
        cancel: vi.fn(),
      },
      events: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
        }) as MockedFunction<(opts?: ListOptions) => any>,
        stats: vi.fn(),
      },
      system: {
        version: vi.fn().mockResolvedValue({
          success: true,
          data: { version: "1.2.3" },
        }) as MockedFunction<() => any>,
      },
      jobs: {
        list: vi.fn().mockResolvedValue({
          isAgent: false,
          jobs: [],
        }) as MockedFunction<(envId: string) => any>,
        run: vi.fn(),
        getSchedules: vi.fn(),
        updateSchedules: vi.fn(),
      },
      gitRepositories: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
        }) as MockedFunction<(opts?: ListOptions) => any>,
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        listBranches: vi.fn(),
        browseFiles: vi.fn(),
        test: vi.fn(),
      },
      gitOpsSyncs: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
        }) as MockedFunction<(envId: string, opts?: ListOptions) => any>,
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        browseFiles: vi.fn(),
        getStatus: vi.fn(),
        performSync: vi.fn(),
      },
      volumeBackups: {
        create: vi.fn(),
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
        }) as MockedFunction<(envId: string, volumeName: string, opts?: ListOptions) => any>,
        delete: vi.fn(),
        restore: vi.fn(),
      },
      vulnerabilities: {
        scannerStatus: vi.fn().mockResolvedValue({ success: true, data: { available: true, version: "0.73.0" } }),
        environmentSummary: vi.fn().mockResolvedValue({
          success: true,
          data: { totalImages: 19, scannedImages: 1, summary: { critical: 0, high: 6, medium: 21, low: 17, unknown: 0, total: 44 } },
        }),
        listAll: vi.fn().mockResolvedValue({
          success: true, data: [],
          pagination: { totalPages: 1, totalItems: 0, currentPage: 1, itemsPerPage: 20 },
        }),
        imageOptions: vi.fn().mockResolvedValue({ success: true, data: ["curlimages/curl:8.5.0"] }),
        scanResult: vi.fn().mockResolvedValue({
          success: true,
          data: { imageId: "sha256:abc", imageName: "curlimages/curl:8.5.0", scanTime: "t", status: "completed" },
        }),
        imageList: vi.fn().mockResolvedValue({
          success: true, data: [],
          pagination: { totalPages: 1, totalItems: 0, currentPage: 1, itemsPerPage: 20 },
        }),
        imageSummary: vi.fn().mockResolvedValue({
          success: true, data: { imageId: "sha256:abc", scanTime: "t", status: "completed" },
        }),
        imageSummaries: vi.fn().mockResolvedValue({ success: true, data: { summaries: {} } }),
        ignoredList: vi.fn().mockResolvedValue({
          success: true, data: [],
          pagination: { totalPages: 1, totalItems: 0, currentPage: 1, itemsPerPage: 20 },
        }),
        scan: vi.fn(),
        ignore: vi.fn(),
        unignore: vi.fn(),
      },
      containerRegistries: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
        }),
        get: vi.fn().mockResolvedValue({ success: true, data: { id: "r1", url: "reg.example" } }),
        pullUsage: vi.fn().mockResolvedValue({ success: true, data: { registries: null } }),
        test: vi.fn().mockResolvedValue({ success: true, data: { message: "Registry reachable" } }),
      },
    } as unknown as ArcaneClient;
    return mockClient;
  };

  const createMockServer = () => {
    const toolHandlers = new Map<string, any>();
    return {
      tool: vi.fn((name: string, description: string, schema: any, handler: any) => {
        toolHandlers.set(name, handler);
      }),
      getHandler: (name: string) => toolHandlers.get(name),
      toolHandlers,
    };
  };

  describe("environment tools", () => {
    it("registers arcane_environment_list tool", () => {
      const mockClient = createMockClient();
      const server = createMockServer();

      registerEnvironmentTools(server as any, mockClient);

      expect(server.tool).toHaveBeenCalledWith(
        "arcane_environment_list",
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
      expect(server.getHandler("arcane_environment_list")).toBeDefined();
    });

    it("arcane_environment_list calls client.environments.list with correct params", async () => {
      const mockClient = createMockClient();
      (mockClient.environments.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "env1", name: "production", apiUrl: "http://localhost", status: "connected", enabled: true, isEdge: false }],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
      });

      const server = createMockServer();
      registerEnvironmentTools(server as any, mockClient);

      const handler = server.getHandler("arcane_environment_list");
      const result = await handler({ search: "prod", limit: 10 });

      expect(mockClient.environments.list).toHaveBeenCalledWith({ search: "prod", limit: 10 });
      expect(result.content).toEqual([{ type: "text", text: expect.any(String) }]);
    });

    it("arcane_environment_get with environmentId calls client.environments.get", async () => {
      const mockClient = createMockClient();
      (mockClient.environments.get as any).mockResolvedValue({
        success: true,
        data: { id: "env1", name: "production", apiUrl: "http://localhost", status: "connected", enabled: true, isEdge: false },
      });

      const server = createMockServer();
      registerEnvironmentTools(server as any, mockClient);

      const handler = server.getHandler("arcane_environment_get");
      const result = await handler({ environmentId: "env1" });

      expect(mockClient.environments.get).toHaveBeenCalledWith("env1");
      expect(result.content).toEqual([{ type: "text", text: expect.any(String) }]);
    });

    it("arcane_environment_get with environmentName uses resolver", async () => {
      const mockClient = createMockClient();
      (mockClient.environments.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "env1", name: "production", apiUrl: "http://localhost", status: "connected", enabled: true, isEdge: false }],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
      });
      (mockClient.environments.get as any).mockResolvedValue({
        success: true,
        data: { id: "env1", name: "production", apiUrl: "http://localhost", status: "connected", enabled: true, isEdge: false },
      });

      const server = createMockServer();
      registerEnvironmentTools(server as any, mockClient);

      const handler = server.getHandler("arcane_environment_get");
      await handler({ environmentName: "production" });

      // resolveEnvironmentId ahora recorre la coleccion con collectAllPages
      // (Task 10): start/limit/sort vienen del paginador, no de un limit:50 fijo.
      expect(mockClient.environments.list).toHaveBeenCalledWith({
        search: "production",
        start: 0,
        limit: 200,
        sort: "name",
      });
      expect(mockClient.environments.get).toHaveBeenCalledWith("env1");
    });

    it("returns isError: true on ArcaneApiError", async () => {
      const mockClient = createMockClient();
      (mockClient.environments.list as any).mockRejectedValue(new ArcaneApiError(404, "Not found"));

      const server = createMockServer();
      registerEnvironmentTools(server as any, mockClient);

      const handler = server.getHandler("arcane_environment_list");
      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/^Error:/);
    });
  });

  describe("stack tools", () => {
    it("registers arcane_stack_list tool", () => {
      const mockClient = createMockClient();
      const server = createMockServer();

      registerStackTools(server as any, mockClient);

      expect(server.tool).toHaveBeenCalledWith(
        "arcane_stack_list",
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
      expect(server.getHandler("arcane_stack_list")).toBeDefined();
    });

    it("arcane_stack_list calls client.stacks.list with correct params", async () => {
      const mockClient = createMockClient();
      (mockClient.stacks.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "stack1", name: "myapp", path: "/myapp", status: "running", serviceCount: 2, runningCount: 2, createdAt: "2024-01-01", updatedAt: "2024-01-01" }],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
      });

      const server = createMockServer();
      registerStackTools(server as any, mockClient);

      const handler = server.getHandler("arcane_stack_list");
      const result = await handler({ environmentId: "env1", search: "myapp" });

      expect(mockClient.stacks.list).toHaveBeenCalledWith("env1", {
        search: "myapp", sort: undefined, order: undefined, start: undefined,
        limit: undefined, status: undefined, archived: undefined, tags: undefined,
      });
      expect(result.content).toEqual([{ type: "text", text: expect.any(String) }]);
    });

    it("arcane_stack_start returns human-readable message", async () => {
      const mockClient = createMockClient();
      (mockClient.stacks.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "stack1", name: "myapp", path: "/myapp", status: "running", serviceCount: 2, runningCount: 2, createdAt: "2024-01-01", updatedAt: "2024-01-01" }],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
      });
      (mockClient.stacks.start as any).mockResolvedValue({ success: true, message: "Started" });

      const server = createMockServer();
      registerStackTools(server as any, mockClient);

      const handler = server.getHandler("arcane_stack_start");
      const result = await handler({ environmentId: "env1", stackName: "myapp" });

      expect(result.content[0].text).toBe("Stack 'myapp' started successfully in environment 'env1'. Started");
    });
  });

  describe("container tools", () => {
    it("registers arcane_container_list tool", () => {
      const mockClient = createMockClient();
      const server = createMockServer();

      registerContainerTools(server as any, mockClient);

      expect(server.tool).toHaveBeenCalledWith(
        "arcane_container_list",
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
      expect(server.getHandler("arcane_container_list")).toBeDefined();
    });

    it("arcane_container_list calls client.containers.list", async () => {
      const mockClient = createMockClient();
      (mockClient.containers.list as any).mockResolvedValue({
        success: true,
        data: [],
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
      });

      const server = createMockServer();
      registerContainerTools(server as any, mockClient);

      const handler = server.getHandler("arcane_container_list");
      const result = await handler({ environmentId: "env1" });

      expect(mockClient.containers.list).toHaveBeenCalledWith("env1", {
        search: undefined, sort: undefined, order: undefined, start: undefined,
        limit: undefined, includeInternal: undefined, standalone: undefined,
      });
      expect(result.content).toEqual([{ type: "text", text: expect.any(String) }]);
    });

    it("arcane_container_start returns human-readable message", async () => {
      const mockClient = createMockClient();
      (mockClient.containers.list as any).mockResolvedValue({
        success: true,
        data: [
          {
            id: "cont1",
            names: ["/web"],
            image: "nginx:latest",
            created: 123456,
            state: "running",
            status: "Up 5 minutes",
            ports: [],
            labels: {},
            hostConfig: {},
            networkSettings: {},
            mounts: [],
          },
        ],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
      });
      (mockClient.containers.start as any).mockResolvedValue({ success: true, message: "Started" });

      const server = createMockServer();
      registerContainerTools(server as any, mockClient);

      const handler = server.getHandler("arcane_container_start");
      const result = await handler({ environmentId: "env1", containerName: "web" });

      expect(result.content[0].text).toBe("Container 'web' started successfully in environment 'env1'");
    });
  });

  describe("image tools", () => {
    it("registers arcane_image_list tool", () => {
      const mockClient = createMockClient();
      const server = createMockServer();

      registerImageTools(server as any, mockClient);

      expect(server.tool).toHaveBeenCalledWith("arcane_image_list", expect.any(String), expect.any(Object), expect.any(Function));
      expect(server.getHandler("arcane_image_list")).toBeDefined();
    });

    it("arcane_image_list calls client.images.list", async () => {
      const mockClient = createMockClient();
      (mockClient.images.list as any).mockResolvedValue({
        success: true,
        data: [],
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
      });

      const server = createMockServer();
      registerImageTools(server as any, mockClient);

      const handler = server.getHandler("arcane_image_list");
      const result = await handler({ environmentId: "env1" });

      expect(mockClient.images.list).toHaveBeenCalledWith("env1", {
        search: undefined, sort: undefined, order: undefined, start: undefined,
        limit: undefined, inUse: undefined,
      });
      expect(result.content).toEqual([{ type: "text", text: expect.any(String) }]);
    });
  });

  describe("volume tools", () => {
    it("registers arcane_volume_list tool", () => {
      const mockClient = createMockClient();
      const server = createMockServer();

      registerVolumeTools(server as any, mockClient);

      expect(server.tool).toHaveBeenCalledWith("arcane_volume_list", expect.any(String), expect.any(Object), expect.any(Function));
      expect(server.getHandler("arcane_volume_list")).toBeDefined();
    });

    it("arcane_volume_list calls client.volumes.list", async () => {
      const mockClient = createMockClient();
      (mockClient.volumes.list as any).mockResolvedValue({
        success: true,
        data: [],
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
      });

      const server = createMockServer();
      registerVolumeTools(server as any, mockClient);

      const handler = server.getHandler("arcane_volume_list");
      const result = await handler({ environmentId: "env1" });

      expect(mockClient.volumes.list).toHaveBeenCalledWith("env1", {
        search: undefined, sort: undefined, order: undefined, start: undefined,
        limit: undefined, inUse: undefined, includeInternal: undefined,
      });
      expect(result.content).toEqual([{ type: "text", text: expect.any(String) }]);
    });
  });

  describe("volume file tools (API workspace de 2.8.0)", () => {
    const clienteConWorkspace = () => {
      const mockClient = createMockClient() as any;
      mockClient.volumeFiles = {
        getWorkspace: vi.fn().mockResolvedValue({
          success: true,
          data: { files: [], fileTreeRevision: "rev-abc", fileTreeTruncated: false },
        }),
        uploadFile: vi.fn().mockResolvedValue({ success: true, message: "Workspace updated" }),
      };
      return mockClient;
    };

    it("arcane_volume_browse llama a client.volumeFiles.getWorkspace", async () => {
      const mockClient = clienteConWorkspace();
      const server = createMockServer();
      registerVolumeFileTools(server as any, mockClient);

      const handler = server.getHandler("arcane_volume_browse");
      const result = await handler({ environmentId: "env1", volumeName: "data-vol" });

      expect(mockClient.volumeFiles.getWorkspace).toHaveBeenCalledWith("env1", "data-vol");
      expect(result.isError).toBeUndefined();
    });

    it("arcane_volume_browse avisa en prosa cuando el arbol viene recortado", async () => {
      const mockClient = clienteConWorkspace();
      mockClient.volumeFiles.getWorkspace.mockResolvedValue({
        success: true,
        data: {
          files: [{ path: "a.txt", size: 1 }],
          fileTreeRevision: "rev-abc",
          fileTreeTruncated: true,
        },
      });
      const server = createMockServer();
      registerVolumeFileTools(server as any, mockClient);

      const handler = server.getHandler("arcane_volume_browse");
      const result = await handler({ environmentId: "env1", volumeName: "data-vol" });

      const [primera] = result.content[0].text.split("\n");
      expect(primera).toBe(
        "This file tree is TRUNCATED: it does not list every file in the volume. Do not conclude a file is absent from what is missing here.",
      );
      // El cuerpo estructurado se conserva intacto detras del aviso.
      expect(JSON.parse(result.content[0].text.split("\n").slice(1).join("\n")).fileTreeTruncated).toBe(true);
    });

    it("arcane_volume_browse no antepone nada cuando el arbol esta completo", async () => {
      const mockClient = clienteConWorkspace();
      mockClient.volumeFiles.getWorkspace.mockResolvedValue({
        success: true,
        data: { files: [{ path: "a.txt", size: 1 }], fileTreeRevision: "rev-abc", fileTreeTruncated: false },
      });
      const server = createMockServer();
      registerVolumeFileTools(server as any, mockClient);

      const handler = server.getHandler("arcane_volume_browse");
      const result = await handler({ environmentId: "env1", volumeName: "data-vol" });

      expect(result.content[0].text.startsWith("{")).toBe(true);
      expect(result.content[0].text).not.toContain("TRUNCATED");
    });

    it("arcane_volume_browse trata files:null como lista vacia, nunca el texto 'null'", async () => {
      const mockClient = clienteConWorkspace();
      mockClient.volumeFiles.getWorkspace.mockResolvedValue({
        success: true,
        data: { files: null, fileTreeRevision: "rev-abc", fileTreeTruncated: false },
      });
      const server = createMockServer();
      registerVolumeFileTools(server as any, mockClient);

      const handler = server.getHandler("arcane_volume_browse");
      const result = await handler({ environmentId: "env1", volumeName: "data-vol" });

      expect(JSON.parse(result.content[0].text).files).toEqual([]);
    });

    it("arcane_volume_upload_file compone relativePath a partir de path y filename", async () => {
      const mockClient = clienteConWorkspace();
      const server = createMockServer();
      registerVolumeFileTools(server as any, mockClient);

      const handler = server.getHandler("arcane_volume_upload_file");
      await handler({
        environmentId: "env1",
        volumeName: "data-vol",
        filename: "hola.txt",
        content: "hola mundo",
        path: "notas",
      });

      expect(mockClient.volumeFiles.uploadFile).toHaveBeenCalledWith(
        "env1",
        "data-vol",
        "notas/hola.txt",
        "hola mundo"
      );
    });

    it("arcane_volume_upload_file sin path escribe en la raíz", async () => {
      const mockClient = clienteConWorkspace();
      const server = createMockServer();
      registerVolumeFileTools(server as any, mockClient);

      const handler = server.getHandler("arcane_volume_upload_file");
      await handler({
        environmentId: "env1",
        volumeName: "data-vol",
        filename: "hola.txt",
        content: "hola mundo",
      });

      expect(mockClient.volumeFiles.uploadFile).toHaveBeenCalledWith(
        "env1",
        "data-vol",
        "hola.txt",
        "hola mundo"
      );
    });

    it("arcane_volume_upload_file devuelve isError cuando la API responde success:false", async () => {
      const mockClient = clienteConWorkspace();
      mockClient.volumeFiles.uploadFile.mockResolvedValue({ success: false, message: "revision conflict" });
      const server = createMockServer();
      registerVolumeFileTools(server as any, mockClient);

      const handler = server.getHandler("arcane_volume_upload_file");
      const result = await handler({
        environmentId: "env1",
        volumeName: "data-vol",
        filename: "hola.txt",
        content: "hola mundo",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("revision conflict");
    });
  });

  describe("activity tools", () => {
    const clienteConActivities = () => {
      const mockClient = createMockClient() as any;
      mockClient.activities = {
        list: vi.fn().mockResolvedValue({ success: true, data: [], pagination: { totalItems: 0 } }),
        get: vi.fn().mockResolvedValue({
          success: true,
          data: { activity: { id: "act1", status: "failed" }, messages: [] },
        }),
        cancel: vi.fn().mockResolvedValue({
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
      };
      return mockClient;
    };

    it("arcane_activity_list pasa los filtros al cliente", async () => {
      const mockClient = clienteConActivities();
      const server = createMockServer();
      registerActivityTools(server as any, mockClient);

      const handler = server.getHandler("arcane_activity_list");
      await handler({ environmentId: "env1", status: "failed", limit: 10 });

      expect(mockClient.activities.list).toHaveBeenCalledWith("env1", {
        search: undefined,
        status: "failed",
        type: undefined,
        resourceType: undefined,
        limit: 10,
      });
    });

    it("arcane_activity_get resuelve un activityId", async () => {
      const mockClient = clienteConActivities();
      const server = createMockServer();
      registerActivityTools(server as any, mockClient);

      const handler = server.getHandler("arcane_activity_get");
      const result = await handler({ environmentId: "env1", activityId: "act1" });

      expect(mockClient.activities.get).toHaveBeenCalledWith("env1", "act1", undefined);
      expect(result.isError).toBeUndefined();
    });

    it("arcane_activity_get pasa limit al cliente para no truncar el log en el default de 500 del servidor", async () => {
      const mockClient = clienteConActivities();
      const server = createMockServer();
      registerActivityTools(server as any, mockClient);

      const handler = server.getHandler("arcane_activity_get");
      await handler({ environmentId: "env1", activityId: "act1", limit: 2000 });

      expect(mockClient.activities.get).toHaveBeenCalledWith("env1", "act1", 2000);
    });

    it("arcane_activity_cancel devuelve isError con success:false", async () => {
      // Rama defensiva: el spec declara `success` en BaseApiResponseActivityActivity, pero
      // los e2e contra la instancia real (2026-08-16) demuestran que la API nunca produce
      // esta rama — un cancel invalido rechaza con HTTP 409, que ya cae en el catch de mas
      // abajo. Se mantiene el chequeo y este test porque el contrato del spec lo permite,
      // aunque en la practica no se haya observado.
      const mockClient = clienteConActivities();
      mockClient.activities.cancel.mockResolvedValue({
        success: false,
        data: {
          id: "act1",
          status: "success",
          error: "already finished",
          type: "deploy",
          environmentId: "env1",
          startedAt: "2026-08-16T10:00:00Z",
          createdAt: "2026-08-16T10:00:00Z",
        },
      });
      const server = createMockServer();
      registerActivityTools(server as any, mockClient);

      const handler = server.getHandler("arcane_activity_cancel");
      const result = await handler({ environmentId: "env1", activityId: "act1" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("already finished");
    });

    it("arcane_activity_cancel refleja el estado real de la activity al tener exito", async () => {
      const mockClient = clienteConActivities();
      const server = createMockServer();
      registerActivityTools(server as any, mockClient);

      const handler = server.getHandler("arcane_activity_cancel");
      const result = await handler({ environmentId: "env1", activityId: "act1" });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("cancelled");
    });
  });

  describe("event tools", () => {
    const clienteConEvents = () => {
      const mockClient = createMockClient() as any;
      mockClient.events = {
        list: vi.fn().mockResolvedValue({ success: true, data: [], pagination: { totalItems: 0 } }),
        stats: vi.fn().mockResolvedValue({
          success: true,
          data: { total: 3, info: 1, success: 1, warning: 0, error: 1 },
        }),
      };
      return mockClient;
    };

    it("arcane_event_list pasa environmentId como filtro, sin resolverlo", async () => {
      const mockClient = clienteConEvents();
      const server = createMockServer();
      registerEventTools(server as any, mockClient);

      const handler = server.getHandler("arcane_event_list");
      await handler({ environmentId: "env1", severity: "error" });

      expect(mockClient.events.list).toHaveBeenCalledWith({
        environmentId: "env1",
        severity: "error",
        type: undefined,
        search: undefined,
        limit: undefined,
      });
    });

    it("arcane_event_list sin environmentId consulta la ruta global, con environmentId: undefined", async () => {
      const mockClient = clienteConEvents();
      const server = createMockServer();
      registerEventTools(server as any, mockClient);

      const handler = server.getHandler("arcane_event_list");
      await handler({ severity: "error" });

      expect(mockClient.events.list).toHaveBeenCalledWith({
        environmentId: undefined,
        severity: "error",
        type: undefined,
        search: undefined,
        limit: undefined,
      });
    });

    it("arcane_event_stats devuelve los recuentos", async () => {
      const mockClient = clienteConEvents();
      const server = createMockServer();
      registerEventTools(server as any, mockClient);

      const handler = server.getHandler("arcane_event_stats");
      const result = await handler({});

      expect(mockClient.events.stats).toHaveBeenCalled();
      expect(result.content[0].text).toContain("3");
    });
  });

  describe("job tools", () => {
    const clienteConJobs = () => {
      const mockClient = createMockClient() as any;
      mockClient.jobs = {
        list: vi.fn().mockResolvedValue({
          isAgent: false,
          jobs: [{ id: "auto-heal", name: "Auto Heal", canRunManually: true }],
        }),
        run: vi.fn().mockResolvedValue({ success: true, message: "Job started" }),
        getSchedules: vi.fn().mockResolvedValue({ autoHealInterval: "30s" }),
        // El spec declara BaseApiResponseJobscheduleConfig: {success, data: JobSchedulesConfig}.
        // No hay campo `message`; el mock refleja la forma real de la API.
        updateSchedules: vi.fn().mockResolvedValue({
          success: true,
          data: { autoHealInterval: "45s", autoUpdateInterval: "24h" },
        }),
      };
      return mockClient;
    };

    it("arcane_job_list serializa el contenido de {jobs}, no el sobre", async () => {
      const mockClient = clienteConJobs();
      const server = createMockServer();
      registerJobTools(server as any, mockClient);

      const handler = server.getHandler("arcane_job_list");
      const result = await handler({ environmentId: "env1" });

      expect(mockClient.jobs.list).toHaveBeenCalledWith("env1");
      expect(result.content[0].text).toContain("auto-heal");
    });

    it("arcane_job_run devuelve isError con success:false", async () => {
      const mockClient = clienteConJobs();
      mockClient.jobs.run.mockResolvedValue({ success: false, message: "prerequisites not met" });
      const server = createMockServer();
      registerJobTools(server as any, mockClient);

      const handler = server.getHandler("arcane_job_run");
      const result = await handler({ environmentId: "env1", jobId: "analytics-heartbeat" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("prerequisites not met");
    });

    it("arcane_job_schedules_update devuelve isError con success:false", async () => {
      const mockClient = clienteConJobs();
      mockClient.jobs.updateSchedules.mockResolvedValue({ success: false });
      const server = createMockServer();
      registerJobTools(server as any, mockClient);

      const handler = server.getHandler("arcane_job_schedules_update");
      const result = await handler({ environmentId: "env1", autoHealInterval: "45s" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Job schedules update failed");
    });

    it("arcane_job_schedules_update envia solo los intervalos indicados y devuelve la config aplicada", async () => {
      const mockClient = clienteConJobs();
      const server = createMockServer();
      registerJobTools(server as any, mockClient);

      const handler = server.getHandler("arcane_job_schedules_update");
      const result = await handler({ environmentId: "env1", autoHealInterval: "45s" });

      expect(mockClient.jobs.updateSchedules).toHaveBeenCalledWith("env1", { autoHealInterval: "45s" });
      // La tool devuelve la configuracion aplicada que responde el servidor, no un texto fijo.
      expect(result.content[0].text).toContain("45s");
    });

    it("arcane_job_schedules_get devuelve la configuracion", async () => {
      const mockClient = clienteConJobs();
      const server = createMockServer();
      registerJobTools(server as any, mockClient);

      const handler = server.getHandler("arcane_job_schedules_get");
      const result = await handler({ environmentId: "env1" });

      expect(mockClient.jobs.getSchedules).toHaveBeenCalledWith("env1");
      expect(result.content[0].text).toContain("30s");
    });
  });

  describe("network tools", () => {
    it("registers arcane_network_list tool", () => {
      const mockClient = createMockClient();
      const server = createMockServer();

      registerNetworkTools(server as any, mockClient);

      expect(server.tool).toHaveBeenCalledWith("arcane_network_list", expect.any(String), expect.any(Object), expect.any(Function));
      expect(server.getHandler("arcane_network_list")).toBeDefined();
    });

    it("arcane_network_list calls client.networks.list", async () => {
      const mockClient = createMockClient();
      (mockClient.networks.list as any).mockResolvedValue({
        success: true,
        data: [],
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
      });

      const server = createMockServer();
      registerNetworkTools(server as any, mockClient);

      const handler = server.getHandler("arcane_network_list");
      const result = await handler({ environmentId: "env1" });

      expect(mockClient.networks.list).toHaveBeenCalledWith("env1", {
        search: undefined, sort: undefined, order: undefined, start: undefined,
        limit: undefined, inUse: undefined,
      });
      expect(result.content).toEqual([{ type: "text", text: expect.any(String) }]);
    });
  });

  describe("Superficie de listado — containers, images, volumes, networks", () => {
    it("arcane_volume_list pasa los parametros de paginacion al cliente", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerVolumeTools(server as any, mockClient);

      (mockClient.volumes.list as any).mockResolvedValue({
        success: true,
        data: [],
        counts: { inuse: 0, unused: 0, total: 0 },
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_volume_list");
      await handler({ environmentId: "env1", search: "data", sort: "name", order: "asc", start: 20, limit: 50, inUse: "true" });

      expect(mockClient.volumes.list).toHaveBeenCalledWith("env1", {
        search: "data", sort: "name", order: "asc", start: 20, limit: 50,
        inUse: "true", includeInternal: undefined,
      });
    });

    it("arcane_volume_list avisa en prosa cuando la lista viene truncada", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerVolumeTools(server as any, mockClient);

      (mockClient.volumes.list as any).mockResolvedValue({
        success: true,
        data: Array.from({ length: 20 }, (_, i) => ({ name: `vol${i}` })),
        counts: { inuse: 8, unused: 24, total: 32 },
        pagination: { totalItems: 32, totalPages: 2, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_volume_list");
      const result = await handler({ environmentId: "env1" });

      const [primera] = result.content[0].text.split("\n");
      expect(primera).toBe("Showing 20 of 32 volumes (page 1 of 2). Pass start=20 to see the rest.");
      expect(result.isError).toBeUndefined();
    });

    it("arcane_volume_list incluye counts y pagination en el cuerpo", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerVolumeTools(server as any, mockClient);

      (mockClient.volumes.list as any).mockResolvedValue({
        success: true,
        data: [{ name: "vol1" }],
        counts: { inuse: 1, unused: 0, total: 1 },
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_volume_list");
      const result = await handler({ environmentId: "env1" });
      const body = JSON.parse(result.content[0].text);

      expect(body.counts).toEqual({ inuse: 1, unused: 0, total: 1 });
      expect(body.pagination.totalItems).toBe(1);
      expect(body.data).toEqual([{ name: "vol1" }]);
    });

    it("arcane_container_list sigue devolviendo isError cuando el cliente falla", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerContainerTools(server as any, mockClient);

      (mockClient.containers.list as any).mockRejectedValue(new ArcaneApiError(500, "boom"));

      const handler = server.getHandler("arcane_container_list");
      const result = await handler({ environmentId: "env1" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("boom");
    });

    it("arcane_container_list pasa sort, order y start con valores reales", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerContainerTools(server as any, mockClient);

      (mockClient.containers.list as any).mockResolvedValue({
        success: true,
        data: [],
        counts: { runningContainers: 0, stoppedContainers: 0, totalContainers: 0 },
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_container_list");
      await handler({ environmentId: "env1", search: "web", sort: "name", order: "desc", start: 40, limit: 25 });

      expect(mockClient.containers.list).toHaveBeenCalledWith("env1", {
        search: "web", sort: "name", order: "desc", start: 40, limit: 25,
        includeInternal: undefined, standalone: undefined,
      });
    });

    it("arcane_container_list incluye pagination y counts en el cuerpo, no el array pelado", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerContainerTools(server as any, mockClient);

      (mockClient.containers.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "c1" }],
        counts: { runningContainers: 1, stoppedContainers: 0, totalContainers: 1 },
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_container_list");
      const result = await handler({ environmentId: "env1" });
      const body = JSON.parse(result.content[0].text);

      expect(body.pagination.totalItems).toBe(1);
      expect(body.counts).toEqual({ runningContainers: 1, stoppedContainers: 0, totalContainers: 1 });
      expect(body.data).toEqual([{ id: "c1" }]);
    });

    it("arcane_image_list pasa inUse y los cinco comunes", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerImageTools(server as any, mockClient);

      (mockClient.images.list as any).mockResolvedValue({
        success: true,
        data: [],
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_image_list");
      await handler({ environmentId: "env1", search: "nginx", sort: "size", order: "desc", start: 30, limit: 10, inUse: "false" });

      expect(mockClient.images.list).toHaveBeenCalledWith("env1", {
        search: "nginx", sort: "size", order: "desc", start: 30, limit: 10, inUse: "false",
      });
    });

    it("arcane_image_list incluye pagination en el cuerpo, no el array pelado", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerImageTools(server as any, mockClient);

      (mockClient.images.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "img1" }],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_image_list");
      const result = await handler({ environmentId: "env1" });
      const body = JSON.parse(result.content[0].text);

      expect(body.pagination.totalItems).toBe(1);
      expect(body.data).toEqual([{ id: "img1" }]);
    });

    it("arcane_network_list pasa inUse y los cinco comunes", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerNetworkTools(server as any, mockClient);

      (mockClient.networks.list as any).mockResolvedValue({
        success: true,
        data: [],
        counts: { inuse: 0, unused: 0, total: 0 },
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_network_list");
      await handler({ environmentId: "env1", search: "bridge", sort: "driver", order: "asc", start: 15, limit: 8, inUse: "true" });

      expect(mockClient.networks.list).toHaveBeenCalledWith("env1", {
        search: "bridge", sort: "driver", order: "asc", start: 15, limit: 8, inUse: "true",
      });
    });

    it("arcane_network_list incluye pagination y counts en el cuerpo, no el array pelado", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerNetworkTools(server as any, mockClient);

      (mockClient.networks.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "net1" }],
        counts: { inuse: 1, unused: 0, total: 1 },
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_network_list");
      const result = await handler({ environmentId: "env1" });
      const body = JSON.parse(result.content[0].text);

      expect(body.pagination.totalItems).toBe(1);
      expect(body.counts).toEqual({ inuse: 1, unused: 0, total: 1 });
      expect(body.data).toEqual([{ id: "net1" }]);
    });
  });

  describe("template tools", () => {
    it("registers arcane_template_list tool", () => {
      const mockClient = createMockClient();
      const server = createMockServer();

      registerTemplateTools(server as any, mockClient);

      expect(server.tool).toHaveBeenCalledWith("arcane_template_list", expect.any(String), expect.any(Object), expect.any(Function));
      expect(server.getHandler("arcane_template_list")).toBeDefined();
    });

    it("arcane_template_list calls client.templates.list", async () => {
      const mockClient = createMockClient();
      (mockClient.templates.list as any).mockResolvedValue({
        success: true,
        data: [],
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
      });

      const server = createMockServer();
      registerTemplateTools(server as any, mockClient);

      const handler = server.getHandler("arcane_template_list");
      const result = await handler({ search: "wordpress" });

      expect(mockClient.templates.list).toHaveBeenCalledWith({
        search: "wordpress", sort: undefined, order: undefined, start: undefined, limit: undefined, type: undefined,
      });
      expect(result.content).toEqual([{ type: "text", text: expect.any(String) }]);
    });

    it("arcane_template_create envía content (no composeContent) y exige description/envContent, sin category ni tags", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();

      registerTemplateTools(server as any, mockClient);

      const call = (server.tool as any).mock.calls.find((c: any[]) => c[0] === "arcane_template_create");
      const schemaShape = call[2];

      // v2.7.0 exige name, description, content y envContent, todos obligatorios.
      const schema = z.object(schemaShape);
      const parsed = schema.parse({
        name: "wordpress",
        description: "WordPress stack",
        content: "version: '3'\nservices:\n  wordpress:\n    image: wordpress",
        envContent: "WORDPRESS_DB_HOST=db",
      });
      expect(parsed).toMatchObject({ content: expect.any(String) });

      // composeContent, category y tags no existen en TemplateCreateRequest v2.7.0.
      expect(schemaShape.composeContent).toBeUndefined();
      expect(schemaShape.category).toBeUndefined();
      expect(schemaShape.tags).toBeUndefined();

      (mockClient.templates.create as any).mockResolvedValue({
        success: true,
        data: { id: "t1", name: "wordpress", description: "WordPress stack", content: "...", isCustom: true, isRemote: false },
      });

      const handler = server.getHandler("arcane_template_create");
      await handler(parsed);

      const sentDto = (mockClient.templates.create as any).mock.calls[0][0];
      expect(sentDto).toHaveProperty("content");
      expect(sentDto).not.toHaveProperty("composeContent");
    });

    it("arcane_template_update envía content (no composeContent) y exige name/description/content/envContent, sin category ni tags", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();

      registerTemplateTools(server as any, mockClient);

      const call = (server.tool as any).mock.calls.find((c: any[]) => c[0] === "arcane_template_update");
      const schemaShape = call[2];

      // v2.7.0 exige name, description, content y envContent, todos obligatorios:
      // PUT /templates/{id} reemplaza el template completo, no lo parchea.
      const schema = z.object(schemaShape);
      const validArgs = {
        templateId: "t1",
        name: "wordpress",
        description: "WordPress stack",
        content: "version: '3'\nservices:\n  wordpress:\n    image: wordpress",
        envContent: "WORDPRESS_DB_HOST=db",
      };
      const parsed = schema.parse(validArgs);
      expect(parsed).toMatchObject({ content: expect.any(String) });

      // content, description y envContent son obligatorios: omitir cualquiera debe romper el parse.
      const { content, ...withoutContent } = validArgs;
      expect(() => schema.parse(withoutContent)).toThrow();
      const { description, ...withoutDescription } = validArgs;
      expect(() => schema.parse(withoutDescription)).toThrow();
      const { envContent, ...withoutEnvContent } = validArgs;
      expect(() => schema.parse(withoutEnvContent)).toThrow();

      // composeContent, category y tags no existen en TemplateUpdateRequest v2.7.0.
      expect(schemaShape.composeContent).toBeUndefined();
      expect(schemaShape.category).toBeUndefined();
      expect(schemaShape.tags).toBeUndefined();

      (mockClient.templates.update as any).mockResolvedValue({
        success: true,
        data: { id: "t1", name: "wordpress", description: "WordPress stack", content: "...", isCustom: true, isRemote: false },
      });

      const handler = server.getHandler("arcane_template_update");
      await handler(parsed);

      const sentDto = (mockClient.templates.update as any).mock.calls[0][1];
      expect(sentDto).toHaveProperty("content");
      expect(sentDto).not.toHaveProperty("composeContent");
    });
  });

  describe("system tools", () => {
    it("registers arcane_version tool", () => {
      const mockClient = createMockClient();
      const server = createMockServer();

      registerSystemTools(server as any, mockClient);

      expect(server.tool).toHaveBeenCalledWith("arcane_version", expect.any(String), expect.any(Object), expect.any(Function));
      expect(server.getHandler("arcane_version")).toBeDefined();
    });

    it("arcane_version calls client.system.version", async () => {
      const mockClient = createMockClient();
      (mockClient.system.version as any).mockResolvedValue({
        success: true,
        data: { version: "1.2.3" },
      });

      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_version");
      const result = await handler({});

      expect(mockClient.system.version).toHaveBeenCalled();
      expect(result.content).toEqual([{ type: "text", text: expect.any(String) }]);
    });
  });

  describe("system tools (F2)", () => {
    const clienteConSystem = () => {
      const mockClient = createMockClient() as any;
      mockClient.system = {
        version: vi.fn(),
        dockerInfo: vi.fn().mockResolvedValue({ success: true, ServerVersion: "29.2.1", Containers: 16 }),
        health: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
        prune: vi.fn().mockResolvedValue({ success: true, data: { success: true, spaceReclaimed: 1024 } }),
        convert: vi.fn().mockResolvedValue({
          success: true,
          dockerCompose: "services:\n  nginx:",
          envVars: "",
          serviceName: "nginx",
        }),
      };
      return mockClient;
    };

    it("arcane_system_health traduce el estado a un mensaje legible", async () => {
      const mockClient = clienteConSystem();
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_health");
      const result = await handler({ environmentId: "env1" });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("healthy");
    });

    it("arcane_system_health marca isError cuando el estado no es 2xx", async () => {
      const mockClient = clienteConSystem();
      mockClient.system.health.mockResolvedValue({ ok: false, status: 503 });
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_health");
      const result = await handler({ environmentId: "env1" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("503");
    });

    it("arcane_system_health distingue el 500 conocido de Arcane 2.8.0 de un fallo real de Docker", async () => {
      // Contra Arcane 2.8.0 este endpoint devuelve 500 SIEMPRE (SystemHealthOutput.Status
      // nunca se rellena en el handler), incluso con Docker perfectamente sano. Traducirlo
      // sin mas a "System is not healthy" lleva al modelo a intentar remediar un Docker que
      // no esta roto. El mensaje debe dejar claro que es un fallo conocido del endpoint, no
      // un veredicto sobre Docker, y apuntar a arcane_system_docker_info para comprobarlo.
      const mockClient = clienteConSystem();
      mockClient.system.health.mockResolvedValue({ ok: false, status: 500 });
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_health");
      const result = await handler({ environmentId: "env1" });

      expect(result.content[0].text).not.toContain("not healthy");
      expect(result.content[0].text.toLowerCase()).toContain("known");
      expect(result.content[0].text).toContain("2.8.0");
      expect(result.content[0].text).toContain("arcane_system_docker_info");
    });

    it("arcane_system_prune solo envia los recursos indicados", async () => {
      const mockClient = clienteConSystem();
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_prune");
      await handler({ environmentId: "env1", buildCache: "dangling" });

      expect(mockClient.system.prune).toHaveBeenCalledWith("env1", { buildCache: { mode: "dangling" } });
    });

    it("arcane_system_prune sin ningun recurso devuelve isError en vez de podar todo", async () => {
      const mockClient = clienteConSystem();
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_prune");
      const result = await handler({ environmentId: "env1" });

      expect(result.isError).toBe(true);
      expect(mockClient.system.prune).not.toHaveBeenCalled();
    });

    it("arcane_system_prune propaga success:false del host como isError", async () => {
      const mockClient = clienteConSystem();
      mockClient.system.prune.mockResolvedValue({
        success: false,
        data: { success: false, spaceReclaimed: 0, errors: ["permission denied"] },
      });
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_prune");
      const result = await handler({ environmentId: "env1", buildCache: "dangling" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("permission denied");
    });

    it("arcane_system_convert devuelve el compose", async () => {
      const mockClient = clienteConSystem();
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_convert");
      const result = await handler({ environmentId: "env1", dockerRunCommand: "docker run -d nginx" });

      expect(result.content[0].text).toContain("services:");
    });

    it("arcane_system_docker_info devuelve la informacion del demonio", async () => {
      const mockClient = clienteConSystem();
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_docker_info");
      const result = await handler({ environmentId: "env1" });

      expect(result.content[0].text).toContain("29.2.1");
    });

    it("arcane_system_docker_info sin full devuelve el resumen, no el objeto completo", async () => {
      const mockClient = clienteConSystem();
      mockClient.system.dockerInfo.mockResolvedValue({
        success: true,
        ServerVersion: "29.2.1",
        Containers: 16,
        Images: 8,
        Plugins: { Volume: ["local"], Network: ["bridge", "host"] },
        Swarm: { NodeID: "", LocalNodeState: "inactive" },
        RegistryConfig: { IndexConfigs: {} },
      });
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_docker_info");
      const result = await handler({ environmentId: "env1" });

      expect(result.content[0].text).toContain("29.2.1");
      expect(result.content[0].text).toContain("16");
      expect(result.content[0].text).toContain('"images": 8');
      expect(result.content[0].text).not.toContain("Plugins");
      expect(result.content[0].text).not.toContain("Swarm");
      expect(result.content[0].text).not.toContain("RegistryConfig");
    });

    it("arcane_system_docker_info con full:true devuelve el objeto completo", async () => {
      const mockClient = clienteConSystem();
      mockClient.system.dockerInfo.mockResolvedValue({
        success: true,
        ServerVersion: "29.2.1",
        Containers: 16,
        Images: 8,
        Plugins: { Volume: ["local"], Network: ["bridge", "host"] },
        Swarm: { NodeID: "", LocalNodeState: "inactive" },
        RegistryConfig: { IndexConfigs: {} },
      });
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_docker_info");
      const result = await handler({ environmentId: "env1", full: true });

      expect(result.content[0].text).toContain("29.2.1");
      expect(result.content[0].text).toContain("Plugins");
      expect(result.content[0].text).toContain("Swarm");
      expect(result.content[0].text).toContain("RegistryConfig");
    });
  });

  describe("Superficie de listado — stacks, templates, environments, activities, events", () => {
    it("arcane_stack_list pasa limit al cliente y ya no lo pierde", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerStackTools(server as any, mockClient);

      const handler = server.getHandler("arcane_stack_list");
      await handler({ environmentId: "env1", search: "app", limit: 50, status: "running" });

      expect(mockClient.stacks.list).toHaveBeenCalledWith("env1", {
        search: "app", sort: undefined, order: undefined, start: undefined,
        limit: 50, status: "running", archived: undefined, tags: undefined,
      });
    });

    it("arcane_stack_list ya no impone un limit por defecto propio", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerStackTools(server as any, mockClient);

      const handler = server.getHandler("arcane_stack_list");
      await handler({ environmentId: "env1" });

      expect(mockClient.stacks.list).toHaveBeenCalledWith("env1", expect.objectContaining({ limit: undefined }));
    });

    it("arcane_activity_list pasa sort, order y start", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerActivityTools(server as any, mockClient);

      (mockClient.activities.list as any).mockResolvedValue({
        success: true,
        data: [],
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
      });

      const handler = server.getHandler("arcane_activity_list");
      await handler({ environmentId: "env1", sort: "createdAt", order: "desc", start: 50, status: "failed" });

      expect(mockClient.activities.list).toHaveBeenCalledWith("env1", {
        search: undefined, sort: "createdAt", order: "desc", start: 50, limit: undefined,
        status: "failed", type: undefined, resourceType: undefined,
      });
    });

    it("arcane_activity_list incluye pagination en el cuerpo, no el array pelado", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerActivityTools(server as any, mockClient);

      (mockClient.activities.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "act1" }],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_activity_list");
      const result = await handler({ environmentId: "env1" });
      const body = JSON.parse(result.content[0].text);

      expect(body.pagination.totalItems).toBe(1);
      expect(body.data).toEqual([{ id: "act1" }]);
    });

    it("arcane_event_list pasa sort, order y start", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerEventTools(server as any, mockClient);

      (mockClient.events.list as any).mockResolvedValue({
        success: true,
        data: [],
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_event_list");
      await handler({ sort: "timestamp", order: "desc", start: 20, severity: "error" });

      expect(mockClient.events.list).toHaveBeenCalledWith({
        environmentId: undefined, search: undefined, sort: "timestamp", order: "desc",
        start: 20, limit: undefined, severity: "error", type: undefined,
      });
    });

    it("arcane_event_list incluye pagination en el cuerpo, no el array pelado", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerEventTools(server as any, mockClient);

      (mockClient.events.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "ev1" }],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_event_list");
      const result = await handler({});
      const body = JSON.parse(result.content[0].text);

      expect(body.pagination.totalItems).toBe(1);
      expect(body.data).toEqual([{ id: "ev1" }]);
    });

    it("arcane_environment_list devuelve el sobre con paginacion", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerEnvironmentTools(server as any, mockClient);

      (mockClient.environments.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "env1", name: "local" }],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_environment_list");
      const result = await handler({});
      const body = JSON.parse(result.content[0].text);

      expect(body.pagination.totalItems).toBe(1);
      expect(body.data).toHaveLength(1);
    });

    it("arcane_environment_list pasa sort, order y start con valores reales", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerEnvironmentTools(server as any, mockClient);

      const handler = server.getHandler("arcane_environment_list");
      await handler({ search: "prod", sort: "name", order: "desc", start: 10, limit: 5, type: "local" });

      expect(mockClient.environments.list).toHaveBeenCalledWith({
        search: "prod", sort: "name", order: "desc", start: 10, limit: 5, type: "local",
      });
    });

    it("arcane_stack_list pasa sort, order y start con valores reales", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerStackTools(server as any, mockClient);

      const handler = server.getHandler("arcane_stack_list");
      await handler({ environmentId: "env1", sort: "name", order: "desc", start: 30, limit: 15, status: "running" });

      expect(mockClient.stacks.list).toHaveBeenCalledWith("env1", {
        search: undefined, sort: "name", order: "desc", start: 30, limit: 15,
        status: "running", archived: undefined, tags: undefined,
      });
    });

    it("arcane_stack_list incluye pagination en el cuerpo, no el array pelado", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerStackTools(server as any, mockClient);

      (mockClient.stacks.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "stack1", name: "myapp" }],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_stack_list");
      const result = await handler({ environmentId: "env1" });
      const body = JSON.parse(result.content[0].text);

      expect(body.pagination.totalItems).toBe(1);
      expect(body.data).toEqual([{ id: "stack1", name: "myapp" }]);
    });

    it("arcane_template_list pasa sort, order y start con valores reales", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerTemplateTools(server as any, mockClient);

      const handler = server.getHandler("arcane_template_list");
      await handler({ search: "wordpress", sort: "name", order: "desc", start: 15, limit: 5, type: "compose" });

      expect(mockClient.templates.list).toHaveBeenCalledWith({
        search: "wordpress", sort: "name", order: "desc", start: 15, limit: 5, type: "compose",
      });
    });

    it("arcane_template_list avisa en prosa cuando la lista viene truncada", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerTemplateTools(server as any, mockClient);

      (mockClient.templates.list as any).mockResolvedValue({
        success: true,
        data: Array.from({ length: 20 }, (_, i) => ({ id: `t${i}` })),
        pagination: { totalItems: 45, totalPages: 3, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_template_list");
      const result = await handler({});
      const [primera] = result.content[0].text.split("\n");

      expect(primera).toBe("Showing 20 of 45 templates (page 1 of 3). Pass start=20 to see the rest.");
    });
  });

  describe("Superficie de listado — git, gitops, backups y jobs", () => {
    it("arcane_git_repository_list devuelve el sobre con paginacion", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerGitRepositoryTools(server as any, mockClient);

      (mockClient.gitRepositories.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "r1", name: "infra" }],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_git_repository_list");
      const body = JSON.parse((await handler({})).content[0].text);

      expect(body.pagination.totalItems).toBe(1);
      expect(body.data).toHaveLength(1);
    });

    it("arcane_git_repository_list ya no impone un limit por defecto propio", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerGitRepositoryTools(server as any, mockClient);

      (mockClient.gitRepositories.list as any).mockResolvedValue({
        success: true, data: [], pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_git_repository_list");
      await handler({});

      expect(mockClient.gitRepositories.list).toHaveBeenCalledWith(expect.objectContaining({ limit: undefined }));
    });

    it("arcane_git_repository_list pasa sort, order y start con valores reales", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerGitRepositoryTools(server as any, mockClient);

      (mockClient.gitRepositories.list as any).mockResolvedValue({
        success: true, data: [], pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_git_repository_list");
      await handler({ search: "infra", sort: "name", order: "asc", start: 20, limit: 10 });

      expect(mockClient.gitRepositories.list).toHaveBeenCalledWith({
        search: "infra", sort: "name", order: "asc", start: 20, limit: 10,
      });
    });

    it("arcane_gitops_sync_list pasa los parametros de paginacion al cliente", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerGitOpsSyncTools(server as any, mockClient);

      (mockClient.gitOpsSyncs.list as any).mockResolvedValue({
        success: true,
        data: [],
        counts: { totalSyncs: 0, activeSyncs: 0, successfulSyncs: 0 },
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_gitops_sync_list");
      await handler({ environmentId: "env1", search: "infra", sort: "name", order: "asc", start: 20, limit: 50 });

      expect(mockClient.gitOpsSyncs.list).toHaveBeenCalledWith("env1", {
        search: "infra", sort: "name", order: "asc", start: 20, limit: 50,
      });
    });

    it("arcane_gitops_sync_list incluye counts en el cuerpo, tal como exige el spec (GitopsSyncCounts es required)", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerGitOpsSyncTools(server as any, mockClient);

      (mockClient.gitOpsSyncs.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "sync1", name: "infra-sync" }],
        counts: { totalSyncs: 5, activeSyncs: 2, successfulSyncs: 4 },
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_gitops_sync_list");
      const result = await handler({ environmentId: "env1" });
      const body = JSON.parse(result.content[0].text);

      expect(body.counts).toEqual({ totalSyncs: 5, activeSyncs: 2, successfulSyncs: 4 });
      expect(body.pagination.totalItems).toBe(1);
      expect(body.data).toEqual([{ id: "sync1", name: "infra-sync" }]);
    });

    it("arcane_gitops_sync_list avisa en prosa cuando la lista viene truncada", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerGitOpsSyncTools(server as any, mockClient);

      (mockClient.gitOpsSyncs.list as any).mockResolvedValue({
        success: true,
        data: Array.from({ length: 20 }, (_, i) => ({ id: `sync${i}` })),
        counts: { totalSyncs: 32, activeSyncs: 10, successfulSyncs: 28 },
        pagination: { totalItems: 32, totalPages: 2, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_gitops_sync_list");
      const result = await handler({ environmentId: "env1" });

      const [primera] = result.content[0].text.split("\n");
      expect(primera).toBe("Showing 20 of 32 GitOps syncs (page 1 of 2). Pass start=20 to see the rest.");
      expect(result.isError).toBeUndefined();
    });

    it("arcane_volume_backup_list pasa volumeName y los parametros de paginacion al cliente", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerVolumeBackupTools(server as any, mockClient);

      (mockClient.volumeBackups.list as any).mockResolvedValue({
        success: true,
        data: [],
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_volume_backup_list");
      await handler({ environmentId: "env1", volumeName: "data-vol", search: "nightly", sort: "createdAt", order: "desc", start: 20, limit: 50 });

      expect(mockClient.volumeBackups.list).toHaveBeenCalledWith("env1", "data-vol", {
        search: "nightly", sort: "createdAt", order: "desc", start: 20, limit: 50,
      });
    });

    it("arcane_volume_backup_list devuelve el sobre con paginacion", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerVolumeBackupTools(server as any, mockClient);

      (mockClient.volumeBackups.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "backup1", volumeName: "data-vol", size: 1024, createdAt: "2024-01-01" }],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_volume_backup_list");
      const result = await handler({ environmentId: "env1", volumeName: "data-vol" });
      const body = JSON.parse(result.content[0].text);

      expect(body.pagination.totalItems).toBe(1);
      expect(body.data).toEqual([{ id: "backup1", volumeName: "data-vol", size: 1024, createdAt: "2024-01-01" }]);
    });

    it("arcane_volume_backup_list avisa en prosa cuando la lista viene truncada", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerVolumeBackupTools(server as any, mockClient);

      (mockClient.volumeBackups.list as any).mockResolvedValue({
        success: true,
        data: Array.from({ length: 20 }, (_, i) => ({ id: `backup${i}` })),
        pagination: { totalItems: 45, totalPages: 3, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_volume_backup_list");
      const result = await handler({ environmentId: "env1", volumeName: "data-vol" });

      const [primera] = result.content[0].text.split("\n");
      expect(primera).toBe("Showing 20 of 45 volume backups (page 1 of 3). Pass start=20 to see the rest.");
    });

    it("arcane_job_list con jobs:null devuelve una lista vacia, no el texto 'null'", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerJobTools(server as any, mockClient);

      (mockClient.jobs.list as any).mockResolvedValue({ success: true, jobs: null });

      const handler = server.getHandler("arcane_job_list");
      const result = await handler({ environmentId: "env1" });

      expect(result.content[0].text.trim()).not.toBe("null");
      expect(JSON.parse(result.content[0].text)).toEqual([]);
    });

    it("arcane_job_list con jobs devuelve la lista tal cual", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerJobTools(server as any, mockClient);

      (mockClient.jobs.list as any).mockResolvedValue({ success: true, jobs: [{ id: "j1", name: "image_update_check" }] });

      const handler = server.getHandler("arcane_job_list");
      const result = await handler({ environmentId: "env1" });

      expect(JSON.parse(result.content[0].text)).toEqual([{ id: "j1", name: "image_update_check" }]);
    });
  });

  describe("Tools de image-updates", () => {
    const clienteConUpdates = () => {
      const mockClient = createMockClient() as any;
      mockClient.imageUpdates = {
        summary: vi.fn().mockResolvedValue({ success: true, data: { totalImages: 18, imagesWithUpdates: 4, digestUpdates: 4, errorsCount: 2 } }),
        byRefs: vi.fn().mockResolvedValue({ success: true, data: {} }),
        check: vi.fn().mockResolvedValue({ success: true, data: { checkTime: "t", currentVersion: "1", hasUpdate: true, responseTimeMs: 5, updateType: "digest" } }),
        checkBatch: vi.fn().mockResolvedValue({ success: true, data: {} }),
      };
      return mockClient;
    };

    it("arcane_image_update_summary devuelve los recuentos", async () => {
      const mockClient = clienteConUpdates();
      const server = createMockServer();
      registerImageUpdateTools(server as any, mockClient);

      const result = await server.getHandler("arcane_image_update_summary")({ environmentId: "env1" });
      expect(JSON.parse(result.content[0].text).imagesWithUpdates).toBe(4);
    });

    it("arcane_image_update_status pasa las referencias como array al cliente", async () => {
      const mockClient = clienteConUpdates();
      const server = createMockServer();
      registerImageUpdateTools(server as any, mockClient);

      await server.getHandler("arcane_image_update_status")({ environmentId: "env1", imageRefs: "nginx:latest,redis:7" });
      expect(mockClient.imageUpdates.byRefs).toHaveBeenCalledWith("env1", ["nginx:latest", "redis:7"]);
    });

    it("arcane_image_update_status no avisa cuando el mapa trae todas las referencias pedidas", async () => {
      const mockClient = clienteConUpdates();
      mockClient.imageUpdates.byRefs.mockResolvedValue({
        success: true,
        data: {
          "nginx:latest": { hasUpdate: false },
          "redis:7": { hasUpdate: true },
        },
      });
      const server = createMockServer();
      registerImageUpdateTools(server as any, mockClient);

      const result = await server.getHandler("arcane_image_update_status")({
        environmentId: "env1",
        imageRefs: "nginx:latest,redis:7",
      });
      expect(result.content[0].text.startsWith("{")).toBe(true);
      expect(result.content[0].text).not.toContain("omits");
    });

    it("arcane_image_update_status avisa y nombra las referencias que faltan en el mapa", async () => {
      // Comprobado contra la instancia real: la API omite del mapa las
      // referencias que no tiene cacheadas. Este test falla si la tool deja
      // de comparar lo pedido contra lo devuelto, o si deja de nombrar cuales
      // faltan.
      const mockClient = clienteConUpdates();
      mockClient.imageUpdates.byRefs.mockResolvedValue({
        success: true,
        data: { "nginx:latest": { hasUpdate: false } },
      });
      const server = createMockServer();
      registerImageUpdateTools(server as any, mockClient);

      const result = await server.getHandler("arcane_image_update_status")({
        environmentId: "env1",
        imageRefs: "nginx:latest,redis:7,noexiste/pepe:1",
      });
      const [primera] = result.content[0].text.split("\n");
      expect(primera).toBe(
        "The response omits 2 of 3 requested reference(s): redis:7, noexiste/pepe:1. " +
          "The response does not say why they are missing. " +
          "Use arcane_image_update_check to get a fresh answer for those references.",
      );
    });

    it("arcane_image_update_check acepta imageRef", async () => {
      const mockClient = clienteConUpdates();
      const server = createMockServer();
      registerImageUpdateTools(server as any, mockClient);

      await server.getHandler("arcane_image_update_check")({ environmentId: "env1", imageRef: "nginx:latest" });
      expect(mockClient.imageUpdates.check).toHaveBeenCalledWith("env1", { imageRef: "nginx:latest", imageId: undefined });
    });

    it("arcane_image_update_check devuelve isError si el cliente falla", async () => {
      const mockClient = clienteConUpdates();
      mockClient.imageUpdates.check.mockRejectedValue(new ArcaneApiError(500, "registry down"));
      const server = createMockServer();
      registerImageUpdateTools(server as any, mockClient);

      const result = await server.getHandler("arcane_image_update_check")({ environmentId: "env1", imageRef: "nginx:latest" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("registry down");
    });

    it("arcane_image_update_check_batch parte la lista separada por comas", async () => {
      const mockClient = clienteConUpdates();
      const server = createMockServer();
      registerImageUpdateTools(server as any, mockClient);

      await server.getHandler("arcane_image_update_check_batch")({ environmentId: "env1", imageRefs: "a:1, b:2" });
      expect(mockClient.imageUpdates.checkBatch).toHaveBeenCalledWith("env1", ["a:1", "b:2"]);
    });
  });

  describe("Tools de updater", () => {
    const clienteConUpdater = () => {
      const mockClient = createMockClient() as any;
      mockClient.updater = {
        status: vi.fn().mockResolvedValue({ success: true, data: { updatingContainers: 0, updatingProjects: 0, containerIds: [], projectIds: [] } }),
        history: vi.fn().mockResolvedValue({ success: true, data: [] }),
        run: vi.fn().mockResolvedValue({ success: true, data: { checked: 1, updated: 0, skipped: 1, failed: 0, duration: "1s", items: [] } }),
      };
      return mockClient;
    };

    it("arcane_updater_history avisa cuando devuelve exactamente lo pedido", async () => {
      const mockClient = clienteConUpdater();
      mockClient.updater.history.mockResolvedValue({
        success: true,
        data: Array.from({ length: 5 }, (_, i) => ({ id: `r${i}` })),
      });
      const server = createMockServer();
      registerUpdaterTools(server as any, mockClient);

      const result = await server.getHandler("arcane_updater_history")({ environmentId: "env1", limit: 5 });
      const [primera] = result.content[0].text.split("\n");
      expect(primera).toBe(
        "This history may be truncated: exactly 5 records were requested and 5 were returned, and this endpoint reports no total. Raise limit to find out.",
      );
    });

    it("arcane_updater_history no avisa cuando devuelve menos de lo pedido", async () => {
      const mockClient = clienteConUpdater();
      mockClient.updater.history.mockResolvedValue({ success: true, data: [{ id: "r0" }] });
      const server = createMockServer();
      registerUpdaterTools(server as any, mockClient);

      const result = await server.getHandler("arcane_updater_history")({ environmentId: "env1", limit: 5 });
      expect(result.content[0].text.startsWith("[")).toBe(true);
      expect(result.content[0].text).not.toContain("may be truncated");
    });

    it("arcane_updater_history trata data:null como lista vacia, nunca el texto 'null'", async () => {
      const mockClient = clienteConUpdater();
      mockClient.updater.history.mockResolvedValue({ success: true, data: null });
      const server = createMockServer();
      registerUpdaterTools(server as any, mockClient);

      const result = await server.getHandler("arcane_updater_history")({ environmentId: "env1" });
      expect(JSON.parse(result.content[0].text)).toEqual([]);
    });

    it("arcane_updater_history avisa con el limite por defecto del servidor cuando no se pide limit", async () => {
      // Sin `limit`, la heuristica compara contra LIMIT_POR_DEFECTO_DEL_SERVIDOR (50),
      // no contra `undefined`. Este test falla si esa constante se sustituye por `limit` a secas.
      const mockClient = clienteConUpdater();
      mockClient.updater.history.mockResolvedValue({
        success: true,
        data: Array.from({ length: 50 }, (_, i) => ({ id: `r${i}` })),
      });
      const server = createMockServer();
      registerUpdaterTools(server as any, mockClient);

      const result = await server.getHandler("arcane_updater_history")({ environmentId: "env1" });
      const [primera] = result.content[0].text.split("\n");
      expect(primera).toBe(
        "This history may be truncated: exactly 50 records were requested and 50 were returned, and this endpoint reports no total. Raise limit to find out.",
      );
    });

    it("arcane_updater_run exige resourceIds: el schema no acepta la llamada sin el campo", async () => {
      // resourceIds es z.string() sin .optional() a proposito: sin objetivo,
      // arcane_updater_run actualizaria y reiniciaria todo el entorno, incluido
      // el propio contenedor arcane-mcp-server. Este test falla si alguien le
      // añade .optional() al schema en src/tools/updater.ts.
      const mockClient = clienteConUpdater();
      const server = createMockServer();
      registerUpdaterTools(server as any, mockClient);

      const call = (server.tool as any).mock.calls.find((c: any[]) => c[0] === "arcane_updater_run");
      const schemaShape = call[2];
      const schema = z.object(schemaShape);

      const validArgs = { environmentId: "env1", resourceIds: "c1,c2" };
      expect(() => schema.parse(validArgs)).not.toThrow();

      const { resourceIds, ...withoutResourceIds } = validArgs;
      expect(() => schema.parse(withoutResourceIds)).toThrow();
    });

    it("arcane_updater_run parte resourceIds y pasa dryRun", async () => {
      const mockClient = clienteConUpdater();
      const server = createMockServer();
      registerUpdaterTools(server as any, mockClient);

      await server.getHandler("arcane_updater_run")({ environmentId: "env1", resourceIds: "c1, c2", type: "container", dryRun: true });
      expect(mockClient.updater.run).toHaveBeenCalledWith("env1", {
        resourceIds: ["c1", "c2"], type: "container", dryRun: true, forceUpdate: undefined,
      });
    });

    it("arcane_updater_run devuelve isError si el cliente rechaza por falta de objetivo", async () => {
      const mockClient = clienteConUpdater();
      mockClient.updater.run.mockRejectedValue(new Error("run() necesita al menos un elemento en resourceIds"));
      const server = createMockServer();
      registerUpdaterTools(server as any, mockClient);

      const result = await server.getHandler("arcane_updater_run")({ environmentId: "env1", resourceIds: "" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("resourceIds");
    });
  });

  describe("El filtro updates en las tools de listado", () => {
    it("arcane_image_list pasa updates al cliente", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerImageTools(server as any, mockClient);
      (mockClient.images.list as any).mockResolvedValue({
        success: true, data: [], pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      await server.getHandler("arcane_image_list")({ environmentId: "env1", updates: "true" });
      expect(mockClient.images.list).toHaveBeenCalledWith("env1", expect.objectContaining({ updates: "true" }));
    });

    it("arcane_container_list pasa updates al cliente", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerContainerTools(server as any, mockClient);
      (mockClient.containers.list as any).mockResolvedValue({
        success: true, data: [], counts: { runningContainers: 0, stoppedContainers: 0, totalContainers: 0 },
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      await server.getHandler("arcane_container_list")({ environmentId: "env1", updates: "has_update" });
      expect(mockClient.containers.list).toHaveBeenCalledWith("env1", expect.objectContaining({ updates: "has_update" }));
    });

    it("arcane_stack_list pasa updates al cliente", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerStackTools(server as any, mockClient);

      await server.getHandler("arcane_stack_list")({ environmentId: "env1", updates: "up_to_date" });
      expect(mockClient.stacks.list).toHaveBeenCalledWith("env1", expect.objectContaining({ updates: "up_to_date" }));
    });
  });

  describe("vulnerability tools", () => {
    const NOMBRES_LECTURA = [
      "arcane_vulnerability_scanner_status",
      "arcane_vulnerability_summary",
      "arcane_vulnerability_list",
      "arcane_vulnerability_image_options",
      "arcane_vulnerability_scan_result",
      "arcane_vulnerability_image_list",
      "arcane_vulnerability_image_summary",
      "arcane_vulnerability_image_summaries",
      "arcane_vulnerability_ignored_list",
    ];

    it("registra las 9 tools de lectura", () => {
      const server = createMockServer();
      registerVulnerabilityTools(server as any, createMockClient());
      for (const nombre of NOMBRES_LECTURA) {
        expect(server.getHandler(nombre), nombre).toBeDefined();
      }
    });

    it("scan_result RECORTA el detalle: metadatos sí, CVEs no", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.scanResult as any).mockResolvedValue({
        success: true,
        data: {
          imageId: "sha256:abc", imageName: "curlimages/curl:8.5.0", scanTime: "t",
          status: "completed", scanPhase: "storing_results", activityId: "act-1",
          scannerVersion: "0.73.0", duration: 13,
          summary: { critical: 0, high: 1, medium: 1, low: 1, unknown: 0, total: 3 },
          vulnerabilities: [
            { vulnerabilityId: "CVE-2023-42363", pkgName: "busybox", installedVersion: "1", severity: "MEDIUM", description: "use-after-free in awk", references: ["https://example.org/cve"] },
            { vulnerabilityId: "CVE-2024-6119", pkgName: "libcrypto3", installedVersion: "3", severity: "HIGH", description: "denial of service", references: [] },
            { vulnerabilityId: "CVE-2023-42364", pkgName: "busybox", installedVersion: "1", severity: "LOW", description: "otra", references: [] },
          ],
        },
      });
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_scan_result")!({ environmentId: "env1", imageId: "sha256:abc" });
      const texto = out.content[0].text;
      // Metadatos presentes...
      expect(texto).toContain('"status": "completed"');
      expect(texto).toContain('"activityId": "act-1"');
      expect(texto).toContain('"total": 3');
      // ...prosa que remite al listado paginado...
      expect(texto).toContain("arcane_vulnerability_image_list");
      // ...y NADA del detalle de las CVEs.
      expect(texto).not.toContain("CVE-2023-42363");
      expect(texto).not.toContain("use-after-free");
      expect(texto).not.toContain('"references"');
    });

    it("image_summaries avisa cuando el mapa omite referencias pedidas", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.imageSummaries as any).mockResolvedValue({
        success: true,
        data: { summaries: { "sha256:a": { imageId: "sha256:a", scanTime: "t", status: "completed" } } },
      });
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_image_summaries")!({ environmentId: "env1", imageIds: "sha256:a, sha256:b" });
      expect(out.content[0].text).toContain("omits 1 of 2");
      expect(out.content[0].text).toContain("sha256:b");
      expect(out.content[0].text).toContain("does not say why");
      expect(out.content[0].text).not.toContain("Most likely");
    });

    it("image_summaries NO avisa cuando el mapa está completo", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.imageSummaries as any).mockResolvedValue({
        success: true,
        data: { summaries: { "sha256:a": { imageId: "sha256:a", scanTime: "t", status: "completed" } } },
      });
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_image_summaries")!({ environmentId: "env1", imageIds: "sha256:a" });
      expect(out.content[0].text).not.toContain("omits");
    });

    it("vulnerability_list usa el contrato de listResponse con prosa multipágina", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.listAll as any).mockResolvedValue({
        success: true,
        data: [{ vulnerabilityId: "CVE-1", pkgName: "p", installedVersion: "1", severity: "HIGH", imageId: "sha256:a", imageName: "x" }],
        pagination: { totalPages: 2, totalItems: 3, currentPage: 1, itemsPerPage: 2, grandTotalItems: 3 },
      });
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_list")!({ environmentId: "env1", severity: "high" });
      expect(out.content[0].text).toContain("Showing 1 of 3 vulnerabilities (page 1 of 2).");
      expect((mockClient.vulnerabilities.listAll as any).mock.calls[0][1]).toMatchObject({ severity: "high" });
    });

    it("las tools de lectura devuelven isError ante un fallo del cliente", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.scanResult as any).mockRejectedValue(new ArcaneApiError(404, "Vulnerability scan not found"));
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_scan_result")!({ environmentId: "env1", imageId: "sha256:no" });
      expect(out.isError).toBe(true);
      expect(out.content[0].text).toContain("Vulnerability scan not found");
    });

    it("scan_result, image_list e image_summary NO inventan la causa del 404", () => {
      // El 404 de "scan not found" no distingue entre imagen inexistente e imagen
      // no escaneada. Las descripciones deben decir lo observable: el error no
      // distingue las dos causas; nunca afirmar "significa X" cuando podría ser X o Y.
      const server = createMockServer();
      registerVulnerabilityTools(server as any, createMockClient());

      const toolsAauditar = ["arcane_vulnerability_scan_result", "arcane_vulnerability_image_list", "arcane_vulnerability_image_summary"];

      for (const toolName of toolsAauditar) {
        const call = (server.tool as any).mock.calls.find((c: any[]) => c[0] === toolName);
        expect(call, `tool ${toolName} debería estar registrada`).toBeDefined();
        const description = call[1];
        expect(description, `${toolName}: no debe afirmar "means the image has never been scanned"`).not.toContain("means the image has never been scanned");
        expect(description, `${toolName}: debe decir "does not distinguish"`).toContain("does not distinguish");
      }
    });

    it("registra las 3 tools mutantes", () => {
      const server = createMockServer();
      registerVulnerabilityTools(server as any, createMockClient());
      for (const nombre of ["arcane_vulnerability_scan", "arcane_vulnerability_ignore", "arcane_vulnerability_unignore"]) {
        expect(server.getHandler(nombre), nombre).toBeDefined();
      }
    });

    it("vulnerability_scan devuelve el acuse con activityId", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.scan as any).mockResolvedValue({
        success: true,
        data: { imageId: "sha256:abc", imageName: "x", scanTime: "t", status: "scanning", scanPhase: "creating_container", activityId: "act-9" },
      });
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_scan")!({ environmentId: "env1", imageId: "sha256:abc" });
      expect((mockClient.vulnerabilities.scan as any).mock.calls[0]).toEqual(["env1", "sha256:abc"]);
      expect(out.content[0].text).toContain('"activityId": "act-9"');
      expect(out.content[0].text).toContain("asynchronous");
    });

    it("el schema de vulnerability_ignore exige reason y no admite createdBy", () => {
      const server = createMockServer();
      registerVulnerabilityTools(server as any, createMockClient());
      const call = (server.tool as any).mock.calls.find((c: any[]) => c[0] === "arcane_vulnerability_ignore");
      const schemaShape = call[2];
      const schema = z.object(schemaShape);
      // Sin reason: rechazado. Es la garantia falsable de la salvaguarda 1
      // del spec §3.2 — el mock de servidor no valida schemas, asi que sin
      // este test relajar reason a .optional() no haria fallar nada.
      expect(() =>
        schema.parse({ imageId: "sha256:abc", vulnerabilityId: "CVE-1", pkgName: "p" })
      ).toThrow();
      // Con reason: aceptado.
      const parsed = schema.parse({ imageId: "sha256:abc", vulnerabilityId: "CVE-1", pkgName: "p", reason: "no aplica" });
      expect(parsed.reason).toBe("no aplica");
      // createdBy no existe en el schema: lo pone el servidor.
      expect(schemaShape.createdBy).toBeUndefined();
    });

    it("vulnerability_ignore pasa el payload al cliente y devuelve el registro", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.ignore as any).mockResolvedValue({
        success: true,
        data: { id: "ign-7", environmentId: "env1", imageId: "sha256:abc", vulnerabilityId: "CVE-1", pkgName: "p", installedVersion: "1", createdAt: "t", createdBy: "arcane", reason: "no aplica" },
      });
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_ignore")!({
        environmentId: "env1", imageId: "sha256:abc", vulnerabilityId: "CVE-1", pkgName: "p", reason: "no aplica",
      });
      // envId resuelto, no solo el payload: si resolveEnvironmentId dejara de
      // pasar el id correcto, el payload solo no lo delataría.
      expect((mockClient.vulnerabilities.ignore as any).mock.calls[0][0]).toBe("env1");
      expect((mockClient.vulnerabilities.ignore as any).mock.calls[0][1]).toMatchObject({
        imageId: "sha256:abc", vulnerabilityId: "CVE-1", pkgName: "p", reason: "no aplica",
      });
      expect(out.content[0].text).toContain('"id": "ign-7"');
      expect(out.isError).toBeUndefined();
    });

    it("las descripciones de las tools mutantes conservan sus avisos criticos", () => {
      // Unica salvaguarda de que un futuro edit no borre en silencio el
      // aviso de asincronia, el coste de CPU, o el de persistencia/reversibilidad:
      // nada mas en la suite falla si estas frases desaparecen de la descripcion.
      const server = createMockServer();
      registerVulnerabilityTools(server as any, createMockClient());

      const scanCall = (server.tool as any).mock.calls.find((c: any[]) => c[0] === "arcane_vulnerability_scan");
      expect(scanCall, "arcane_vulnerability_scan debería estar registrada").toBeDefined();
      const scanDescription: string = scanCall[1];
      expect(scanDescription, "debe advertir que el scan es asincrono").toContain("asynchronous");
      expect(scanDescription, "debe advertir del coste de CPU en el host").toContain("CPU on the host");

      const ignoreCall = (server.tool as any).mock.calls.find((c: any[]) => c[0] === "arcane_vulnerability_ignore");
      expect(ignoreCall, "arcane_vulnerability_ignore debería estar registrada").toBeDefined();
      const ignoreDescription: string = ignoreCall[1];
      expect(ignoreDescription, "debe decir que el registro es persistente").toContain("persistent");
      expect(ignoreDescription, "debe decir que es reversible").toContain("Reversible");
    });

    it("vulnerability_unignore pasa el ignoreId", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.unignore as any).mockResolvedValue({ success: true });
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_unignore")!({ environmentId: "env1", ignoreId: "ign-7" });
      expect((mockClient.vulnerabilities.unignore as any).mock.calls[0]).toEqual(["env1", "ign-7"]);
      expect(out.isError).toBeUndefined();
    });
  });

  describe("registerContainerRegistryTools", () => {
    it("arcane_container_registry_pull_usage convierte registries:null en lista vacia", async () => {
      const server = createMockServer();
      const client = createMockClient();
      registerContainerRegistryTools(server as any, client);

      const handler = server.getHandler("arcane_container_registry_pull_usage");
      const res = await handler!({});

      expect(JSON.parse(res.content[0].text)).toEqual({ registries: [] });
    });

    it("arcane_container_registry_test devuelve isError cuando la API falla", async () => {
      const server = createMockServer();
      const client = createMockClient();
      (client.containerRegistries.test as any).mockRejectedValue(
        new ArcaneApiError(400, "Registry test failed: registry login failed: no such host"),
      );
      registerContainerRegistryTools(server as any, client);

      const handler = server.getHandler("arcane_container_registry_test");
      const res = await handler!({ registryId: "r1" });

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("no such host");
    });
  });
});
