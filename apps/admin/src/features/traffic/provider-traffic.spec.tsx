import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router';
import {ThemeProvider} from '@torob-ticket/ui';
import type {ProviderTraffic} from '@torob-ticket/contracts';
import {ClientError} from '@torob-ticket/client';
import {AdminState} from '../../admin-state';
import {ProviderTrafficDashboard} from './provider-traffic';

const mocks=vi.hoisted(()=>({session:vi.fn(),catalogReadonly:vi.fn(),config:vi.fn(),traffic:vi.fn(),setProviderTariff:vi.fn()}));
vi.mock('@torob-ticket/client',async()=>{const actual=await vi.importActual<typeof import('@torob-ticket/client')>('@torob-ticket/client');return {...actual,apiClient:{...actual.apiClient,session:mocks.session,catalogReadonly:mocks.catalogReadonly},adminClient:{...actual.adminClient,config:mocks.config,traffic:mocks.traffic,setProviderTariff:mocks.setProviderTariff}};});
const counts={outbound:3,uniqueVisitorSessions:1,billable:1,repeats:2,knownFeeRial:0,unpricedBillable:1,transport:3,hotel:0};
const tariff={providerId:'demo-provider-01',revision:'tariff-one',updatedAt:null,tiers:[{upTo:100,rateRial:null},{upTo:1000,rateRial:null},{upTo:null,rateRial:null}]};
const snapshot:ProviderTraffic={period:{monthKey:'1405-08',currentMonthKey:'1405-08',from:'2026-10-22T20:30:00.000Z',to:'2026-11-03T12:00:00.000Z',calendar:'persian',timeZone:'Asia/Tehran'},policy:{windowMinutes:60,pricing:'graduated',uniqueVisitorBasis:'visitor-session',eventBasis:'redirect-issued'},totals:counts,providers:[{providerId:'demo-provider-01',counts,lastOutboundAt:'2026-11-03T11:00:00.000Z',tariff,billingMonthBillable:1}],daily:[{date:'2026-11-03',counts}],events:{offset:0,limit:25,total:1,items:[{referralId:'ref-one',providerId:'demo-provider-01',kind:'transport',redirectedAt:'2026-11-03T11:00:00.000Z',billable:true,reason:'eligible',monthKey:'1405-08',monthOrdinal:1,rateRial:null,tariffRevision:'tariff-one',tierIndex:0}]},availableMonths:['1405-08']};
const config={session:{seed:1,anchorInstant:'2026-11-03T00:00:00Z',scenario:'normal',fixtureVersion:'showcase-v1',catalogRevision:'catalog-v1',mappingRevision:'mapping-v1',scenarioRevision:'revision-one',expiresAt:'2026-12-01T00:00:00Z',identity:null},revision:'revision-one',providers:[{providerId:'demo-provider-01',override:null}]};
function mount(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><ThemeProvider language="en" variant="admin"><MemoryRouter><AdminState><ProviderTrafficDashboard/></AdminState></MemoryRouter></ThemeProvider></QueryClientProvider>);}
beforeEach(()=>{vi.resetAllMocks();mocks.session.mockResolvedValue(config.session);mocks.catalogReadonly.mockResolvedValue({providerCapabilities:[{providerId:'demo-provider-01',name:'Provider One'}]});mocks.config.mockResolvedValue(config);mocks.traffic.mockResolvedValue(snapshot);mocks.setProviderTariff.mockResolvedValue({...tariff,revision:'tariff-two'});});

it('shows actual traffic separately from unpriced billable fees and preserves evidence links',async()=>{
 mount();expect(await screen.findByRole('table',{name:'Provider referral traffic'})).toBeInTheDocument();
 const totals=screen.getByLabelText('Traffic totals');expect(totals).toHaveTextContent('Outbound referrals3');expect(totals).toHaveTextContent('Unique visitor sessions1');expect(totals).toHaveTextContent('Unpriced');expect(totals).toHaveTextContent('had no rate when recorded');
 expect(screen.getByRole('link',{name:'View referral'})).toHaveAttribute('href','/referrals/ref-one');
 expect(screen.getByRole('progressbar')).toHaveAccessibleName(/all types|billable referrals/);
 expect(screen.getByRole('img',{name:/Daily outbound/})).toBeInTheDocument();
});

it('does not use a current tariff to predict rates for a closed billing month',async()=>{
 mocks.traffic.mockResolvedValue({...snapshot,period:{...snapshot.period,monthKey:'1405-07'},availableMonths:['1405-08','1405-07'],providers:[{...snapshot.providers[0]!,billingMonthBillable:500,tariff:{...tariff,tiers:[{upTo:100,rateRial:1000},{upTo:1000,rateRial:2000},{upTo:null,rateRial:3000}]}}]});
 mount();expect(await screen.findByText('Closed month · fees use recorded rates')).toBeInTheDocument();expect(screen.getByText('500 billable in Mehr 1405')).toBeInTheDocument();
 expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();expect(screen.queryByText(/Next billable referral · tier/)).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:/Set referral pricing/})).toBeInTheDocument();
});

it('sends shared provider/type filters and resets the event offset without making local metric guesses',async()=>{
 mount();await screen.findByRole('table',{name:'Provider referral traffic'});
 fireEvent.change(screen.getByLabelText('Provider'),{target:{value:'demo-provider-01'}});
 fireEvent.change(screen.getByLabelText('Referral type'),{target:{value:'hotel'}});
 await waitFor(()=>expect(mocks.traffic).toHaveBeenLastCalledWith(expect.objectContaining({providerId:'demo-provider-01',kind:'hotel',offset:0,limit:25}),expect.any(AbortSignal)));
});

it('does not invent chart activity or future fees for an empty period',async()=>{
 const empty={...counts,outbound:0,billable:0,repeats:0,uniqueVisitorSessions:0,unpricedBillable:0,transport:0};
 mocks.traffic.mockResolvedValue({...snapshot,totals:empty,daily:[],events:{...snapshot.events,total:0,items:[]},providers:[{...snapshot.providers[0]!,counts:empty,billingMonthBillable:0,lastOutboundAt:null}]});
 mount();expect(await screen.findByText('No outbound referrals in this period')).toBeInTheDocument();expect(screen.queryByRole('img',{name:/Daily outbound/})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:/Set referral pricing/})).toBeEnabled();
});

it('keeps the current-month reset available after a rejected custom range',async()=>{
 mount();await screen.findByRole('table',{name:'Provider referral traffic'});
 mocks.traffic.mockRejectedValueOnce(new Error('The dates are outside the selected billing month.'));
 fireEvent.click(screen.getByRole('button',{name:'Custom dates'}));
 fireEvent.change(screen.getByLabelText('From date'),{target:{value:'2026-12-01'}});fireEvent.change(screen.getByLabelText('Through date'),{target:{value:'2026-12-02'}});fireEvent.click(screen.getByRole('button',{name:'Apply dates'}));
 await screen.findByRole('button',{name:'Retry reading activity'});
 const reset=screen.getByRole('button',{name:'Current month'});expect(reset).toBeEnabled();fireEvent.click(reset);
 expect(await screen.findByRole('table',{name:'Provider referral traffic'})).toBeInTheDocument();
 expect(screen.queryByLabelText('From date')).not.toBeInTheDocument();
});

it('saves exact future tier rates once while a duplicate submission is pending',async()=>{
 let finish!:(value:typeof tariff)=>void;mocks.setProviderTariff.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
 mount();fireEvent.click(await screen.findByRole('button',{name:/Set referral pricing/}));
 const dialog=screen.getByRole('dialog');fireEvent.change(within(dialog).getByLabelText('Tier 1 fee in toman'),{target:{value:'0'}});fireEvent.change(within(dialog).getByLabelText('Tier 2 fee in toman'),{target:{value:'100.1'}});
 const submit=within(dialog).getByRole('button',{name:'Save future rates'});fireEvent.click(submit);fireEvent.click(submit);
 expect(mocks.setProviderTariff).toHaveBeenCalledTimes(1);expect(mocks.setProviderTariff).toHaveBeenCalledWith('demo-provider-01',{baseRevision:'tariff-one',tiers:[{upTo:100,rateRial:0},{upTo:1000,rateRial:1001},{upTo:null,rateRial:null}]});
 finish(tariff);await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('keeps an optimistic revision failure visible in the editor with the entered rates intact',async()=>{
 mocks.setProviderTariff.mockRejectedValue(new ClientError('api','IDEMPOTENCY_CONFLICT',{code:'IDEMPOTENCY_CONFLICT',fieldPaths:[],retryable:false,requestId:'tariff-conflict'},409));
 mount();fireEvent.click(await screen.findByRole('button',{name:/Set referral pricing/}));const dialog=screen.getByRole('dialog');
 const rate=within(dialog).getByLabelText('Tier 1 fee in toman');fireEvent.change(rate,{target:{value:'12.3'}});fireEvent.click(within(dialog).getByRole('button',{name:'Save future rates'}));
 expect(await within(dialog).findByRole('alert')).toHaveTextContent('Pricing changed');expect(rate).toHaveValue('12.3');expect(within(dialog).getByRole('button',{name:'Close and refresh pricing'})).toBeEnabled();
});
