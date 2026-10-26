import {randomUUID} from 'node:crypto';
import {AdminControlConfigSchema,AdminSetProviderOverrideInputSchema,AdminSetScenarioInputSchema,ProviderOverridePatchSchema,type AdminControlConfig,type AdminSetProviderOverrideInput,type AdminSetScenarioInput} from '@torob-ticket/contracts';
import {canonicalValue} from '@torob-ticket/domain';
import type {Prisma,PrismaClient} from './generated/client';
import {RepositoryError,scopedTransaction,type DataScope} from './scope';
import {sessionInfo} from './session-repository';
import {SearchRepository} from './search-repository';
import {DatePriceRepository} from './date-price-repository';
import {HotelRepository} from './hotel-repository';
const json=(value:unknown):Prisma.InputJsonValue=>JSON.parse(JSON.stringify(value));
export interface InvalidatedSessionWork {searchIds:string[];datePriceIds:string[];hotelSearchIds:string[]}
/** Caller owns the session lock and revision mutation. Completed source evidence is never rewritten. */
export async function invalidateSessionWork(db:PrismaClient,tx:Prisma.TransactionClient,scope:DataScope,now:Date,reason:string):Promise<InvalidatedSessionWork>{
 const searchIds=await new SearchRepository(db).invalidateInTransaction(tx,scope,now,reason);
 const datePriceIds=await new DatePriceRepository(db).invalidateInTransaction(tx,scope,now);
 const hotelSearchIds=await new HotelRepository(db).invalidateInTransaction(tx,scope,now,reason);
 const affected={searchIds,datePriceIds,hotelSearchIds};
 await tx.auditEvent.create({data:{sessionId:scope.sessionId,id:randomUUID(),kind:'configuration-work-invalidated',payload:json({reason,...affected}),createdAt:now}});
 return affected;
}
export class AdminControlsRepository{
 constructor(private readonly db:PrismaClient,private readonly providerIds:readonly string[]){this.providerIds=[...new Set(providerIds)].sort();}
 private async read(tx:Prisma.TransactionClient,scope:DataScope):Promise<AdminControlConfig>{
  const row=await tx.demoSession.findUniqueOrThrow({where:{id:scope.sessionId},include:{fixture:true,identity:true}});
  const overrides=await tx.providerOverride.findMany({where:{sessionId:scope.sessionId}});
  const session=sessionInfo(row);
  return AdminControlConfigSchema.parse({session,revision:session.scenarioRevision,providers:this.providerIds.map(providerId=>{const stored=overrides.find(o=>o.providerId===providerId);return {providerId,override:stored?ProviderOverridePatchSchema.parse(stored.payload):null};})});
 }
 get(scope:DataScope){return scopedTransaction(this.db,scope,tx=>this.read(tx,scope));}
 setScenario(scope:DataScope,input:AdminSetScenarioInput,now:Date){
  const parsed=AdminSetScenarioInputSchema.parse(input);
  return scopedTransaction(this.db,scope,async tx=>{
   const prior=await this.read(tx,scope);if(prior.revision!==parsed.baseRevision)throw new RepositoryError('MAPPING_COLLISION');
   if(prior.session.scenario===parsed.scenario)return prior;
   const revision=randomUUID();await tx.demoSession.update({where:{id:scope.sessionId},data:{scenario:parsed.scenario,scenarioRevision:revision}});
   const affected=await invalidateSessionWork(this.db,tx,scope,now,'scenario-changed');
   await tx.auditEvent.create({data:{sessionId:scope.sessionId,id:randomUUID(),kind:'admin-scenario-changed',payload:json({baseRevision:prior.revision,revision,previous:prior.session.scenario,scenario:parsed.scenario,affected}),createdAt:now}});
   return this.read(tx,scope);
  });
 }
 setProvider(scope:DataScope,providerId:string,input:AdminSetProviderOverrideInput,now:Date){
  const parsed=AdminSetProviderOverrideInputSchema.parse(input);
  return scopedTransaction(this.db,scope,async tx=>{
   const prior=await this.read(tx,scope);if(prior.revision!==parsed.baseRevision)throw new RepositoryError('MAPPING_COLLISION');
   const provider=prior.providers.find(p=>p.providerId===providerId);if(!provider)throw new RepositoryError('NOT_FOUND');
   const next=parsed.patch===null?null:ProviderOverridePatchSchema.parse({...provider.override,...parsed.patch});
   if(canonicalValue(next)===canonicalValue(provider.override))return prior;
   if(next===null)await tx.providerOverride.deleteMany({where:{sessionId:scope.sessionId,providerId}});
   else await tx.providerOverride.upsert({where:{sessionId_providerId:{sessionId:scope.sessionId,providerId}},create:{sessionId:scope.sessionId,providerId,payload:json(next)},update:{payload:json(next)}});
   const revision=randomUUID();await tx.demoSession.update({where:{id:scope.sessionId},data:{scenarioRevision:revision}});
   const affected=await invalidateSessionWork(this.db,tx,scope,now,'provider-override-changed');
   await tx.auditEvent.create({data:{sessionId:scope.sessionId,id:randomUUID(),kind:'admin-provider-override-changed',payload:json({providerId,baseRevision:prior.revision,revision,previous:provider.override,override:next,affected}),createdAt:now}});
   return this.read(tx,scope);
  });
 }
}
