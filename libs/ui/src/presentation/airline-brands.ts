import type {Mode} from '@torob-ticket/contracts';

export interface AirlineBrand {
 readonly id:string;
 readonly nameFa:string;
 readonly nameEn:string;
 readonly country:string;
 readonly aliases:readonly string[];
 readonly assets:Readonly<Record<32|64|128,string>>;
}

const assetRoot=`${(import.meta as ImportMeta&{readonly env?:{readonly BASE_URL?:string}}).env?.BASE_URL??'/'}airlines/`;
const brand=(id:string,nameFa:string,nameEn:string,country:string,aliases:readonly string[]=[]):AirlineBrand=>Object.freeze({id,nameFa,nameEn,country,aliases:Object.freeze([`airline:${id}`,...aliases]),assets:Object.freeze({32:`${assetRoot}${id}-32.png`,64:`${assetRoot}${id}-64.png`,128:`${assetRoot}${id}-128.png`})});

/** Presentation aliases only. They establish neither inventory nor a real provider integration. */
export const airlineBrands:readonly AirlineBrand[]=Object.freeze([
 brand("iran-air","ایران‌ایر","Iran Air","IR",["demo-operator-flight-0","iata:IR","icao:IRA"]),
 brand("mahan-air","ماهان","Mahan Air","IR",["demo-operator-flight-1","iata:W5","icao:IRM"]),
 brand("iran-aseman","آسمان","Iran Aseman Airlines","IR",["demo-operator-flight-2","iata:EP","icao:IRC"]),
 brand("iran-airtour","ایران‌ایرتور","Iran Airtour","IR"),
 brand("kish-air","کیش‌ایر","Kish Air","IR"),
 brand("qeshm-air","قشم‌ایر","Qeshm Air","IR"),
 brand("ata-airlines","آتا","ATA Airlines","IR"),
 brand("taban-air","تابان","Taban Air","IR"),
 brand("zagros-airlines","زاگرس","Zagros Airlines","IR"),
 brand("fly-persia","فلای‌پرشیا","FlyPersia","IR"),
 brand("sepehran-airlines","سپهران","Sepehran Airlines","IR"),
 brand("karun-airlines","کارون","Karun Airlines","IR"),
 brand("chabahar-airlines","چابهار","Chabahar Airlines","IR"),
 brand("pars-air","پارس‌ایر","Pars Air","IR"),
 brand("ava-airlines","آوا","AVA Airlines","IR"),
 brand("yazd-airways","یزدایر","Yazd Airways","IR"),
 brand("pouya-air","پویا","Pouya Air","IR"),
 brand("meraj-airlines","معراج","Meraj Airlines","IR"),
 brand("caspian-airlines","کاسپین","Caspian Airlines","IR"),
 brand("saha-airlines","ساها","Saha Airlines","IR"),
 brand("fly-kish","فلای‌کیش","Fly Kish Airlines","IR"),
 brand("toos-airlines","طوس","Toos Airlines","IR"),
 brand("varesh-airlines","وارش","Varesh Airlines","IR"),
 brand("emirates","امارات","Emirates","AE"),
 brand("qatar-airways","قطر ایرویز","Qatar Airways","QA"),
 brand("turkish-airlines","ترکیش ایرلاینز","Turkish Airlines","TR"),
 brand("etihad","اتحاد","Etihad Airways","AE"),
 brand("flydubai","فلای‌دبی","flydubai","AE"),
 brand("pegasus","پگاسوس","Pegasus Airlines","TR"),
 brand("lufthansa","لوفت‌هانزا","Lufthansa","DE"),
 brand("austrian","آسترین","Austrian Airlines","AT"),
 brand("air-france","ایرفرانس","Air France","FR"),
 brand("klm","کی‌ال‌ام","KLM","NL"),
 brand("british-airways","بریتیش ایرویز","British Airways","GB"),
 brand("swiss","سوئیس","Swiss International Air Lines","CH"),
 brand("iberia","ایبریا","Iberia","ES"),
 brand("aegean","ایجین","Aegean Airlines","GR"),
 brand("lot","لوت","LOT Polish Airlines","PL"),
 brand("united-airlines","یونایتد","United Airlines","US"),
 brand("american-airlines","امریکن ایرلاینز","American Airlines","US"),
 brand("delta-air-lines","دلتا","Delta Air Lines","US"),
 brand("air-canada","ایرکانادا","Air Canada","CA"),
 brand("qantas","کانتاس","Qantas","AU"),
 brand("singapore-airlines","سنگاپور ایرلاینز","Singapore Airlines","SG"),
 brand("cathay-pacific","کاتای پاسیفیک","Cathay Pacific","HK"),
 brand("ana","آل‌نیپون ایرویز","All Nippon Airways","JP"),
 brand("japan-airlines","ژاپن ایرلاینز","Japan Airlines","JP"),
 brand("korean-air","کُرین ایر","Korean Air","KR"),
 brand("air-china","ایرچاینا","Air China","CN"),
 brand("saudia","سعودیا","Saudia","SA"),
 brand("oman-air","عمان‌ایر","Oman Air","OM"),
 brand("gulf-air","گلف‌ایر","Gulf Air","BH"),
]);

const identities=new Map(airlineBrands.flatMap(airline=>airline.aliases.map(alias=>[alias,airline] as const)));

/** Exact, namespaced flight identities only; partial codes and other transport modes stay neutral. */
export function resolveAirlineBrand(operatorId:string,mode:Mode):AirlineBrand|undefined{
 return mode==='flight'?identities.get(operatorId):undefined;
}
