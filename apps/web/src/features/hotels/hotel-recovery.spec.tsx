import {act,renderHook,waitFor} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import type {ApiClient} from '@torob-ticket/client';
import type {HotelSearchQuery,HotelSearchSnapshot} from '@torob-ticket/contracts';
import {useHotelDiscovery} from './use-hotel-discovery';
import {session} from '../search/search-test-data';
import {arrivalCatalog,arrivingTrip,arrivalSnapshot} from './arrival-hotel-test-data';

describe('automatic stay recovery authority',()=>{
 it('retains derived dates and selected reference while revoking a pending old authority revision',async()=>{
  const trip=arrivingTrip();let finish!:(value:HotelSearchSnapshot)=>void;
  const startHotelSearch=vi.fn((q:HotelSearchQuery)=>new Promise<HotelSearchSnapshot>(resolve=>{void q;finish=resolve;}));
  const client={startHotelSearch} as unknown as ApiClient;
  const hook=renderHook(({authorityKey,blocked})=>useHotelDiscovery({trip,catalog:arrivalCatalog,session,authorityKey,blocked,client}),{initialProps:{authorityKey:'old',blocked:false}});
  act(()=>hook.result.current.openDialog());await waitFor(()=>expect(startHotelSearch).toHaveBeenCalledTimes(1));
  const oldQuery=startHotelSearch.mock.calls[0]![0];
  hook.rerender({authorityKey:'new',blocked:true});
  expect(hook.result.current.state.draft).toMatchObject({checkIn:'2026-10-25',checkOut:'2026-10-26',rooms:1});expect(hook.result.current.open).toBe(true);expect(hook.result.current.authorityStale).toBe(true);
  await act(async()=>finish(arrivalSnapshot(oldQuery)));expect(hook.result.current.state.snapshot).toBeUndefined();expect(startHotelSearch).toHaveBeenCalledTimes(1);
 });
 it('allows a local sort preference while blocked but never mutates the stay until the session resumes',async()=>{
  const startHotelSearch=vi.fn(async(q:HotelSearchQuery)=>arrivalSnapshot(q)),trip=arrivingTrip();
  const hook=renderHook(({blocked})=>useHotelDiscovery({trip,catalog:arrivalCatalog,session,authorityKey:'session',blocked,client:{startHotelSearch} as unknown as ApiClient}),{initialProps:{blocked:true}});
  act(()=>hook.result.current.openDialog());act(()=>hook.result.current.edit({sort:'stars'}));await act(async()=>{});expect(hook.result.current.state.draft.sort).toBe('stars');expect(startHotelSearch).not.toHaveBeenCalled();
  hook.rerender({blocked:false});await waitFor(()=>expect(startHotelSearch).toHaveBeenCalledTimes(1));expect(startHotelSearch.mock.calls[0]![0]).toMatchObject({sort:'stars',rooms:1,checkIn:'2026-10-25',checkOut:'2026-10-26'});
 });
});
