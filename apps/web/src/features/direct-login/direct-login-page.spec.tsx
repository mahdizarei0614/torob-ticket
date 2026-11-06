import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { apiClient, directLoginClient } from '@torob-ticket/client';
import { DirectFlowSchema, type TravelerProfile, type TravelContext } from '@torob-ticket/contracts';
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

const domesticProfile: TravelerProfile = { givenName: 'سارا', familyName: 'احمدی', birthDate: '1992-03-04', gender: 'female', nationality: 'IR', nationalId: '0012345678' };
const internationalProfile: TravelerProfile = { ...domesticProfile, nationalId: undefined, latinGivenName: 'Sara', latinFamilyName: 'Ahmadi', passport: { number: 'A12345678', issuingCountry: 'IR', expiresOn: '2030-01-01' } };
const internationalTrip: TravelContext = { international: true, travelDate: '2027-01-01', lastTravelDate: '2027-01-10' };
function profileFlow(profile: TravelerProfile, context: TravelContext | null) {
  const session = vi.spyOn(apiClient, 'session').mockResolvedValue({} as Awaited<ReturnType<typeof apiClient.session>>);
  const value = DirectFlowSchema.parse({ id: 'profile-flow', providerId: 'demo-provider-01', providerName: 'راه‌آرا', referralId: 'referral-profile', identity: { displayName: 'مسافر', phone: '+989000000001', profile }, existingProof: false, status: 'pending', expiresAt: '2030-01-01T00:00:00Z', profileRequired: true, travelContext: context });
  const flow = vi.spyOn(directLoginClient, 'flow').mockResolvedValue(value);
  const rendered = render(<MemoryRouter initialEntries={['/direct-login/authorize/profile-flow']}><Routes><Route path="/direct-login/authorize/:id" element={<DirectLoginPage />} /></Routes></MemoryRouter>);
  return () => { rendered.unmount(); session.mockRestore(); flow.mockRestore(); };
}

describe('current-trip traveler requirements', () => {
  it('allows a phone-only flow after editing a previous traveler flow', async () => {
    const session = vi.spyOn(apiClient, 'session').mockResolvedValue({} as Awaited<ReturnType<typeof apiClient.session>>);
    const traveler = DirectFlowSchema.parse({ id: 'flow-a', providerId: 'demo-provider-01', providerName: 'راه‌آرا', referralId: 'referral-a', identity: { displayName: 'مسافر', phone: '+989000000001', profile: internationalProfile }, existingProof: false, status: 'pending', expiresAt: '2030-01-01T00:00:00Z', profileRequired: true, travelContext: internationalTrip });
    const phone = { ...traveler, id: 'flow-b', providerName: 'سپهر سفر', profileRequired: false, travelContext: null };
    const flow = vi.spyOn(directLoginClient, 'flow').mockImplementation(id => Promise.resolve(id === 'flow-a' ? traveler : phone));
    const rendered = render(<MemoryRouter initialEntries={['/direct-login/authorize/flow-a']}><Navigation /><Routes><Route path="/direct-login/authorize/:id" element={<DirectLoginPage />} /></Routes></MemoryRouter>);
    try {
      fireEvent.click(await screen.findByRole('button', { name: 'ویرایش مشخصات مسافر' }));
      expect(screen.getByLabelText('نام لاتین', { exact: true })).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Next flow' }));
      await screen.findByRole('heading', { name: 'ادامه در سپهر سفر' });
      expect(screen.queryByRole('button', { name: 'ذخیره مشخصات مسافر' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'اجازه و ادامه' })).toBeEnabled();
    } finally { rendered.unmount(); session.mockRestore(); flow.mockRestore(); }
  });

  it.each([
    { title: 'stored domestic profile', profile: domesticProfile },
    { title: 'passport without English names', profile: { ...domesticProfile, passport: internationalProfile.passport } },
    { title: 'expired passport', profile: { ...internationalProfile, passport: { ...internationalProfile.passport!, expiresOn: '2020-01-01' } } },
  ])('requests missing international fields for $title', async ({ profile }) => {
    const dispose = profileFlow(profile, internationalTrip);
    try {
      expect(await screen.findByLabelText('نام لاتین', { exact: true })).toBeVisible();
      expect(screen.getByLabelText('شماره گذرنامه', { exact: true })).toBeVisible();
      expect(screen.getByLabelText('نام', { exact: true })).toHaveValue(domesticProfile.givenName);
      expect(screen.getByRole('button', { name: 'اجازه و ادامه' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'انصراف' })).toBeEnabled();
    } finally { dispose(); }
  });

  it('requests the national ID when a passport-only customer switches back to domestic travel', async () => {
    const dispose = profileFlow(internationalProfile, { ...internationalTrip, international: false });
    try {
      expect(await screen.findByLabelText('کد ملی', { exact: true })).toBeVisible();
      expect(screen.queryByLabelText('شماره گذرنامه', { exact: true })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'اجازه و ادامه' })).toBeDisabled();
    } finally { dispose(); }
  });

  it('previews English names and the approved passport before allowing an existing complete profile', async () => {
    const dispose = profileFlow({ ...internationalProfile, nationalId: domesticProfile.nationalId }, internationalTrip);
    try {
      expect(await screen.findByText('Sara')).toBeVisible();
      expect(screen.getByText('Ahmadi')).toBeVisible(); expect(screen.getByText('A12345678')).toBeVisible();
      expect(screen.queryByText('0012345678')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'اجازه و ادامه' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'ذخیره مشخصات مسافر' })).not.toBeInTheDocument();
    } finally { dispose(); }
  });

  it('keeps consent unavailable when required travel context is missing', async () => {
    const dispose = profileFlow(internationalProfile, null);
    try {
      await screen.findByRole('heading', { name: 'ادامه در راه‌آرا' });
      expect(screen.getByRole('button', { name: 'اجازه و ادامه' })).toBeDisabled();
    } finally { dispose(); }
  });
});
