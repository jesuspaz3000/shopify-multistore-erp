import { redirect } from 'next/navigation';

// Página que solo redirige: puede bloquear la navegación (no hay UI que mostrar al instante).
export const instant = false;

// /{tenant} -> vista consolidada de todas las tiendas.
export default async function TenantHomePage({ params }: PageProps<'/[tenant]'>) {
  const { tenant } = await params;
  redirect(`/${tenant}/all`);
}
