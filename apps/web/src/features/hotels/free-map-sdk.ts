import type {FreeMapSdk,MapPort,MarkerPort} from './free-map-adapter';
/** Loaded only by an open location picker; pinned SDK, CSS and same-origin Vite worker. */
let runtime:Promise<FreeMapSdk>|undefined;
async function load():Promise<FreeMapSdk>{
 const [sdk,worker]=await Promise.all([import('maplibre-gl'),import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),import('maplibre-gl/dist/maplibre-gl.css')]);
 sdk.setWorkerUrl(worker.default);sdk.setWorkerCount(1);
 return {createMap:(element,options)=>{const map=new sdk.Map({container:element,...options});map.touchZoomRotate.disableRotation();map.touchPitch.disable();map.dragRotate.disable();map.keyboard.disableRotation();map.addControl(new sdk.NavigationControl({showCompass:false}),'top-left');return map as unknown as MapPort;},createMarker:(element,draggable)=>new sdk.Marker({element,draggable,anchor:'center'}) as unknown as MarkerPort};
}

export function loadFreeMapSdk(){return runtime??=(load().catch(error=>{runtime=undefined;throw error;}));}
