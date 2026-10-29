import type {Mode} from '@torob-ticket/contracts';

export interface GroundOperatorBrand {
 readonly id:string;
 readonly mode:'train'|'bus';
 readonly nameFa:string;
 readonly nameEn:string;
 readonly aliases:readonly string[];
 readonly assets:Readonly<Record<32|64|128,string>>;
}

const assetRoot=`${(import.meta as ImportMeta&{readonly env?:{readonly BASE_URL?:string}}).env?.BASE_URL??'/'}ground-operators/`;
const brand=(id:string,mode:'train'|'bus',nameFa:string,nameEn:string):GroundOperatorBrand=>Object.freeze({id,mode,nameFa,nameEn,aliases:Object.freeze([`${mode==='train'?'rail':'bus'}:${id}`]),assets:Object.freeze({32:`${assetRoot}${id}-32.png`,64:`${assetRoot}${id}-64.png`,128:`${assetRoot}${id}-128.png`})});

/** Exact operating identities; source marketplace codes never become provider/partnership authority. */
export const groundOperatorBrands:readonly GroundOperatorBrand[]=Object.freeze([
 brand('raja','train','رجا','Raja'),
 brand('fadak','train','فدک','Fadak'),
 brand('bonrail','train','بن ریل','Bonrail'),
 brand('joopar','train','جوپار','Joopar'),
 brand('mahtab-seir-jam','train','مهتاب سیر جم','Mahtab Seir Jam'),
 brand('pars-larim','train','پارس لاریم','Pars Larim'),
 brand('rail-seir-kowsar','train','ریل سیر کوثر','Rail Seir Kowsar'),
 brand('rail-tarabar-saba','train','ریل ترابر سبا','Rail Tarabar Saba'),
 brand('noor-alreza','train','نورالرضا','Noor al Reza'),
 brand('iran-peyma','bus','ایران پیما','Iran Peyma'),
 brand('hamsafar','bus','همسفر','Hamsafar'),
 brand('royal-safar','bus','رویال سفر','Royal Safar'),
 brand('seir-o-safar','bus','سیروسفر','Seir o Safar'),
 brand('tarabar-bita','bus','ترابر بی تا','Tarabar Bita'),
 brand('arya-safar','bus','آریا سفر','Arya Safar'),
 brand('levan-noor','bus','لوان نور','Levan Noor'),
 brand('giti-peyma','bus','گیتی پیما','Giti Peyma'),
 brand('mihan-noor','bus','میهن نور','Mihan Noor'),
 brand('eiman-safar','bus','ایمن سفر','Eiman Safar'),
 brand('peyk-motamed','bus','پیک معتمد','Peyk Motamed'),
 brand('arta-sabalan','bus','آرتا سبلان','Arta Sabalan'),
 brand('peyk-saba','bus','پیک صبا','Peyk Saba'),
 brand('adl','bus','عدل','Adl'),
]);

const identities=new Map(groundOperatorBrands.flatMap(operator=>operator.aliases.map(alias=>[alias,operator] as const)));

export function resolveGroundOperatorBrand(operatorId:string,mode:Mode):GroundOperatorBrand|undefined{
 const operator=identities.get(operatorId);
 return operator?.mode===mode?operator:undefined;
}
