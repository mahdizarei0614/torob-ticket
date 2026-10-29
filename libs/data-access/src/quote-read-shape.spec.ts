import {expect,it,vi} from 'vitest';
import type {Prisma,PrismaClient} from './generated/client';
import {SearchSnapshotSchema} from '@torob-ticket/contracts';
import {SearchRepository} from './search-repository';
import {DatePriceRepository} from './date-price-repository';
const query={mode:'flight',scope:'domestic',originCityId:'a',destinationCityId:'b',tripType:'one-way',departureDate:'2026-11-01',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
const snapshot=SearchSnapshotSchema.parse({searchId:'run',query,clientGeneration:'generation',status:'collecting',groups:[],providerStatuses:[],coverage:{expectedProviderIds:[],successfulProviderIds:[],failedProviderIds:[],pendingProviderIds:[],complete:false},observedAt:'2026-10-29T12:00:00Z'});
const allOffers=[{sessionId:'owner',searchId:'run',id:'offer-a'},{sessionId:'owner',searchId:'run',id:'offer-b'},{sessionId:'owner',searchId:'other',id:'offer-c'},{sessionId:'other-reviewer',searchId:'run',id:'offer-a'}];
const allQuotes=[
 {sessionId:'owner',offerId:'offer-a',payload:{quoteId:'q-a',version:1,observedAt:'original-one',expiresAt:'expired-one'}},
 {sessionId:'owner',offerId:'offer-a',payload:{quoteId:'q-a',version:2,observedAt:'original-two',expiresAt:'future-two'}},
 {sessionId:'owner',offerId:'offer-b',payload:{quoteId:'q-b',version:1,observedAt:'original-three',expiresAt:'future-three'}},
 {sessionId:'owner',offerId:'offer-c',payload:{quoteId:'other-run',version:1}},
 {sessionId:'other-reviewer',offerId:'offer-a',payload:{quoteId:'q-a',version:1,observedAt:'other-reviewer'}},
 {sessionId:'owner',offerId:null,payload:{quoteId:'hotel-only',version:1}},
];
it.each(['search','date'] as const)('%s projection reads the exact scoped loaded-offer quote set without a relation join or version/expiry filtering',async kind=>{
 const offers=allOffers.filter(row=>row.sessionId==='owner'&&row.searchId==='run').map(row=>({...row,payload:{},createdAt:new Date('2026-10-29T12:00:00Z')}));
 const tx={$queryRaw:vi.fn(async()=>[{id:'owner'}]),searchRun:{findUnique:vi.fn(async()=>({status:'collecting',snapshot}))},datePriceRun:{findUnique:vi.fn(async()=>({payload:{evidenceSearchId:'run',snapshot:{status:'checking'},sequence:0}}))},offerSnapshot:{findMany:vi.fn(async()=>offers)},quote:{findMany:vi.fn(async(args:{where:{sessionId:string;offerId:{in:string[]}}})=>allQuotes.filter(row=>row.sessionId===args.where.sessionId&&row.offerId!==null&&args.where.offerId.in.includes(row.offerId)))}};
 const db={$transaction:async(work:(value:Prisma.TransactionClient)=>Promise<unknown>)=>work(tx as unknown as Prisma.TransactionClient)}as unknown as PrismaClient;
 const stop=new Error('captured-after-query');let captured:unknown[]=[];const build=vi.fn((input:{quotes:unknown[]})=>{captured=input.quotes;throw stop;});
 const work=kind==='search'?new SearchRepository(db).project({sessionId:'owner'},'run',new Date(),build):new DatePriceRepository(db).project({sessionId:'owner'},'run',new Date(),()=>{},build);
 await expect(work).rejects.toBe(stop);expect(tx.quote.findMany).toHaveBeenCalledWith({where:{sessionId:'owner',offerId:{in:['offer-a','offer-b']}}});
 const expected=allQuotes.filter(quote=>quote.sessionId==='owner'&&allOffers.some(offer=>offer.sessionId===quote.sessionId&&offer.id===quote.offerId&&offer.searchId==='run')).map(row=>row.payload);
 expect(captured.map(value=>JSON.stringify(value)).sort()).toEqual(expected.map(value=>JSON.stringify(value)).sort());expect(captured).toHaveLength(3);
});
it.each(['search','date'] as const)('%s projection skips quote SQL entirely when no owned offers have been loaded',async kind=>{
 const tx={$queryRaw:vi.fn(async()=>[{id:'owner'}]),searchRun:{findUnique:vi.fn(async()=>({status:'collecting',snapshot}))},datePriceRun:{findUnique:vi.fn(async()=>({payload:{evidenceSearchId:'run',snapshot:{status:'checking'},sequence:0}}))},offerSnapshot:{findMany:vi.fn(async()=>[])},quote:{findMany:vi.fn(async()=>{throw new Error('must not query empty relation');})}};
 const db={$transaction:async(work:(value:Prisma.TransactionClient)=>Promise<unknown>)=>work(tx as unknown as Prisma.TransactionClient)}as unknown as PrismaClient;
 const stop=new Error('captured-empty-quotes'),build=vi.fn((input:{quotes:unknown[]})=>{expect(input.quotes).toEqual([]);throw stop;});
 const work=kind==='search'?new SearchRepository(db).project({sessionId:'owner'},'run',new Date(),build):new DatePriceRepository(db).project({sessionId:'owner'},'run',new Date(),()=>{},build);
 await expect(work).rejects.toBe(stop);expect(tx.quote.findMany).not.toHaveBeenCalled();expect(build).toHaveBeenCalledOnce();
});
