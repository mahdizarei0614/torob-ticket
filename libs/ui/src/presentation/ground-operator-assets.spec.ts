import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {inflateSync} from 'node:zlib';
import {describe,expect,it} from 'vitest';
import {groundOperatorBrands} from './ground-operator-brands';

interface Variant {path:string;width:32|64|128;height:number;bytes:number;sha256:string;transparentPixels:number;visiblePixels:number;maxAlpha:number}
interface Asset {id:string;operatorId:string;mode:'train'|'bus';nameFa:string;nameEn:string;source:{url:string;pageUrl:string;retrievedOn:string;format:string;sha256:string;license:string;identityEvidence:string;origin:string};variants:Variant[]}
const assetRoot=resolve('assets/ground-operators');
const manifest=JSON.parse(readFileSync(resolve(assetRoot,'manifest.json'),'utf8')) as {operators:Asset[]};

function paeth(a:number,b:number,c:number):number{
 const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
 return pa<=pb&&pa<=pc?a:pb<=pc?b:c;
}

/** Decode every standard PNG scanline predictor, independently of the asset producer. */
function alphaPixels(buffer:Buffer,width:number,height:number):number[]{
 let offset=8;const parts:Buffer[]=[];
 while(offset<buffer.length){const length=buffer.readUInt32BE(offset),tag=buffer.toString('ascii',offset+4,offset+8);if(tag==='IDAT')parts.push(buffer.subarray(offset+8,offset+8+length));offset+=length+12;}
 const raw=inflateSync(Buffer.concat(parts)),stride=width*4,alpha:number[]=[];
 expect(raw.length).toBe(height*(stride+1));
 let previous=new Uint8Array(stride);
 for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)]!,decoded=new Uint8Array(stride);expect(filter).toBeLessThanOrEqual(4);
  for(let x=0;x<stride;x++){
   const a=x>=4?decoded[x-4]!:0,b=previous[x]!,c=x>=4?previous[x-4]!:0;
   const predictor=filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0;
   decoded[x]=(raw[y*(stride+1)+1+x]!+predictor)&255;
   if(x%4===3)alpha.push(decoded[x]!);
  }
  previous=decoded;
 }
 return alpha;
}

describe('bundled ground operator PNG integrity',()=>{
 it('covers the runtime registry with individually traced authentic sources and no orphan PNGs',()=>{
  expect(manifest.operators.map(asset=>asset.id).sort()).toEqual(groundOperatorBrands.map(brand=>brand.id).sort());
  const paths=manifest.operators.flatMap(asset=>asset.variants.map(variant=>variant.path));
  expect(new Set(paths).size).toBe(paths.length);
  expect(readdirSync(assetRoot).filter(file=>file.endsWith('.png')).sort()).toEqual(paths.map(path=>path.split('/').at(-1)).sort());
  for(const asset of manifest.operators){
   const brand=groundOperatorBrands.find(brand=>brand.id===asset.id)!;
   expect([asset.mode,asset.nameFa,asset.nameEn]).toEqual([brand.mode,brand.nameFa,brand.nameEn]);
   expect(brand.aliases).toContain(asset.operatorId);
   expect(asset.source.origin).toBe('marketplace-hosted-brand-image');
   expect(new URL(asset.source.url).hostname).toBe('directus.mrbilit.com');
   expect(new URL(asset.source.pageUrl).hostname).toBe('mrbilit.com');
   expect(asset.source.format).toBe('svg');expect(asset.source.retrievedOn).toBe('2026-10-29');
   expect(asset.source.sha256).toMatch(/^[a-f0-9]{64}$/);
   expect(asset.source.license).toContain('No open reuse license');
   expect(asset.source.identityEvidence).toContain('Visible card');
   expect(asset.variants.map(variant=>variant.width)).toEqual([32,64,128]);
  }
 });

 it('ships small local RGBA PNGs with exact hashes, decoded alpha coverage and transparent borders',()=>{
  for(const asset of manifest.operators)for(const variant of asset.variants){
   const buffer=readFileSync(resolve('assets',variant.path));
   expect(buffer.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
   expect(buffer.toString('ascii',12,16)).toBe('IHDR');
   expect(buffer.readUInt32BE(16)).toBe(variant.width);expect(buffer.readUInt32BE(20)).toBe(variant.height);
   expect(buffer[24]).toBe(8);expect(buffer[25]).toBe(6);expect(buffer[28]).toBe(0);
   expect(buffer.length).toBe(variant.bytes);expect(buffer.length).toBeLessThan(32*1024);
   expect(createHash('sha256').update(buffer).digest('hex')).toBe(variant.sha256);
   const alpha=alphaPixels(buffer,variant.width,variant.height);
   expect(alpha.filter(value=>value===0)).toHaveLength(variant.transparentPixels);
   expect(alpha.filter(value=>value>0)).toHaveLength(variant.visiblePixels);
   expect(Math.max(...alpha)).toBe(variant.maxAlpha);expect(variant.maxAlpha).toBeGreaterThanOrEqual(128);
   expect(variant.visiblePixels).toBeGreaterThan(0);expect(variant.transparentPixels).toBeGreaterThan(0);
   const border=alpha.filter((_,index)=>index<variant.width||index>=variant.width*(variant.height-1)||index%variant.width===0||index%variant.width===variant.width-1);
   expect(border.every(value=>value===0)).toBe(true);
   expect(groundOperatorBrands.find(brand=>brand.id===asset.id)?.assets[variant.width]).toBe(`/${variant.path}`);
  }
 });
});
