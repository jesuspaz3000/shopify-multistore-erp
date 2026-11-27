import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import { AuthFormSkeleton } from '@/components/skeletons';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import TextLink from '@/components/ui/TextLink';
import { getInvitationPreview } from '@/features/members/api/members.server';
import AcceptInvitationForm from '@/features/members/components/AcceptInvitationForm';

export const metadata: Metadata = { title: 'Invitación' };

export default function InvitePage({ params }: PageProps<'/invite/[token]'>) {
  return (
    <Suspense fallback={<AuthFormSkeleton fields={3} />}>
      <Invitation params={params} />
    </Suspense>
  );
}

async function Invitation({ params }: { params: PageProps<'/invite/[token]'>['params'] }) {
  const { token } = await params;
  const result = await getInvitationPreview(token);

  if ('error' in result) {
    return (
      <Stack spacing={2}>
        <Alert severity="warning" variant="outlined">
          {result.error} Pide a quien te invitó que genere un nuevo link.
        </Alert>
        <TextLink href="/login" sx={{ textAlign: 'center' }}>
          Ir a iniciar sesión
        </TextLink>
      </Stack>
    );
  }
  return <AcceptInvitationForm token={token} invitation={result.invitation} />;
}
