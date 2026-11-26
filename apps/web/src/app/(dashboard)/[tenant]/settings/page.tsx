import { redirect } from 'next/navigation';

// Página que solo redirige: puede bloquear la navegación.
export const instant = false;

// /{tenant}/settings -> primera pestaña (Tiendas).
export default async function SettingsPage({ params }: PageProps<'/[tenant]/settings'>) {
  const { tenant } = await params;
  redirect(`/${tenant}/settings/shops`);
}
