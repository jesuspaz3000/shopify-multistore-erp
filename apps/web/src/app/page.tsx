import { redirect } from 'next/navigation';

// Entrada de la app: el área privada decide (sin sesión -> /login, con sesión -> elegir empresa).
export default function HomePage() {
  redirect('/select-tenant');
}
