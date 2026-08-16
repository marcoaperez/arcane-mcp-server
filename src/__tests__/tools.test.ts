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
      system: {
        version: vi.fn().mockResolvedValue({
          success: true,
          data: { version: "1.2.3" },
        }) as MockedFunction<() => any>,
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

      expect(mockClient.environments.list).toHaveBeenCalledWith({ search: "production", limit: 50 });
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

      expect(mockClient.stacks.list).toHaveBeenCalledWith("env1", { search: "myapp", limit: 50 });
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

      expect(mockClient.containers.list).toHaveBeenCalledWith("env1");
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

      expect(mockClient.images.list).toHaveBeenCalledWith("env1");
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

      expect(mockClient.volumes.list).toHaveBeenCalledWith("env1");
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

      expect(mockClient.activities.get).toHaveBeenCalledWith("env1", "act1");
      expect(result.isError).toBeUndefined();
    });

    it("arcane_activity_cancel devuelve isError con success:false", async () => {
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

      expect(mockClient.networks.list).toHaveBeenCalledWith("env1");
      expect(result.content).toEqual([{ type: "text", text: expect.any(String) }]);
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

      expect(mockClient.templates.list).toHaveBeenCalledWith({ search: "wordpress", limit: 50 });
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
});
