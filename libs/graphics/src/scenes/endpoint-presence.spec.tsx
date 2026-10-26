import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EndpointPresence, endpointEdgeOpacity, type EndpointSnapshot } from './endpoint-presence';

const endpoint = (id: string, role: 'origin' | 'destination' = 'origin'): EndpointSnapshot => ({ key: `${role}:${id}`, id, role, name: id, arrived: true, left: 100, top: 120, opacity: 1, text: { left: -66, top: -48 } });
describe('selected endpoint presence', () => {
  it('keeps clear/change exits decorative while live semantics remain unique, then removes on animation end', () => {
    const view = render(<EndpointPresence endpoints={[endpoint('a'), endpoint('b', 'destination')]} reducedMotion={false} />);
    view.rerender(<EndpointPresence endpoints={[endpoint('c')]} reducedMotion={false} />);
    expect(view.container.querySelectorAll('[data-journey-endpoint]')).toHaveLength(1);
    const ghosts = [...view.container.querySelectorAll('[data-endpoint-ghost]')]; expect(ghosts).toHaveLength(2);
    ghosts.forEach(ghost => { expect(ghost).toHaveAttribute('aria-hidden', 'true'); expect(ghost).not.toHaveAttribute('data-city-id'); expect(ghost).not.toHaveAttribute('data-journey-endpoint'); expect(ghost).toHaveStyle({ left: '100px', top: '120px' }); });
    fireEvent.animationEnd(ghosts[0]!.firstElementChild!); expect(view.container.querySelectorAll('[data-endpoint-ghost]')).toHaveLength(1);
  });
  it('bounds rapid replacements, retires same-city ghosts on reentry, and clears under reduced motion', () => {
    const view = render(<EndpointPresence endpoints={[endpoint('a')]} reducedMotion={false} />);
    for (let i = 0; i < 10; i++) view.rerender(<EndpointPresence endpoints={[endpoint(String(i))]} reducedMotion={false} />);
    expect(view.container.querySelectorAll('[data-endpoint-ghost]').length).toBeLessThanOrEqual(4);
    view.rerender(<EndpointPresence endpoints={[endpoint('8')]} reducedMotion={false} />);
    expect(view.container.querySelector('[data-exiting-city-id="8"]')).toBeNull(); expect(view.container.querySelectorAll('[data-city-id="8"]')).toHaveLength(1);
    view.rerender(<EndpointPresence endpoints={[]} reducedMotion />); expect(view.container.querySelector('[data-endpoint-ghost]')).toBeNull();
  });
  it('fades before the anchor leaves any viewport edge and can reveal on return', () => {
    expect(endpointEdgeOpacity(100, 100, 600, 400)).toBe(1);
    const half = endpointEdgeOpacity(21, 100, 600, 400); expect(half).toBeGreaterThan(0); expect(half).toBeLessThan(1);
    expect(endpointEdgeOpacity(-1, 100, 600, 400)).toBe(0); expect(endpointEdgeOpacity(100, 401, 600, 400)).toBe(0);
    expect(endpointEdgeOpacity(580, 100, 600, 400)).toBeCloseTo(endpointEdgeOpacity(20, 100, 600, 400));
  });
});
