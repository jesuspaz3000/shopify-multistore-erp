import type { Metadata } from 'next';
import ComingSoon from '@/components/layout/ComingSoon';

export const metadata: Metadata = { title: 'Transferencias' };

export default function TransfersPage() {
  return (
    <ComingSoon
      title="Transferencias"
      description="Mueve stock entre tus bodegas con trazabilidad."
      items={['Transferencia con bodega de origen y destino.', 'Envío: el stock sale del origen y queda en camino (incoming).', 'Recepción en destino y registro en el kardex de ambas bodegas.']}
    />
  );
}