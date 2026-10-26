import { describe, expect, it } from 'vitest';
import { priceCardId, priceCards } from './price-cards';
import { group } from './results-test-data';

describe('exact-price card projections', () => {
  it('separates totals globally while keeping equal-price sellers and every fare variant', () => {
    const a = group('a',100), b = group('b',150);
    const quote = a.eligibleQuotes[0]!;
    a.eligibleQuotes.push(
      {...structuredClone(quote),quoteId:'same-total',providerId:'second'},
      {...structuredClone(quote),quoteId:'same-provider-fare',fareId:'refundable',conditions:{outbound:{...quote.conditions.outbound,refundable:{status:'known',value:true}}}},
      {...structuredClone(quote),quoteId:'higher',total:{currency:'IRR',amountRial:200}},
    );
    const before = JSON.stringify([a,b]);
    const cards = priceCards([a,b],'cheapest');
    expect(cards.map(card=>[card.group.groupId,card.group.eligibleQuotes[0]!.total.amountRial])).toEqual([['a',100],['b',150],['a',200]]);
    expect(cards[0]!.group.eligibleQuotes.map(quote=>quote.quoteId)).toEqual(['a-quote','same-provider-fare','same-total']);
    expect(cards[2]!.group.representativeQuoteId).toBe('higher');
    expect(new Set(cards.map(card=>card.id)).size).toBe(3);
    expect(cards[2]!.id).toBe(priceCardId('a',a.eligibleQuotes.at(-1)));
    expect(JSON.stringify([a,b])).toBe(before);
  });

  it('orders every price bucket by duration and connections under the chosen transport sort', () => {
    const slow=group('slow',100),fast=group('fast',150),direct=group('direct',300);
    slow.durationMinutes=200;slow.connectionCount=1;
    fast.durationMinutes=100;fast.connectionCount=2;
    direct.durationMinutes=250;direct.connectionCount=0;
    fast.eligibleQuotes.push({...structuredClone(fast.eligibleQuotes[0]!),quoteId:'fast-high',total:{currency:'IRR',amountRial:400}});
    expect(priceCards([slow,fast,direct],'fastest').map(card=>card.group.representativeQuoteId)).toEqual(['fast-quote','fast-high','slow-quote','direct-quote']);
    expect(priceCards([slow,fast,direct],'fewest-connections').map(card=>card.group.representativeQuoteId)).toEqual(['direct-quote','slow-quote','fast-quote','fast-high']);
  });

  it('retains incomplete-only evidence without giving it a price or selectable quote', () => {
    const unknown=group('unknown');unknown.eligibleQuotes=[];unknown.representativeQuoteId=undefined;
    const cards=priceCards([unknown,group('priced')],'cheapest');
    expect(cards[1]!.source).toBe(unknown);
    expect(cards[1]!.group).toBe(unknown);
    expect(cards[1]!.group.eligibleQuotes).toEqual([]);
    expect(cards[1]!.id).toBe(priceCardId('unknown'));
  });
});
