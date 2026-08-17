import type { ArcaneClient, PaginatedResponse } from "../arcane-client";
import { collectAllPages, type PageRequest } from "./paging";

/** Cuantos nombres se listan como maximo en un mensaje de "no encontrado". */
const MAX_DISPONIBLES = 30;

/**
 * Lista nombres para un mensaje de error, capada.
 *
 * Sin cap, un entorno con 2.000 contenedores produciria un mensaje de error de
 * miles de nombres.
 */
export function listaDisponibles(nombres: string[]): string {
  if (nombres.length === 0) return "none";
  if (nombres.length <= MAX_DISPONIBLES) return nombres.join(", ");
  const sobran = nombres.length - MAX_DISPONIBLES;
  return `${nombres.slice(0, MAX_DISPONIBLES).join(", ")} …and ${sobran} more`;
}

/**
 * Configuracion textual de un resolver nombre->id: los cuatro resolvers
 * (entorno, stack, contenedor, sync de GitOps) solo difieren en esto.
 */
interface ResolveByNameLabels {
  /** Sustantivo en singular: "environment", "stack", "container", "GitOps sync". */
  singular: string;
  /**
   * Sustantivo en plural "desnudo", el que sigue a un recuento: "environments",
   * "stacks", "containers", "syncs". Para GitOps sync es "syncs", no "GitOps
   * syncs" — asi lo pide el mensaje original.
   */
  countNoun: string;
  /**
   * Sustantivo en plural para "Multiple X found": igual que countNoun salvo en
   * GitOps sync, donde es "GitOps syncs".
   */
  foundNoun: string;
  /** "environment ID", "stack ID", "container ID", "sync ID". */
  idNoun: string;
  /** Sufijo de contexto, p.ej. " in environment 'env123'", o "" si no aplica. */
  scope: string;
}

/**
 * Resuelve un id a partir de un nombre recorriendo la coleccion entera con
 * `collectAllPages`, en vez de mirar solo la primera pagina.
 *
 * Los cuatro resolvers (entorno, stack, contenedor, sync de GitOps) comparten
 * esta forma exacta: buscar coincidencias, y si no hay ninguna, distinguir
 * entre "no lo he mirado todo" (cuando `collectAllPages` agota su tope) y "no
 * existe" (cuando si se ha visto la coleccion completa). Decir "no existe"
 * en el primer caso es la conclusion falsa que esta tarea elimina.
 */
async function resolveIdByName<T>(spec: {
  sort: string;
  fetchPage: (req: PageRequest) => Promise<PaginatedResponse<T>>;
  isMatch: (item: T) => boolean;
  getId: (item: T) => string;
  namesOf: (items: T[]) => string[];
  name: string;
  labels: ResolveByNameLabels;
}): Promise<string> {
  const { sort, fetchPage, isMatch, getId, namesOf, name, labels } = spec;
  const { singular, countNoun, foundNoun, idNoun, scope } = labels;

  const { items, complete, totalItems } = await collectAllPages(sort, fetchPage);
  const matches = items.filter(isMatch);

  if (matches.length === 0) {
    // Decir "no existe" habiendo mirado solo una parte es una conclusion falsa.
    if (!complete) {
      throw new Error(
        `No ${singular} found with name '${name}' among the first ${items.length} of ${totalItems} ` +
          `${countNoun}${scope}. Use the ${idNoun} instead.`
      );
    }
    throw new Error(
      `No ${singular} found with name '${name}'${scope}. Available ${countNoun}: ${listaDisponibles(namesOf(items))}`
    );
  }

  if (matches.length > 1) {
    const matchingIds = matches.map(getId).join(", ");
    throw new Error(
      `Multiple ${foundNoun} found with name '${name}'${scope}. Please use the ${idNoun} instead. Matching IDs: ${matchingIds}`
    );
  }

  return getId(matches[0]);
}

export async function resolveEnvironmentId(client: ArcaneClient, envId?: string, envName?: string): Promise<string> {
  if (envId) {
    return envId;
  }

  if (!envName) {
    throw new Error("Either environmentId or environmentName must be provided");
  }

  return resolveIdByName({
    sort: "name",
    // search es filtrado en servidor: reduce trabajo aunque igualmente se
    // recorra la coleccion completa para no fiarse de una sola pagina.
    fetchPage: (req) => client.environments.list({ search: envName, ...req }),
    isMatch: (env) => env.name === envName,
    getId: (env) => env.id,
    // env.name es opcional en el tipo; mismo comportamiento que el join() de
    // antes, que convertia undefined en cadena vacia.
    namesOf: (items) => items.map((env) => env.name ?? ""),
    name: envName,
    labels: {
      singular: "environment",
      countNoun: "environments",
      foundNoun: "environments",
      idNoun: "environment ID",
      scope: "",
    },
  });
}

export async function resolveStackId(
  client: ArcaneClient,
  envId: string,
  stackId?: string,
  stackName?: string
): Promise<string> {
  if (stackId) {
    return stackId;
  }

  if (!stackName) {
    throw new Error("Either stackId or stackName must be provided");
  }

  return resolveIdByName({
    sort: "name",
    fetchPage: (req) => client.stacks.list(envId, { search: stackName, ...req }),
    isMatch: (stack) => stack.name === stackName,
    getId: (stack) => stack.id,
    namesOf: (items) => items.map((stack) => stack.name),
    name: stackName,
    labels: {
      singular: "stack",
      countNoun: "stacks",
      foundNoun: "stacks",
      idNoun: "stack ID",
      scope: ` in environment '${envId}'`,
    },
  });
}

export async function resolveContainerId(
  client: ArcaneClient,
  envId: string,
  containerId?: string,
  containerName?: string
): Promise<string> {
  if (containerId) {
    return containerId;
  }

  if (!containerName) {
    throw new Error("Either containerId or containerName must be provided");
  }

  return resolveIdByName({
    sort: "name",
    // Sin `search`, a proposito: la semantica de ese parametro en este
    // endpoint no esta documentada en openapi.txt, y el match aqui es exacto
    // contra names[] con y sin barra inicial. Paginar lo hace correcto sin
    // cambiar que cuenta como coincidencia.
    fetchPage: (req) => client.containers.list(envId, req),
    isMatch: (container) =>
      container.names?.some((name) => name === `/${containerName}` || name === containerName) ?? false,
    getId: (container) => container.id,
    namesOf: (items) =>
      items.flatMap((container) => container.names ?? []).map((name) => name.replace(/^\//, "")),
    name: containerName,
    labels: {
      singular: "container",
      countNoun: "containers",
      foundNoun: "containers",
      idNoun: "container ID",
      scope: ` in environment '${envId}'`,
    },
  });
}

/** Reexportado para que gitops-syncs.ts comparta exactamente esta misma forma. */
export { resolveIdByName };
