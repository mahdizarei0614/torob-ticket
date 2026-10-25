import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter,useNavigate} from 'react-router';
import {afterEach,it,expect,vi} from 'vitest';
import {RetainedConsumerRoutes} from '../../routes';
vi.mock('../search/search-page',async()=>{const {useState}=await import('react'),{useLocation}=await import('react-router');return {SearchPage:({covered,onHandoff}:{covered:boolean;onHandoff:(r:unknown,c:unknown)=>void})=>{const [count,setCount]=useState(0),location=useLocation();return <section><output data-testid="location">{location.key+location.search}</output><output data-testid="count">{count}</output><output data-testid="covered">{String(covered)}</output><button onClick={()=>setCount(v=>v+1)}>edit</button><button onClick={()=>onHandoff({referralId:'r',handoffPath:'/provider-demo/r'},{})}>handoff</button></section>;}};});
vi.mock('./provider-page',()=>({ProviderPage:({onReturn}:{onReturn:()=>void})=><button onClick={()=>onReturn()}>return</button>}));
function Forward(){const navigate=useNavigate();return <button onClick={()=>void navigate(1)}>forward</button>;}
afterEach(()=>vi.restoreAllMocks());
it('keeps the exact comparison tree and frozen location through Back, Forward and Return',async()=>{
 vi.spyOn(window,'scrollTo').mockImplementation(()=>undefined);render(<MemoryRouter initialEntries={[{pathname:'/',search:'?q=frozen',key:'comparison'}]}><Forward/><RetainedConsumerRoutes/></MemoryRouter>);
 fireEvent.click(screen.getByText('edit'));fireEvent.click(screen.getByText('handoff'));expect(screen.getByText('return')).toBeTruthy();expect(screen.getByTestId('location').textContent).toBe('comparison?q=frozen');expect(screen.getByTestId('count').textContent).toBe('1');expect(screen.getByTestId('covered').textContent).toBe('true');
 fireEvent.click(screen.getByText('return'));await waitFor(()=>expect(screen.queryByText('return')).toBeNull());expect(screen.getByTestId('count').textContent).toBe('1');fireEvent.click(screen.getByText('forward'));await screen.findByText('return');expect(screen.getByTestId('count').textContent).toBe('1');fireEvent.click(screen.getByText('return'));expect(screen.getByTestId('location').textContent).toBe('comparison?q=frozen');
});
it('a cold provider entry does not mount a hidden comparison/bootstrap tree',()=>{vi.spyOn(window,'scrollTo').mockImplementation(()=>undefined);render(<MemoryRouter initialEntries={['/provider-demo/r']}><RetainedConsumerRoutes/></MemoryRouter>);expect(screen.getByText('return')).toBeTruthy();expect(screen.queryByTestId('location')).toBeNull();});
