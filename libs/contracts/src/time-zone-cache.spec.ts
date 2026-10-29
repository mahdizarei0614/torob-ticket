import {afterEach,expect,it,vi} from 'vitest';
import {IdSchema} from './common';
const NativeDateTimeFormat=Intl.DateTimeFormat;
afterEach(()=>{Intl.DateTimeFormat=NativeDateTimeFormat;vi.resetModules();});
async function coldSchema(){vi.resetModules();return(await import('./offer')).TimeZoneSchema;}
function observe(failureZone?:string){
 let calls=0;Intl.DateTimeFormat=new Proxy(NativeDateTimeFormat,{construct(target,args){calls++;if(args[1]?.timeZone===failureZone)throw new Error('engine-failure');return Reflect.construct(target,args,target);}});
 return()=>calls;
}
// Frozen pre-cache behavior: IdSchema still owns trim/type/length and no alias is rewritten.
const previous=IdSchema.refine(value=>{try{new NativeDateTimeFormat('en',{timeZone:value});return !/^[+-]/.test(value);}catch{return false;}},'invalid-time-zone');
it('keeps cold and cached wire outcomes identical for IANA names, aliases, UTC, offsets and malformed inputs',async()=>{
 const schema=await coldSchema();
 for(const input of ['Asia/Tehran','America/Los_Angeles','Pacific/Auckland','Asia/Calcutta','Asia/Kolkata','Etc/UTC','UTC','GMT','US/Eastern','  Asia/Tehran  ','No/Such_Zone','', '   ','+00:00','-08:00','+0330', '+03',0,null,{},'x'.repeat(201)]){
  const expected=previous.safeParse(input);for(let repeat=0;repeat<3;repeat++){
   const actual=schema.safeParse(input);expect(actual.success).toBe(expected.success);
   if(actual.success&&expected.success)expect(actual.data).toBe(expected.data);
   else if(!actual.success&&!expected.success)expect(actual.error.issues).toEqual(expected.error.issues);
  }
 }
});
it('avoids repeated native construction for positive, negative and offset validity while preserving original values',async()=>{
 const schema=await coldSchema(),calls=observe();
 for(let repeat=0;repeat<100;repeat++){expect(schema.parse('Asia/Tehran')).toBe('Asia/Tehran');expect(schema.safeParse('No/Such_Zone').success).toBe(false);expect(schema.safeParse('+00:00').success).toBe(false);}
 expect(calls()).toBe(3);expect(schema.parse('Asia/Calcutta')).toBe('Asia/Calcutta');expect(schema.parse('Asia/Kolkata')).toBe('Asia/Kolkata');expect(calls()).toBe(5);
});
it('bounds the cache to128entries, refreshes recent validity and revalidates evicted negatives',async()=>{
 const schema=await coldSchema(),calls=observe();for(let index=0;index<128;index++)expect(schema.safeParse(`Invalid/Zone_${index}`).success).toBe(false);expect(calls()).toBe(128);
 expect(schema.safeParse('Invalid/Zone_0').success).toBe(false);expect(calls()).toBe(128);
 expect(schema.safeParse('Invalid/Zone_128').success).toBe(false);expect(calls()).toBe(129);
 expect(schema.safeParse('Invalid/Zone_0').success).toBe(false);expect(calls()).toBe(129);
 expect(schema.safeParse('Invalid/Zone_1').success).toBe(false);expect(calls()).toBe(130);
 for(let index=129;index<600;index++)expect(schema.safeParse(`Invalid/Zone_${index}`).success).toBe(false);
 expect(schema.safeParse('Invalid/Zone_0').success).toBe(false);expect(calls()).toBe(602);
 expect(schema.safeParse('Invalid/Zone_0').success).toBe(false);expect(calls()).toBe(602);
});
it('retains caught Intl engine errors as the same invalid-time-zone issue on cold and cached parses',async()=>{
 const schema=await coldSchema(),calls=observe('Broken/Runtime');for(let repeat=0;repeat<3;repeat++){const result=schema.safeParse('Broken/Runtime');expect(result.success).toBe(false);if(!result.success)expect(result.error.issues.map(issue=>issue.message)).toEqual(['invalid-time-zone']);}
 expect(calls()).toBe(1);expect(schema.parse('UTC')).toBe('UTC');expect(calls()).toBe(2);
});
it('keeps IdSchema limits and non-string rejection before successful wire output',async()=>{
 const schema=await coldSchema(),calls=observe();expect(schema.safeParse({timeZone:'UTC'}).success).toBe(false);expect(calls()).toBe(0);
 const overlong='Invalid/'+ 'x'.repeat(201);expect(schema.safeParse(overlong).success).toBe(false);expect(schema.safeParse(overlong).success).toBe(false);expect(calls()).toBe(2);
 expect(schema.parse('  UTC  ')).toBe('UTC');expect(schema.parse('UTC')).toBe('UTC');expect(calls()).toBe(3);
});
