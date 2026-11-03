import {Navigate,Route,Routes} from 'react-router';
import {ProviderHealth} from './features/providers/provider-health';
import {SearchList} from './features/searches/search-list';
import {SearchDetail} from './features/searches/search-detail';
import {NormalizationWorkspace} from './features/quality/normalization-list';
import {ReferralList} from './features/referrals/referral-list';
import {ReferralDetail} from './features/referrals/referral-detail';
import {ProviderTrafficDashboard} from './features/traffic/provider-traffic';
export function AdminRoutes(){return <Routes><Route path="/" element={<Navigate to="/traffic" replace/>}/><Route path="/traffic" element={<ProviderTrafficDashboard/>}/><Route path="/providers" element={<ProviderHealth/>}/><Route path="/searches" element={<SearchList/>}/><Route path="/searches/:id" element={<SearchDetail/>}/><Route path="/quality" element={<NormalizationWorkspace/>}/><Route path="/referrals" element={<ReferralList/>}/><Route path="/referrals/:id" element={<ReferralDetail/>}/><Route path="*" element={<section><h1>Page not found</h1><a href="/admin/">Return to operations</a></section>}/></Routes>;}
