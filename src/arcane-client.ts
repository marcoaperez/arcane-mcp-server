export class ArcaneApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ArcaneApiError";
  }
}

/**
 * Lanza ArcaneApiError si la respuesta no es correcta, usando el `detail` del
 * cuerpo de error cuando lo hay.
 *
 * Extraido en F5: el mismo bloque estaba repetido literalmente en request(),
 * requestMultipart(), requestNdjson() y VolumeBackupsMethods.download() (esta
 * ultima eliminada en el arreglo de la tool falsa: era codigo muerto, sin
 * ninguna tool que la alcanzara), y la fase añadia dos sitios mas.
 */
async function lanzaSiFalla(response: Response): Promise<void> {
  if (response.ok) return;
  let message = response.statusText;
  try {
    const err = (await response.json()) as { detail?: string };
    if (err.detail) message = err.detail;
  } catch {}
  throw new ArcaneApiError(response.status, message);
}

export * from "./arcane-client/types-resources";
export * from "./arcane-client/types-vulnerabilities";
export * from "./arcane-client/types-catalog";
export * from "./arcane-client/types-git-activity";
export * from "./arcane-client/types-system-build";
export * from "./arcane-client/types-registries";
export { BUILD_ARG_OCULTO, LINEAS_DE_LOG_CONSERVADAS } from "./arcane-client/internal";

import { EnvironmentsMethods, StacksMethods, ProjectAdditionalMethods } from "./arcane-client/environments-stacks";
import { ContainersMethods, ContainerAdditionalMethods, ContainerRegistriesMethods } from "./arcane-client/containers";
import { ImagesMethods, ImageUpdatesMethods, ImageBuildsMethods, BuildWorkspaceMethods } from "./arcane-client/images-builds";
import { VolumesMethods, NetworksMethods, VolumeBackupsMethods, VolumeFilesMethods } from "./arcane-client/volumes-networks";
import { TemplatesMethods, TemplateRegistriesMethods, GitRepositoriesMethods, GitOpsSyncsMethods } from "./arcane-client/templates-git";
import { SystemMethods, ActivitiesMethods, EventsMethods, JobsMethods } from "./arcane-client/system-activity";
import { UpdaterMethods, VulnerabilitiesMethods } from "./arcane-client/vulnerabilities-updater";

export class ArcaneClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly _fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

  readonly environments: EnvironmentsMethods;
  readonly stacks: StacksMethods;
  readonly containers: ContainersMethods;
  readonly images: ImagesMethods;
  readonly volumes: VolumesMethods;
  readonly networks: NetworksMethods;
  readonly templates: TemplatesMethods;
  readonly system: SystemMethods;
  readonly activities: ActivitiesMethods;
  readonly events: EventsMethods;
  readonly jobs: JobsMethods;
  readonly imageUpdates: ImageUpdatesMethods;
  readonly updater: UpdaterMethods;
  readonly vulnerabilities: VulnerabilitiesMethods;
  readonly gitRepositories: GitRepositoriesMethods;
  readonly gitOpsSyncs: GitOpsSyncsMethods;
  readonly projectAdditional: ProjectAdditionalMethods;
  readonly containerAdditional: ContainerAdditionalMethods;
  readonly volumeBackups: VolumeBackupsMethods;
  readonly volumeFiles: VolumeFilesMethods;
  readonly containerRegistries: ContainerRegistriesMethods;
  readonly templateRegistries: TemplateRegistriesMethods;
  readonly buildWorkspace: BuildWorkspaceMethods;
  readonly imageBuilds: ImageBuildsMethods;

  // When a Cloudflare VPC Fetcher is provided, routing to the Arcane backend
  // is handled by the service binding — only the path portion of URLs matters.
  // When running locally (wrangler dev), pass a real baseUrl instead.
  constructor(apiKey: string, fetcherOrBaseUrl?: Fetcher | string) {
    if (typeof fetcherOrBaseUrl === "string") {
      // Local / Docker mode: real base URL provided
      this.baseUrl = fetcherOrBaseUrl.replace(/\/+$/, "") + "/api";
      this.apiKey = apiKey;
      this._fetch = (input, init) => fetch(input, init);
    } else {
      // Cloudflare Worker mode: VPC service binding
      this.baseUrl = "http://placeholder/api";
      this.apiKey = apiKey;
      this._fetch = fetcherOrBaseUrl ? fetcherOrBaseUrl.fetch.bind(fetcherOrBaseUrl) : fetch;
    }
    this.environments = new EnvironmentsMethods(this);
    this.stacks = new StacksMethods(this);
    this.containers = new ContainersMethods(this);
    this.images = new ImagesMethods(this);
    this.volumes = new VolumesMethods(this);
    this.networks = new NetworksMethods(this);
    this.templates = new TemplatesMethods(this);
    this.system = new SystemMethods(this);
    this.activities = new ActivitiesMethods(this);
    this.events = new EventsMethods(this);
    this.jobs = new JobsMethods(this);
    this.imageUpdates = new ImageUpdatesMethods(this);
    this.updater = new UpdaterMethods(this);
    this.vulnerabilities = new VulnerabilitiesMethods(this);
    this.gitRepositories = new GitRepositoriesMethods(this);
    this.gitOpsSyncs = new GitOpsSyncsMethods(this);
    this.projectAdditional = new ProjectAdditionalMethods(this);
    this.containerAdditional = new ContainerAdditionalMethods(this);
    this.volumeBackups = new VolumeBackupsMethods(this);
    this.volumeFiles = new VolumeFilesMethods(this);
    this.containerRegistries = new ContainerRegistriesMethods(this);
    this.templateRegistries = new TemplateRegistriesMethods(this);
    this.buildWorkspace = new BuildWorkspaceMethods(this);
    this.imageBuilds = new ImageBuildsMethods(this);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this._fetch(url, {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    await lanzaSiFalla(response);

    return response.json() as Promise<T>;
  }

  /**
   * Como `request<T>`, pero para endpoints que no devuelven cuerpo (HEAD).
   *
   * `request()` termina en `response.json()`, que con un cuerpo vacio lanza.
   * Aqui el veredicto es el codigo de estado, y un estado de error NO lanza:
   * "el sistema no esta sano" es una respuesta valida, no un fallo de la llamada.
   */
  async requestHead(path: string): Promise<{ ok: boolean; status: number }> {
    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method: "HEAD",
      headers: { "X-API-Key": this.apiKey },
    });
    return { ok: response.ok, status: response.status };
  }

  /**
   * Como `request<T>`, pero para endpoints que responden 204 sin cuerpo.
   *
   * `request()` termina en `response.json()`, que con un cuerpo vacio lanza.
   * Medido el 2026-08-19: POST /builds/browse/mkdir y DELETE /builds/browse
   * devuelven 204 y ningun byte.
   *
   * A diferencia de `requestHead()`, aqui un estado de error SI lanza: alli el
   * codigo era el dato ("el sistema no esta sano" es una respuesta valida), aqui
   * "no pude crear el directorio" es un fallo de la llamada.
   */
  async requestSinCuerpo(method: string, path: string, body?: unknown): Promise<void> {
    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    await lanzaSiFalla(response);
  }

  /**
   * Like `request<T>`, but sends a `FormData` body for multipart endpoints
   * (e.g. `PUT /volumes/{name}/workspace`).
   *
   * Deliberately omits `Content-Type`: the runtime must set it so it can add the
   * multipart boundary. Setting it by hand produces a body the server can't parse.
   */
  async requestMultipart<T>(method: string, path: string, form: FormData): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this._fetch(url, {
      method,
      headers: { "X-API-Key": this.apiKey },
      body: form,
    });

    await lanzaSiFalla(response);

    return response.json() as Promise<T>;
  }

  /**
   * Like `request<T>`, but parses the response as NDJSON (newline-delimited JSON).
   * Used for streaming endpoints like /pull that emit one JSON object per line.
   * Returns an array with one entry per parsed line. Empty/blank lines are skipped.
   */
  async requestNdjson<T = unknown>(method: string, path: string, body?: unknown): Promise<T[]> {
    const url = `${this.baseUrl}${path}`;
    const response = await this._fetch(url, {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    await lanzaSiFalla(response);

    const text = await response.text();
    const events: T[] = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed) as T);
      } catch {
        // Ignore unparseable lines (e.g. trailing partial chunks)
      }
    }
    return events;
  }
}
