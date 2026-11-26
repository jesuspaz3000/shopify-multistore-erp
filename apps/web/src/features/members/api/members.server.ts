import 'server-only';

import type {
  InvitationPreviewResponse,
  InvitationResponse,
  MemberResponse,
  Paginated,
  PaginationQuery,
  RoleOptionResponse,
  RoleResponse,
} from '@erp/contracts';
import { cache } from 'react';
import { ApiError } from '@/lib/http/errors';
import { getServerHttp } from '@/lib/http/server';
import { toApiParams } from '@/lib/table-query';

const base = (tenant: string) => `/tenants/${encodeURIComponent(tenant)}`;

export async function getMembersPage(tenant: string, query: PaginationQuery) {
  return (await getServerHttp()).get<Paginated<MemberResponse>>(`${base(tenant)}/members`, toApiParams(query));
}

export async function getInvitationsPage(tenant: string, query: PaginationQuery) {
  return (await getServerHttp()).get<Paginated<InvitationResponse>>(`${base(tenant)}/invitations`, toApiParams(query));
}

export async function getRolesPage(tenant: string, query: PaginationQuery) {
  return (await getServerHttp()).get<Paginated<RoleResponse>>(`${base(tenant)}/roles`, toApiParams(query));
}

/** Todos los roles (selectores de rol al invitar o editar un miembro). */
export const getRoleOptions = cache(async (tenant: string) =>
  (await getServerHttp()).get<RoleOptionResponse[]>(`${base(tenant)}/roles/options`),
);

/** Invitación pública por token; si no sirve (no existe, venció, ya se usó) devuelve el motivo. */
export async function getInvitationPreview(
  token: string,
): Promise<{ invitation: InvitationPreviewResponse } | { error: string }> {
  try {
    const http = await getServerHttp();
    return { invitation: await http.get<InvitationPreviewResponse>(`/invitations/${encodeURIComponent(token)}`) };
  } catch (error) {
    if (error instanceof ApiError && [400, 404, 410].includes(error.status)) {
      return { error: error.status === 410 ? error.message : 'El link de invitación no es válido.' };
    }
    if (error instanceof ApiError && error.status === 429) return { error: error.message };
    throw error;
  }
}
