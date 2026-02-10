/**
 * Utilitaires pour gérer la pagination de manière centralisée
 */

export interface PaginationParams {
  page?: number | string;
  limit?: number | string;
}

export interface PaginationOptions {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Parse et valide les paramètres de pagination
 * Convertit les strings en numbers et applique les valeurs par défaut
 */
export function parsePaginationParams(
  params: PaginationParams = {},
  options: PaginationOptions = {},
): PaginationResult {
  const { defaultPage = 1, defaultLimit = 10, maxLimit = 100 } = options;

  // Convertir et valider page
  let page =
    typeof params.page === 'string' ? parseInt(params.page, 10) : params.page;

  if (!page || isNaN(page) || page < 1) {
    page = defaultPage;
  }

  // Convertir et valider limit
  let limit =
    typeof params.limit === 'string'
      ? parseInt(params.limit, 10)
      : params.limit;

  if (!limit || isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  }

  // Appliquer la limite maximale
  if (limit > maxLimit) {
    limit = maxLimit;
  }

  // Calculer skip
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
}

/**
 * Construire une réponse paginée standard
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  paginationParams: PaginationResult,
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      total,
      page: paginationParams.page,
      limit: paginationParams.limit,
      totalPages: Math.ceil(total / paginationParams.limit),
    },
  };
}
