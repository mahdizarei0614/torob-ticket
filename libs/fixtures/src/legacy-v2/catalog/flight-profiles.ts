/** Authored, reversible complete-provider itineraries, not operating flight schedules.
 * Airports: OurAirports snapshot; hub/service plausibility: primary airline research.
 * Durations/layovers are bounded mock choices, not published minimum-connect guarantees.
 * See docs/evidence/adjustments/realistic-travel-catalog/fixture-research.md.
 */
export interface FlightPattern {
  airports: readonly string[];
  minutes: readonly number[];
  returnMinutes: readonly number[];
  operators: readonly string[];
  waits: readonly number[];
}
export interface FlightProfile { baseFareRial: number; patterns: readonly [FlightPattern, FlightPattern, FlightPattern] }
const TK='airline:turkish-airlines', QR='airline:qatar-airways', EK='airline:emirates', LH='airline:lufthansa';
const BA='airline:british-airways', SQ='airline:singapore-airlines', NH='airline:ana', AC='airline:air-canada', QF='airline:qantas';
function path(airports:string[],minutes:number[],operators:string[],waits:number[],returnMinutes?:number[]):FlightPattern {
  if(minutes.length!==airports.length-1||operators.length!==minutes.length||waits.length!==minutes.length-1)throw new RangeError('Invalid authored flight pattern');
  return {airports,minutes,operators,waits,returnMinutes:returnMinutes??[...minutes].reverse().map(value=>value+(value>=450?25:10))};
}
export const flightProfiles: Readonly<Record<string, FlightProfile>> = {
  london:{baseFareRial:650000000,patterns:[
    path(['ika','ist','lhr'],[210,245],[TK,TK],[110],[220,190]),
    path(['ika','doh','fra','lhr'],[130,400,105],[QR,QR,LH],[120,110],[100,370,135]),
    path(['ika','dxb','fra','cdg','lhr'],[135,420,80,85],[EK,EK,LH,BA],[120,110,120],[80,85,390,135]),
  ]},
  paris:{baseFareRial:600000000,patterns:[
    path(['ika','ist','cdg'],[210,235],[TK,TK],[120],[220,190]),
    path(['ika','doh','lhr','cdg'],[130,430,80],[QR,QR,BA],[130,110],[85,395,135]),
    path(['ika','dxb','fra','lhr','cdg'],[135,420,105,80],[EK,EK,LH,BA],[120,110,120],[85,100,390,135]),
  ]},
  frankfurt:{baseFareRial:580000000,patterns:[
    path(['ika','ist','fra'],[210,185],[TK,TK],[110],[180,190]),
    path(['ika','doh','lhr','fra'],[130,430,95],[QR,QR,BA],[125,110],[100,395,135]),
    path(['ika','doh','ist','lhr','fra'],[130,265,245,95],[QR,QR,TK,BA],[120,120,110],[100,220,250,135]),
  ]},
  'new-york':{baseFareRial:1100000000,patterns:[
    path(['ika','doh','jfk'],[130,850],[QR,QR],[150],[730,135]),
    path(['ika','ist','lhr','jfk'],[210,245,475],[TK,TK,BA],[130,150],[410,220,190]),
    path(['ika','doh','fra','lhr','jfk'],[130,400,105,475],[QR,QR,LH,BA],[140,120,150],[410,100,370,135]),
  ]},
  'los-angeles':{baseFareRial:1300000000,patterns:[
    path(['ika','doh','lax'],[130,960],[QR,QR],[160],[940,135]),
    path(['ika','ist','fra','lax'],[210,185,705],[TK,TK,LH],[130,150],[660,180,190]),
    path(['ika','dxb','sin','hnd','lax'],[135,455,420,600],[EK,EK,SQ,NH],[120,150,180],[720,440,465,135]),
  ]},
  toronto:{baseFareRial:1100000000,patterns:[
    path(['ika','ist','yyz'],[210,650],[TK,TK],[150],[580,190]),
    path(['ika','doh','lhr','yyz'],[130,430,480],[QR,QR,AC],[140,150],[420,395,135]),
    path(['ika','dxb','cdg','lhr','yyz'],[135,440,85,480],[EK,EK,BA,AC],[140,120,150],[420,80,410,135]),
  ]},
  singapore:{baseFareRial:500000000,patterns:[
    path(['ika','doh','sin'],[130,475],[QR,QR],[130],[495,135]),
    path(['ika','dxb','bkk','sin'],[135,375,150],[EK,EK,SQ],[125,120],[150,385,135]),
    path(['ika','dxb','doh','bkk','sin'],[135,75,390,150],[EK,QR,QR,SQ],[120,120,120],[150,410,75,135]),
  ]},
  bangkok:{baseFareRial:400000000,patterns:[
    path(['ika','doh','bkk'],[130,390],[QR,QR],[130],[410,135]),
    path(['ika','dxb','sin','bkk'],[135,455,150],[EK,EK,SQ],[125,120],[150,465,135]),
    path(['ika','doh','dxb','sin','bkk'],[130,75,455,150],[QR,QR,EK,SQ],[120,120,120],[150,465,75,135]),
  ]},
  tokyo:{baseFareRial:700000000,patterns:[
    path(['ika','doh','hnd'],[130,610],[QR,QR],[140],[695,135]),
    path(['ika','dxb','sin','hnd'],[135,455,420],[EK,EK,SQ],[140,150],[440,465,135]),
    path(['ika','doh','dxb','sin','hnd'],[130,75,455,420],[QR,QR,EK,SQ],[120,140,150],[440,465,75,135]),
  ]},
  sydney:{baseFareRial:1300000000,patterns:[
    path(['ika','doh','syd'],[130,855],[QR,QR],[150],[905,135]),
    path(['ika','dxb','sin','syd'],[135,455,465],[EK,EK,SQ],[140,150],[505,465,135]),
    path(['ika','doh','dxb','sin','syd'],[130,75,455,465],[QR,QR,EK,SQ],[120,140,150],[505,465,75,135]),
  ]},
  auckland:{baseFareRial:1500000000,patterns:[
    path(['ika','doh','akl'],[130,995],[QR,QR],[170],[1050,135]),
    path(['ika','dxb','syd','akl'],[135,850,190],[EK,EK,QF],[160,160],[210,890,135]),
    path(['ika','dxb','sin','syd','akl'],[135,455,465,190],[EK,EK,SQ,QF],[140,150,160],[210,505,465,135]),
  ]},
};

export function flightProfile(originCityId:string,destinationCityId:string):FlightProfile|undefined {
  return originCityId==='tehran'?flightProfiles[destinationCityId]:destinationCityId==='tehran'?flightProfiles[originCityId]:undefined;
}
