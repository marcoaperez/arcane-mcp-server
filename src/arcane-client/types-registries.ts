/**
 * Registro de contenedor. Medido el 2026-08-19 contra Arcane 2.8.0 con sondas
 * `generic` y `ecr`: la respuesta NO incluye `token` ni `awsSecretAccessKey`
 * -no es que vengan enmascarados, es que el campo no existe-, y por eso las
 * lecturas se exponen. `awsAccessKeyId` si viene: es un identificador.
 */
export interface ContainerRegistry {
  id: string;
  url: string;
  username: string;
  insecure: boolean;
  enabled: boolean;
  registryType: string;
  repositoryNames: string[] | null;
  createdAt: string;
  updatedAt: string;
  description?: string;
  awsAccessKeyId?: string;
  awsRegion?: string;
}

export interface RegistryPullUsage {
  registryId: string;
  provider: string;
  registry: string;
  displayName: string;
  observedPulls: number;
  authMethod: string;
  checkedAt: string;
  authUsername?: string;
  error?: string;
  limit?: number;
  remaining?: number;
  repository?: string;
  source?: string;
  used?: number;
  windowSeconds?: number;
}

export interface RegistryPullUsageResponse {
  registries: RegistryPullUsage[] | null;
}

/**
 * Respuesta de los endpoints que devuelven un mensaje. NO es `ActionResponse`:
 * medido, el mensaje viene anidado bajo `data`, no en la raiz.
 */
export interface MessageResponse {
  success: boolean;
  data: { message: string };
}

/**
 * Registro de plantillas: un catalogo de plantillas por URL. A diferencia de
 * ContainerRegistry, NO guarda credenciales de ningun tipo -medido contra el
 * spec y contra la instancia-, asi que su CRUD se expone entero.
 */
export interface TemplateRegistry {
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  url: string;
  lastFetchError?: string;
}

export interface TemplateRegistryInput {
  name: string;
  url: string;
  description: string;
  enabled: boolean;
}

