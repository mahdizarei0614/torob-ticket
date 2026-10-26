import { errorPolicy } from '@torob-ticket/client';
import { RecoveryState } from '@torob-ticket/ui';
export function AdminRecovery({ error, retry, resume, busy = false }: { error: unknown; retry: () => void; resume?: () => void; busy?: boolean }) {
  const policy = errorPolicy(error, 'read');
  return <RecoveryState language="en" label="Operations recovery" title={policy.title.en} description={policy.detail.en} tone="warning" busy={busy} actions={[policy.kind === 'expired' && resume ? { id: 'resume', label: 'Resume session', onPress: resume } : { id: 'read', label: 'Retry reading activity', onPress: retry }]} />;
}
