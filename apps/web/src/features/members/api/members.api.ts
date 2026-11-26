import type {
  AcceptInvitationData,
  AcceptInvitationResponse,
  CreatedInvitationResponse,
  InviteMemberData,
  RoleData,
  UpdateMemberData,
} from '@erp/contracts';
import { http } from '@/lib/http';

// Mutaciones de usuarios e invitaciones (Client Components). Luego: router.refresh().
const base = (tenant: string) => `/tenants/${encodeURIComponent(tenant)}`;

export const inviteMember = (tenant: string, input: InviteMemberData) =>
  http.post<CreatedInvitationResponse>(`${base(tenant)}/invitations`, input);

export const resendInvitation = (tenant: string, id: number) =>
  http.post<CreatedInvitationResponse>(`${base(tenant)}/invitations/${id}/resend`);

export const revokeInvitation = (tenant: string, id: number) => http.delete<void>(`${base(tenant)}/invitations/${id}`);

export const updateMember = (tenant: string, tenantUserId: number, input: UpdateMemberData) =>
  http.patch<void>(`${base(tenant)}/members/${tenantUserId}`, input);

export const removeMember = (tenant: string, tenantUserId: number) =>
  http.delete<void>(`${base(tenant)}/members/${tenantUserId}`);

export const createRole = (tenant: string, input: RoleData) => http.post<void>(`${base(tenant)}/roles`, input);

export const updateRole = (tenant: string, roleId: number, input: RoleData) =>
  http.patch<void>(`${base(tenant)}/roles/${roleId}`, input);

export const deleteRole = (tenant: string, roleId: number) => http.delete<void>(`${base(tenant)}/roles/${roleId}`);

export const acceptInvitation =(token: string, input: AcceptInvitationData) =>
  http.post<AcceptInvitationResponse>(`/invitations/${encodeURIComponent(token)}/accept`, input);
