import type {QuoteSnapshot} from '@torob-ticket/contracts';
import type {Prisma} from './generated/client';
import type {DataScope} from './scope';
const key=(id:string,version:number)=>JSON.stringify([id,version]);
/** Caller holds the scoped projection transaction. Existing observations are immutable;
 * candidate order retains the original upsert(update:{}) first-wins behavior. */
export async function insertMissingTransportQuotes(tx:Prisma.TransactionClient,scope:DataScope,existing:readonly {id:string;version:number}[],candidates:readonly {offerId:string;quote:QuoteSnapshot}[]):Promise<void>{
 const seen=new Set(existing.map(row=>key(row.id,row.version))),data:Prisma.QuoteCreateManyInput[]=[];
 for(const {offerId,quote}of candidates){
  const identity=key(quote.quoteId,quote.version);if(seen.has(identity))continue;seen.add(identity);
  data.push({sessionId:scope.sessionId,id:quote.quoteId,version:quote.version,offerId,payload:JSON.parse(JSON.stringify(quote)) as Prisma.InputJsonValue,observedAt:new Date(quote.observedAt),expiresAt:new Date(quote.expiresAt)});
 }
 if(data.length)await tx.quote.createMany({data});
}
