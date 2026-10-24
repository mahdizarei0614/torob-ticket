import { MockProvider } from './mock-provider';
export const mockRegistry=Array.from({length:6},(_,i)=>new MockProvider(`demo-provider-0${i+1}`));
