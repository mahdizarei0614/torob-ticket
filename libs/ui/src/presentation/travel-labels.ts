import type {DemoIdentity,Hotel,Mode,Place,ProviderCapabilities} from '@torob-ticket/contracts';
import {resolveAirlineBrand} from './airline-brands';
import {resolveGroundOperatorBrand} from './ground-operator-brands';

type ProviderLabelSource=Pick<ProviderCapabilities,'providerId'|'name'>;
const providerNames=['راه‌آرا','سفرین','بلیت‌نو','هم‌مسیر','دورآوا','سفرآیین'] as const;
const operatorNames:Record<Mode,readonly string[]>={
 flight:[],
 train:['قطار آبان','ریل‌آرا','سپهرریل'],
 bus:['راه‌پیما','جاده‌سیر','آبان‌سفر'],
};

/** Callers supply already-matched metadata. Labels never establish source authority. */
export function displayProviderName(provider?:ProviderLabelSource):string{
 if(!provider?.name.trim())return 'فروشنده';
 const authored=/^فروشنده نمونه ([0-9]+) \(خیالی\)$/.exec(provider.name);
 if(!authored)return provider.name;
 const index=Number(authored[1])-1;
 return provider.providerId===`demo-provider-0${index+1}`?providerNames[index]??'فروشنده':'فروشنده';
}

/** Only explicit carrier identities are named; unknown codes stay out of customer copy. */
export function displayOperatorName(operatorId:string,mode:Mode):string{
 const airline=resolveAirlineBrand(operatorId,mode);
 if(airline)return airline.nameFa;
 const groundOperator=resolveGroundOperatorBrand(operatorId,mode);
 if(groundOperator)return groundOperator.nameFa;
 if(operatorId==='demo-transfer-operator'&&mode==='bus')return 'ترانسفر فرودگاهی';
 const authored=/^demo-operator-(flight|train|bus)-([0-2])$/.exec(operatorId);
 return authored?.[1]===mode?operatorNames[mode][Number(authored[2])]??'شرکت حمل‌ونقل':'شرکت حمل‌ونقل';
}

export function displayHotelName(hotel?:Pick<Hotel,'name'>):string{
 return hotel?.name.trim()?hotel.name.replace(/^هتل نمونه (.+) \(خیالی\)$/,'هتل $1'):'نام اقامتگاه اعلام نشده';
}

export function displayHotelAddress(hotel?:Pick<Hotel,'address'>):string{
 // The authored ordinal is not a street address. Retain only its stated area.
 return hotel?.address.trim()?hotel.address.replace(/^محدوده نمایشی (.+)، نشانی خیالی [0-9]+$/,'محدوده $1'):'نشانی اعلام نشده';
}

export function displayPlaceName(place?:Pick<Place,'name'|'kind'>):string{
 if(!place?.name.trim())return 'نام محل اعلام نشده';
 if(place.kind==='station')return place.name.replace(/^ایستگاه نمونه (.+) \(خیالی\)$/,'ایستگاه $1');
 if(place.kind==='terminal')return place.name.replace(/^پایانه نمونه (.+) \(خیالی\)$/,'پایانه $1');
 return place.name;
}

export function displayAccountName(identity?:Pick<DemoIdentity,'displayName'>|null):string{
 return !identity?.displayName.trim()||identity.displayName==='مسافر نمایشی'?'مسافر':identity.displayName;
}
