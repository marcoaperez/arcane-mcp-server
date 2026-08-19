import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { ArcaneClient } from "./arcane-client";
import { handleAccessRequest } from "./access-handler";
import type { Props } from "./workers-oauth-utils";
import { registerEnvironmentTools } from "./tools/environments";
import { registerStackTools } from "./tools/stacks";
import { registerContainerTools } from "./tools/containers";
import { registerContainerAdditionalTools } from "./tools/containers-additional";
import { registerImageTools } from "./tools/images";
import { registerVolumeTools } from "./tools/volumes";
import { registerVolumeBackupTools } from "./tools/volume-backups";
import { registerVolumeFileTools } from "./tools/volume-files";
import { registerNetworkTools } from "./tools/networks";
import { registerTemplateTools } from "./tools/templates";
import { registerSystemTools } from "./tools/system";
import { registerActivityTools } from "./tools/activities";
import { registerEventTools } from "./tools/events";
import { registerJobTools } from "./tools/jobs";
import { registerGitRepositoryTools } from "./tools/git-repositories";
import { registerGitOpsSyncTools } from "./tools/gitops-syncs";
import { registerProjectAdditionalTools } from "./tools/projects-additional";
import { registerImageUpdateTools } from "./tools/image-updates";
import { registerUpdaterTools } from "./tools/updater";
import { registerVulnerabilityTools } from "./tools/vulnerabilities";
import { registerContainerRegistryTools } from "./tools/container-registries";
import { registerTemplateRegistryTools } from "./tools/template-registries";

export class ArcaneAgent extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: "Arcane Docker MCP Server",
    version: "1.0.0",
  });

  async init() {
    // Use ARCANE_BASE_URL for local/Docker mode, VPC_SERVICE for Cloudflare Workers
    const baseUrl = (this.env as any).ARCANE_BASE_URL as string | undefined;
    if (baseUrl) {
      console.log(`[arcane-mcp] Connecting to Arcane at ${baseUrl}`);
    } else {
      console.log("[arcane-mcp] Connecting to Arcane via Cloudflare VPC service binding");
    }

    const client = new ArcaneClient(
      this.env.ARCANE_API_KEY,
      baseUrl || this.env.VPC_SERVICE,
    );

    registerEnvironmentTools(this.server, client);
    registerStackTools(this.server, client);
    registerContainerTools(this.server, client);
    registerContainerAdditionalTools(this.server, client);
    registerImageTools(this.server, client);
    registerVolumeTools(this.server, client);
    registerVolumeBackupTools(this.server, client);
    registerVolumeFileTools(this.server, client);
    registerNetworkTools(this.server, client);
    registerTemplateTools(this.server, client);
    registerSystemTools(this.server, client);
    registerActivityTools(this.server, client);
    registerEventTools(this.server, client);
    registerJobTools(this.server, client);
    registerGitRepositoryTools(this.server, client);
    registerGitOpsSyncTools(this.server, client);
    registerProjectAdditionalTools(this.server, client);
    registerImageUpdateTools(this.server, client);
    registerUpdaterTools(this.server, client);
    registerVulnerabilityTools(this.server, client);
    registerContainerRegistryTools(this.server, client);
    registerTemplateRegistryTools(this.server, client);
  }
}

// In local/Docker mode (ARCANE_BASE_URL set), serve MCP directly without OAuth.
// In Cloudflare Workers mode, use the full OAuth provider.
const mcpHandler = ArcaneAgent.serve("/mcp");
const oauthHandler = new OAuthProvider({
  apiHandler: mcpHandler,
  apiRoute: "/mcp",
  authorizeEndpoint: "/authorize",
  clientRegistrationEndpoint: "/register",
  defaultHandler: { fetch: handleAccessRequest as any },
  tokenEndpoint: "/token",
});

function validateLocalAuth(request: Request, env: Env): Response | null {
  const token = (env as any).MCP_AUTH_TOKEN as string | undefined;
  if (!token) return null; // No token configured = no auth required

  const authHeader = request.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${token}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null; // Auth passed
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if ((env as any).ARCANE_BASE_URL) {
      // Local mode: validate Bearer token, then serve MCP directly
      const authError = validateLocalAuth(request, env);
      if (authError) return authError;
      return mcpHandler.fetch(request, env, ctx);
    }
    // Cloud mode: full OAuth flow
    return oauthHandler.fetch(request, env, ctx);
  },
};
