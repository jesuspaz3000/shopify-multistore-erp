// Nombres visibles de los roles globales (los códigos vienen de la API).
const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  WAREHOUSE_MANAGER: 'Encargado de bodega',
  ACCOUNTANT: 'Contabilidad',
  VIEWER: 'Solo lectura',
};

export const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;
