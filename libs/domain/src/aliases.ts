import type { AliasMapping } from './normalization-types';
/** Spelling only. Never infer a city, airport or station from a substring. */
export function cleanAlias(value:string):string { return value.normalize('NFC').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim(); }
export function resolveAlias(value:string,namespace:string,entity:AliasMapping['entityType'],candidates:readonly {id:string;name:string}[],mappings:readonly AliasMapping[]):string[] {
  // Explicit IDs are immutable identity, even if a label mapping collides.
  if(candidates.some(c=>c.id===value)) return [value];
  const cleaned=cleanAlias(value);
  return [...new Set([...candidates.filter(c=>cleanAlias(c.name)===cleaned).map(c=>c.id),...mappings.filter(m=>m.sourceNamespace===namespace&&m.entityType===entity&&cleanAlias(m.sourceValue)===cleaned).map(m=>m.targetId)])].sort();
}
