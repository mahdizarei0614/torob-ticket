import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { apiClient, directLoginClient } from '@torob-ticket/client';
import { DirectFlowSchema } from '@torob-ticket/contracts';
import { DirectLoginPage } from './direct-login-page';
function Navigation() { const navigate = useNavigate(); return <button onClick={() => void navigate('/direct-login/authorize/flow-b')}>Next flow</button>; }
describe('consent route authority', () => {
  it('hides old provider consent while a different flow is loading', async () => {
    const session = vi.spyOn(apiClient, 'session').mockResolvedValue({} as Awaited<ReturnType<typeof apiClient.session>>);
    const original = DirectFlowSchema.parse({ id: 'flow-a', providerId: 'demo-provider-01', providerName: 'راه‌آرا', referralId: 'referral-a', identity: { displayName: 'مسافر', phone: '+989000000001' }, existingProof: false, status: 'pending', expiresAt: '2026-11-04T16:00:00Z' });
    let resolveNext!: (result: typeof original) => void;
    const pending = new Promise<typeof original>(resolve => { resolveNext = resolve; });
    const flow = vi.spyOn(directLoginClient, 'flow').mockImplementation(id => id === 'flow-a' ? Promise.resolve(original) : pending);
    const consent = vi.spyOn(directLoginClient, 'consent');
    const rendered = render(<MemoryRouter initialEntries={['/direct-login/authorize/flow-a']}><Navigation /><Routes><Route path="/direct-login/authorize/:id" element={<DirectLoginPage />} /></Routes></MemoryRouter>);
    try {
      expect(await screen.findByRole('heading', { name: 'ادامه در راه‌آرا' })).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Next flow' }));
      expect(screen.queryByRole('button', { name: 'اجازه و ادامه' })).not.toBeInTheDocument(); expect(screen.queryByRole('heading', { name: 'ادامه در راه‌آرا' })).not.toBeInTheDocument(); expect(consent).not.toHaveBeenCalled();
      await act(async () => { resolveNext({ ...original, id: 'flow-b', providerName: 'سپهر سفر' }); await pending; });
      expect(await screen.findByRole('heading', { name: 'ادامه در سپهر سفر' })).toBeVisible();
    } finally { rendered.unmount(); session.mockRestore(); flow.mockRestore(); consent.mockRestore(); }
  });
});
