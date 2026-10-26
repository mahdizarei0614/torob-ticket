import {useLayoutEffect,useState} from 'react';
import {act,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ThemeProvider,useTheme} from '@torob-ticket/ui';
import {useThemeUniforms,type ThemeUniforms} from './theme-uniforms';
it('publishes stable resolved uniforms before paint and the application flush across all six palettes',async()=>{
 const colors:Record<string,string>={'flight:light':'#ffffff','flight:dark':'#808080','train:light':'#00ff00','train:dark':'#008000','bus:light':'#ff0000','bus:dark':'#800000'};
 vi.spyOn(window,'getComputedStyle').mockImplementation(()=>({getPropertyValue:()=>colors[`${document.documentElement.dataset.mode}:${document.documentElement.dataset.appearance}`]} as CSSStyleDeclaration));
 vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));
 let uniforms!:ThemeUniforms;let bridge!:ReturnType<typeof useTheme>['themeBridge'];const phases:string[]=[];
 function Scene(){uniforms=useThemeUniforms();bridge=useTheme().themeBridge;useLayoutEffect(()=>bridge.beforePaint(theme=>{expect(uniforms.route.value.toArray()).toEqual(uniforms.focus.value.toArray());phases.push(`paint:${theme.mode}:${theme.appearance}`);}),[]);return null;}
 function Controls(){const {setPreference}=useTheme();return <><button onClick={()=>setPreference('light')}>Light</button><button onClick={()=>setPreference('dark')}>Dark</button></>;}
 function App(){const [mode,setMode]=useState<'flight'|'train'|'bus'>('flight');return <><button onClick={()=>setMode('train')}>Train</button><button onClick={()=>setMode('bus')}>Bus</button><ThemeProvider initialPreference="light" mode={mode} onThemeApplied={async()=>{const snapshot=bridge.getSnapshot()!;expect(phases.at(-1)).toBe(`paint:${snapshot.mode}:${snapshot.appearance}`);phases.push('flushed');}}><Scene/><Controls/></ThemeProvider></>;}
 render(<App/>);const vector=uniforms.route.value;expect(vector.toArray()).toEqual([1,1,1,1]);
 for(const [control,expected] of [['Dark',[expect.closeTo(.215861,5),expect.closeTo(.215861,5),expect.closeTo(.215861,5),1]],['Train',[0,expect.closeTo(.215861,5),0,1]],['Light',[0,1,0,1]],['Bus',[1,0,0,1]],['Dark',[expect.closeTo(.215861,5),0,0,1]]] as const){await act(async()=>screen.getByText(control).click());expect(uniforms.route.value).toBe(vector);expect(vector.toArray()).toEqual(expected);expect(phases.at(-1)).toBe('flushed');}
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
