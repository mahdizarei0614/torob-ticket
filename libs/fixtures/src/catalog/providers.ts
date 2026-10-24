import type { ClassChoice, Mode, ProviderCapabilities } from '@torob-ticket/contracts';
export const classChoices: ClassChoice[] = [
  {code:'economy',mode:'flight',name:'اقتصادی'}, {code:'business',mode:'flight',name:'تجاری'},
  {code:'sleeper-4',mode:'train',name:'کوپه چهار تخته'}, {code:'seat',mode:'train',name:'صندلی'},
  {code:'vip',mode:'bus',name:'ویژه'}, {code:'standard',mode:'bus',name:'معمولی'},
];
const modes: Mode[][] = [['flight'],['flight','train'],['flight','bus'],['flight','train','bus'],['train','bus'],['train','bus']];
export const providers: ProviderCapabilities[] = modes.map((supported,index)=>({providerId:`demo-provider-0${index+1}`,name:`فروشنده نمونه ${index+1} (خیالی)`,fictional:true,modes:supported,scopes:['domestic','international'],classCodes:classChoices.filter(c=>supported.includes(c.mode)).map(c=>c.code),requiresChildAges:true,requiresInfantAges:true}));
