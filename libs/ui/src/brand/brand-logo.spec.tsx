import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { BrandLogo } from './brand-logo';

it('provides localized standalone identities and one home-link name when decorative', () => {
  const view = render(<><BrandLogo /><BrandLogo language="en" /><a href="/" aria-label="ترب تیکت، خانه"><BrandLogo decorative /></a></>);
  expect(screen.getByRole('img', { name: 'ترب تیکت', exact: true })).toBeVisible();
  expect(screen.getByRole('img', { name: 'TorobTicket', exact: true })).toBeVisible();
  const home = screen.getByRole('link', { name: 'ترب تیکت، خانه', exact: true });
  expect(home.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  expect(view.container.querySelectorAll('svg text')).toHaveLength(0);
});
