import {lazy,Suspense,useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {CatalogSnapshot} from '@torob-ticket/contracts';
import {Button} from '@torob-ticket/ui';
import type {HotelDiscovery} from './use-hotel-discovery';
import {cityLocationAssets,loadLocationAssets} from './location-assets';
import styles from './hotels.module.css';
const Scene=lazy(()=>import('@torob-ticket/graphics').then(m=>({default:m.LocationScene})));
export function LocationPicker({model,catalog,onCancel,onApply}:{model:HotelDiscovery;catalog:CatalogSnapshot;onCancel:()=>void;onApply:()=>void}){
 const [filter,setFilter]=useState('');const destination=model.state.trip.query.destinationCityId;const city=catalog.cities.find(c=>c.id===destination)!;
 const assets=useQuery({queryKey:['hotel-location-assets'],queryFn:({signal})=>loadLocationAssets(signal),staleTime:Infinity,retry:false,refetchOnWindowFocus:false});
 const local=useMemo(()=>assets.data?cityLocationAssets(assets.data,destination):{landmarks:[]},[assets.data,destination]);
 const hotels=model.state.snapshot?.hotels??[];
 const accommodations=useMemo(()=>hotels.map(h=>({id:h.hotelId,name:h.name,point:h.point,kind:'accommodation' as const})),[hotels]);
 const choices=[...local.landmarks,...accommodations];const point=model.state.point?.value;const shown=point??city.point;
 return <section className={styles.picker} aria-label="انتخاب موقعیت مرجع هتل" onKeyDownCapture={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onCancel();}}}>
  <header className={styles.pickerHead}><div><h3>کجای {city.name} نزدیک‌تر باشد؟</h3><p>فاصله خط مستقیم است؛ راهنمای خیابان یا زمان رانندگی نیست.</p></div><Button variant="quiet" onPress={onCancel}>انصراف از موقعیت</Button></header>
  <label className={styles.field}>جست‌وجوی نشانه یا اقامتگاه<input aria-label="جست‌وجوی نشانه یا اقامتگاه" value={filter} onChange={event=>setFilter(event.target.value)}/></label>
  <div className={styles.pickerLayout}><div>
   {local.boundary?<Suspense fallback={<p role="status">آماده‌سازی نقشه محلی…</p>}><Scene foreground destinationBoundary={local.boundary} landmarks={local.landmarks} accommodations={accommodations} customPoint={point} onPointChange={model.setPoint} isCurrent={model.isPointCurrent} fitKey={destination}/></Suspense>:<><p role="status">{assets.isPending?'دریافت نقشه محلی…':'نقشه در دسترس نیست؛ نشانه‌ها و مختصات همچنان قابل انتخاب‌اند.'}</p><div className={styles.coordinates}><label>عرض جغرافیایی<input aria-label="عرض جغرافیایی" type="number" dir="ltr" min="-90" max="90" step="0.001" value={shown.latitude} onChange={event=>{const n=event.target.valueAsNumber;if(Number.isFinite(n)&&n>=-90&&n<=90)model.setPoint({...shown,latitude:n});}}/></label><label>طول جغرافیایی<input aria-label="طول جغرافیایی" type="number" dir="ltr" min="-180" max="180" step="0.001" value={shown.longitude} onChange={event=>{const n=event.target.valueAsNumber;if(Number.isFinite(n)&&n>=-180&&n<=180)model.setPoint({...shown,longitude:n});}}/></label></div>{assets.error&&<Button variant="quiet" onPress={()=>void assets.refetch()}>تلاش دوباره برای نقشه</Button>}</>}
  </div><div className={styles.landmarks} aria-label="نشانه‌ها و اقامتگاه‌های مقصد"><Button variant="secondary" onPress={()=>model.setPoint(city.point)}>مرکز {city.name}</Button>{choices.filter(p=>p.name.includes(filter)).map(p=><Button key={p.id} variant="quiet" onPress={()=>model.setPoint(p.point)}>{p.name}{p.kind==='accommodation'?' (خیالی)':''}</Button>)}{filter&&!choices.some(p=>p.name.includes(filter))&&<p role="status">نشانه‌ای با این نام پیدا نشد؛ از مرکز شهر یا مختصات استفاده کنید.</p>}</div></div>
  <footer className={styles.pickerActions}><p>{point?'نقطه موقت انتخاب شده است؛ با اعمال، مرجع مقایسه می‌شود.':'روی نقشه بزنید، نشانه‌ای انتخاب کنید یا مختصات را ویرایش کنید.'}</p><Button isDisabled={!point} onPress={onApply}>اعمال موقعیت</Button><Button variant="quiet" onPress={onCancel}>انصراف و حفظ موقعیت قبلی</Button></footer>
 </section>;
}
