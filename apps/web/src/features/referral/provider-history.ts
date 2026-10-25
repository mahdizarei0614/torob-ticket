/** A retained comparison owns only its exact history entry, never all Back navigation. */
let retained:{key:string;search:string;provider:boolean}|undefined;
export function retainComparisonHistory(key:string,search:string){retained={key,search,provider:true};}
export function clearComparisonHistory(){retained=undefined;}
export function skipProviderPop(pathname:string,search:string,key:unknown){
 if(pathname.startsWith('/provider-demo/')){if(retained)retained.provider=true;return true;}
 if(retained?.provider&&pathname==='/'&&retained.key===key&&retained.search===search){retained.provider=false;return true;}
 if(retained)retained.provider=false;return false;
}
