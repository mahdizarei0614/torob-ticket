import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {inflateSync} from 'node:zlib';
import {describe,expect,it} from 'vitest';
import {airlineBrands} from './airline-brands';

interface Variant {path:string;width:number;height:number;bytes:number;sha256:string;transparentPixels:number;visiblePixels:number;maxAlpha:number}
interface Asset {id:string;nameFa:string;nameEn:string;country:string;source:{url:string;pageUrl:string;sha256:string;license:string};variants:Variant[]}
const assetRoot=resolve('assets/airlines');
const manifest=JSON.parse(readFileSync(resolve(assetRoot,'manifest.json'),'utf8')) as {airlines:Asset[]};

/** PNG's first row has a zero previous row, so all standard predictors reduce to left or zero. */
function firstRowAlpha(buffer:Buffer,width:number):number[]{
 let offset=8;const parts:Buffer[]=[];
 while(offset<buffer.length){const length=buffer.readUInt32BE(offset);const tag=buffer.toString('ascii',offset+4,offset+8);if(tag==='IDAT')parts.push(buffer.subarray(offset+8,offset+8+length));offset+=length+12;}
 const row=inflateSync(Buffer.concat(parts));const filter=row[0]!;const decoded:number[]=[];
 expect(filter).toBeLessThanOrEqual(4);
 for(let x=0;x<width*4;x++){const left=x>=4?decoded[x-4]!:0;const predictor=filter===1||filter===4?left:filter===3?Math.floor(left/2):0;decoded.push((row[x+1]!+predictor)&255);}
 return decoded.filter((_,index)=>index%4===3);
}

describe('bundled airline PNG integrity',()=>{
 it('covers every runtime brand once, with a source record and no orphan PNGs',()=>{
  expect(manifest.airlines.map(asset=>asset.id).sort()).toEqual(airlineBrands.map(brand=>brand.id).sort());
  const files=manifest.airlines.flatMap(asset=>asset.variants.map(variant=>variant.path));
  expect(new Set(files).size).toBe(files.length);
  expect(readdirSync(assetRoot).filter(file=>file.endsWith('.png')).sort()).toEqual(files.map(file=>file.split('/').at(-1)).sort());
  for(const asset of manifest.airlines){
   const brand=airlineBrands.find(brand=>brand.id===asset.id)!;
   expect([asset.nameFa,asset.nameEn,asset.country]).toEqual([brand.nameFa,brand.nameEn,brand.country]);
   expect(asset.source.url).toMatch(/^https:\/\//);expect(asset.source.pageUrl).toMatch(/^https:\/\//);
   expect(asset.source.sha256).toMatch(/^[a-f0-9]{64}$/);expect(asset.source.license.trim()).not.toBe('');
   expect(asset.variants.map(variant=>variant.width)).toEqual([32,64,128]);
  }
 });

 it('ships decodable, compact RGBA PNGs at all three fixed list sizes with truly transparent edges',()=>{
  for(const asset of manifest.airlines)for(const variant of asset.variants){
   const buffer=readFileSync(resolve('assets',variant.path));
   expect(buffer.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
   expect(buffer.toString('ascii',12,16)).toBe('IHDR');
   expect(buffer.readUInt32BE(16)).toBe(variant.width);expect(buffer.readUInt32BE(20)).toBe(variant.height);
   expect(buffer[24]).toBe(8);expect(buffer[25]).toBe(6);
   expect(buffer.length).toBe(variant.bytes);expect(buffer.length).toBeLessThan(32*1024);
   expect(createHash('sha256').update(buffer).digest('hex')).toBe(variant.sha256);
   expect(firstRowAlpha(buffer,variant.width).every(alpha=>alpha===0)).toBe(true);
   expect(variant.transparentPixels).toBeGreaterThan(0);expect(variant.visiblePixels).toBeGreaterThan(0);expect(variant.maxAlpha).toBeGreaterThanOrEqual(128);
   expect(brandPath(asset.id,variant.width)).toBe(`/airlines/${asset.id}-${variant.width}.png`);
  }
 });
});

function brandPath(id:string,width:number):string|undefined{return airlineBrands.find(brand=>brand.id===id)?.assets[width as 32|64|128];}
