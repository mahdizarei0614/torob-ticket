import {useLayoutEffect,useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {CatalogSnapshot} from '@torob-ticket/contracts';
import {Button,displayHotelName} from '@torob-ticket/ui';
import type {HotelDiscovery} from './use-hotel-discovery';
import {cityLocationAssets,loadLocationAssets,validPoint} from './location-assets';
import {faNumber} from './hotel-format';
import {FreeLocationMap} from './free-location-map';
import styles from './hotels.module.css';
export function LocationPicker({model,catalog,onCancel,onApply}:{model:HotelDiscovery;catalog:CatalogSnapshot;onCancel:()=>void;onApply:()=>void}){
 const [filter,setFilter]=useState('');const destination=model.state.trip.query.destinationCityId;const city=catalog.cities.find(c=>c.id===destination)!;
 const assets=useQuery({queryKey:['hotel-location-assets'],queryFn:({signal})=>loadLocationAssets(signal),staleTime:Infinity,retry:false,refetchOnWindowFocus:false});
 const local=useMemo(()=>assets.data?cityLocationAssets(assets.data,destination):{landmarks:[]},[assets.data,destination]);
 const hotels=model.state.snapshot?.hotels;
 const accommodations=useMemo(()=>(hotels??[]).map((h,index)=>({id:h.hotelId,name:displayHotelName(h),point:h.point,number:index+1})),[hotels]);
 const choices=useMemo(()=>[...local.landmarks,...accommodations],[local.landmarks,accommodations]);const point=model.state.point?.value;const shown=point??city.point;
 const [coordinates,setCoordinates]=useState({latitude:String(shown.latitude),longitude:String(shown.longitude)});
 useLayoutEffect(()=>{setCoordinates({latitude:String(Number(shown.latitude.toFixed(6))),longitude:String(Number(shown.longitude.toFixed(6)))});},[shown.latitude,shown.longitude]);
 const coordinateValue={latitude:Number(coordinates.latitude),longitude:Number(coordinates.longitude)},coordinatesValid=Boolean(coordinates.latitude.trim()&&coordinates.longitude.trim()&&validPoint(coordinateValue));
 function coordinate(key:'latitude'|'longitude',value:string){const next={...coordinates,[key]:value};setCoordinates(next);const p={latitude:Number(next.latitude),longitude:Number(next.longitude)};if(next.latitude.trim()&&next.longitude.trim()&&validPoint(p))model.setPoint(p);}
 return <section className={styles.picker} aria-label="انتخاب موقعیت مرجع هتل" onKeyDownCapture={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onCancel();}}}>
  <header className={styles.pickerHead}><div><h3>کجای {city.name} نزدیک‌تر باشد؟</h3><p>فاصله خط مستقیم است؛ راهنمای خیابان یا زمان رانندگی نیست.</p></div><Button variant="quiet" onPress={onCancel}>انصراف از موقعیت</Button></header>
  <label className={styles.field}>جست‌وجوی نشانه یا اقامتگاه<input aria-label="جست‌وجوی نشانه یا اقامتگاه" value={filter} onChange={event=>setFilter(event.target.value)}/></label>
  <div className={styles.pickerLayout}><div>
   <FreeLocationMap identity={destination+':'+model.state.point?.token} center={city.point} choices={choices} point={point} onPoint={model.setPoint} isCurrent={model.isPointCurrent}/>
   <div className={styles.coordinates}><label>عرض جغرافیایی<input aria-label="عرض جغرافیایی" type="number" dir="ltr" min="-90" max="90" step="any" value={coordinates.latitude} aria-invalid={!coordinatesValid||undefined} onChange={event=>coordinate('latitude',event.target.value)}/></label><label>طول جغرافیایی<input aria-label="طول جغرافیایی" type="number" dir="ltr" min="-180" max="180" step="any" value={coordinates.longitude} aria-invalid={!coordinatesValid||undefined} onChange={event=>coordinate('longitude',event.target.value)}/></label></div>
   {!coordinatesValid&&<p role="status">مختصات معتبر وارد کنید؛ عرض بین ۹۰- تا ۹۰ و طول بین ۱۸۰- تا ۱۸۰ است.</p>}
   {assets.error&&<p className={styles.muted}>فهرست نشانه‌های محلی دریافت نشد؛ مرکز مقصد، مختصات و نقشه شهری قابل استفاده‌اند. <Button variant="quiet" onPress={()=>void assets.refetch()}>دریافت دوباره نشانه‌ها</Button></p>}
  </div><div className={styles.landmarks} aria-label="نشانه‌ها و اقامتگاه‌های مقصد"><Button variant="secondary" onPress={()=>model.setPoint(city.point)}>مرکز {city.name}</Button>{choices.filter(p=>p.name.includes(filter)).map(p=><Button key={p.id} variant="quiet" onPress={()=>model.setPoint(p.point)}>{p.number!==undefined?`${faNumber(p.number)} · `:''}{p.name}</Button>)}{filter&&!choices.some(p=>p.name.includes(filter))&&<p role="status">نشانه‌ای با این نام پیدا نشد؛ از مرکز شهر یا مختصات استفاده کنید.</p>}</div></div>
  <footer className={styles.pickerActions}><p>{point?'نقطه موقت انتخاب شده است؛ با اعمال، مرجع مقایسه می‌شود.':'روی نقشه بزنید، نشانه‌ای انتخاب کنید یا مختصات را ویرایش کنید.'}</p><Button isDisabled={!point||!coordinatesValid} onPress={onApply}>اعمال موقعیت</Button><Button variant="quiet" onPress={onCancel}>انصراف و حفظ موقعیت قبلی</Button></footer>
  <p className={styles.footnote}>نقشه شهری: OpenStreetMap.</p>
 </section>;
}
