import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over repository names and URLs"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, url, createdAt"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};

export function registerGitRepositoryTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_git_repository_list",
    "List git repositories configured in Arcane. Returns repository IDs, names, URLs, authentication details and pagination; if the response says there are more pages, pass start to see the rest.",
    { ...LIST_PARAMS },
    withErrors(async ({ search, sort, order, start, limit }) => {
      const result = await client.gitRepositories.list({ search, sort, order, start, limit });
      return listResponse(result, "git repositories");
    }),
  );

  server.tool(
    "arcane_git_repository_get",
    "Get details of a specific git repository by ID.",
    {
      id: z.string().describe("Repository ID"),
    },
    withErrors(async ({ id }) => {
      const result = await client.gitRepositories.get(id);
      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      };
    }),
  );

  server.tool(
    "arcane_git_repository_create",
    "Create a new git repository in Arcane.",
    {
      name: z.string().describe("Repository name"),
      url: z.string().describe("Git repository URL"),
      authType: z.string().describe("Authentication type (e.g., 'token', 'ssh', 'basic')"),
      description: z.string().optional().describe("Repository description"),
      enabled: z.boolean().optional().describe("Whether the repository is enabled"),
      username: z.string().optional().describe("Username for basic auth"),
      token: z.string().optional().describe("Access token for token auth"),
      sshKey: z.string().optional().describe("SSH private key for SSH auth"),
      sshHostKeyVerification: z.string().optional().describe("SSH host key verification setting"),
    },
    withErrors(async (dto) => {
      const result = await client.gitRepositories.create(dto);
      return {
        content: [{ type: "text", text: `Git repository created successfully:\n${JSON.stringify(result.data, null, 2)}` }],
      };
    }),
  );

  server.tool(
    "arcane_git_repository_update",
    "Update an existing git repository.",
    {
      id: z.string().describe("Repository ID"),
      name: z.string().optional().describe("New repository name"),
      url: z.string().optional().describe("New git repository URL"),
      authType: z.string().optional().describe("New authentication type"),
      description: z.string().optional().describe("New repository description"),
      enabled: z.boolean().optional().describe("Enable or disable the repository"),
      username: z.string().optional().describe("New username for basic auth"),
      token: z.string().optional().describe("New access token"),
      sshKey: z.string().optional().describe("New SSH private key"),
      sshHostKeyVerification: z.string().optional().describe("New SSH host key verification setting"),
    },
    withErrors(async ({ id, ...dto }) => {
      const result = await client.gitRepositories.update(id, dto);
      return {
        content: [{ type: "text", text: `Git repository updated successfully:\n${JSON.stringify(result.data, null, 2)}` }],
      };
    }),
  );

  server.tool(
    "arcane_git_repository_delete",
    "Delete a git repository from Arcane.",
    {
      id: z.string().describe("Repository ID"),
    },
    withErrors(async ({ id }) => {
      const result = await client.gitRepositories.delete(id);
      return {
        content: [{ type: "text", text: result.message || "Git repository deleted successfully" }],
      };
    }),
  );

  server.tool(
    "arcane_git_repository_list_branches",
    "List all branches in a git repository.",
    {
      id: z.string().describe("Repository ID"),
    },
    withErrors(async ({ id }) => {
      const result = await client.gitRepositories.listBranches(id);
      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      };
    }),
  );

  server.tool(
    "arcane_git_repository_browse_files",
    "Browse files in a git repository.",
    {
      id: z.string().describe("Repository ID"),
      branch: z.string().optional().describe("Branch to browse (defaults to default branch)"),
      path: z.string().optional().describe("Path within repository (defaults to root)"),
    },
    withErrors(async ({ id, branch, path }) => {
      const result = await client.gitRepositories.browseFiles(id, branch, path);
      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      };
    }),
  );

  server.tool(
    "arcane_git_repository_test",
    "Test connection to a git repository.",
    {
      id: z.string().describe("Repository ID"),
      branch: z.string().optional().describe("Branch to test (defaults to default branch)"),
    },
    withErrors(async ({ id, branch }) => {
      const result = await client.gitRepositories.test(id, branch);
      return {
        content: [{ type: "text", text: result.message || "Git repository connection test successful" }],
      };
    }),
  );
}
