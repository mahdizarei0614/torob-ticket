import {SegmentedControl} from '@torob-ticket/ui';
export function RouteDirectionControl({value,hasReturn,onChange}:{value:'outbound'|'return';hasReturn:boolean;onChange:(value:'outbound'|'return')=>void}) {
 if(!hasReturn)return null;
 return <SegmentedControl label="جهت مسیر روی نقشه و فهرست" value={value} onChange={value=>onChange(value as 'outbound'|'return')} options={[{id:'outbound',label:'مسیر رفت'},{id:'return',label:'مسیر برگشت'}]}/>;
}
