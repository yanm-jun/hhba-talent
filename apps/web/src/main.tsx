import { createRoot } from 'react-dom/client';
import { lazy, Suspense, useEffect, useState } from 'react';
import './styles.css';
import { api, ApiError, type User } from './services/api';
import { useRoute, navigate } from './router';
import { HomePage } from './pages/HomePage';
const IndustryLibraryPage=lazy(()=>import('./pages/IndustryLibraryPage').then(m=>({default:m.IndustryLibraryPage})));









const CanadaOccupationDetailPage=lazy(()=>import('./components/CanadaOccupationDirectory').then(module=>({default:module.CanadaOccupationDetailPage})));
const GermanyOccupationDetailPage=lazy(()=>import('./components/GermanyOccupationDirectory').then(module=>({default:module.GermanyOccupationDetailPage})));
const JapanOccupationDetailPage=lazy(()=>import('./components/JapanOccupationDirectory').then(module=>({default:module.JapanOccupationDetailPage})));
const OverseasOccupationDetailPage=lazy(()=>import('./components/OverseasOccupationDirectory').then(module=>({default:module.OverseasOccupationDetailPage})));






import './styles/join-vision.css';






import { employerProfileByRoute } from './services/employerProfiles';























import { employerApiReady } from './services/api';
const ResumeUploadPage=lazy(()=>import('./pages/CandidatePages').then(module=>({default:module.ResumeUploadPage})));
const ProfilePage=lazy(()=>import('./pages/CandidatePages').then(module=>({default:module.ProfilePage})));
const PublicProfilePage=lazy(()=>import('./pages/CandidatePages').then(module=>({default:module.PublicProfilePage})));
const ResumePage=lazy(()=>import('./pages/CandidatePages').then(module=>({default:module.ResumePage})));
const ReviewPage=lazy(()=>import('./pages/CandidatePages').then(module=>({default:module.ReviewPage})));




import { AnonymousTrafficTracker } from './components/AnalyticsConsent';
const EmployerStartPage=lazy(()=>import('./pages/EmployerGrowthHubPage').then(module=>({default:module.EmployerStartPage})));
const EmployerOnboardingPreviewPage=lazy(()=>import('./pages/EmployerGrowthHubPage').then(module=>({default:module.EmployerOnboardingPreviewPage})));
const EmployerGrowthHubPage=lazy(()=>import('./pages/EmployerGrowthHubPage').then(module=>({default:module.EmployerGrowthHubPage})));
const EmployerEvidencePage=lazy(()=>import('./pages/EmployerEvidencePage').then(module=>({default:module.EmployerEvidencePage})));
const AdminEmployerEvidencePage=lazy(()=>import('./pages/EmployerEvidencePage').then(module=>({default:module.AdminEmployerEvidencePage})));

const EmployerScoringPage=lazy(()=>import('./pages/EmployerScoringPage').then(module=>({default:module.EmployerScoringPage})));
const AdminEmployerScoringPage=lazy(()=>import('./pages/EmployerScoringPage').then(module=>({default:module.AdminEmployerScoringPage})));
const EmployerAppealsPage=lazy(()=>import('./pages/EmployerAppealsPage').then(module=>({default:module.EmployerAppealsPage})));
const EmployeePrivacyConcernsPage=lazy(()=>import('./pages/EmployerAppealsPage').then(module=>({default:module.EmployeePrivacyConcernsPage})));
const AdminAppealsReviewPage=lazy(()=>import('./pages/EmployerAppealsPage').then(module=>({default:module.AdminAppealsReviewPage})));
const EmployerImprovementsPage=lazy(()=>import('./pages/EmployerImprovementsPage').then(module=>({default:module.EmployerImprovementsPage})));
const PublicEmployerImprovementsPage=lazy(()=>import('./pages/EmployerImprovementsPage').then(module=>({default:module.PublicEmployerImprovementsPage})));
const AdminEmployerImprovementsPage=lazy(()=>import('./pages/EmployerImprovementsPage').then(module=>({default:module.AdminEmployerImprovementsPage})));
const EmployerVerifiedProfilePage=lazy(()=>import('./pages/EmployerVerifiedProfilePage').then(module=>({default:module.EmployerVerifiedProfilePage})));
const AdminEmployerPublicationPage=lazy(()=>import('./pages/EmployerVerifiedProfilePage').then(module=>({default:module.AdminEmployerPublicationPage})));
const EmployerAidApplicationPage=lazy(()=>import('./pages/EmployerAidCommercialPage').then(module=>({default:module.EmployerAidApplicationPage})));
const EmployerCommercialPage=lazy(()=>import('./pages/EmployerAidCommercialPage').then(module=>({default:module.EmployerCommercialPage})));
const AdminAidCommercialPage=lazy(()=>import('./pages/EmployerAidCommercialPage').then(module=>({default:module.AdminAidCommercialPage})));


const EmployerPublicJobsPage=lazy(()=>import('./pages/EmployerPublicJobsPage').then(module=>({default:module.EmployerPublicJobsPage})));
const EmployerPublicJobDetail=lazy(()=>import('./pages/EmployerPublicJobsPage').then(module=>({default:module.EmployerPublicJobDetail})));



const CandidateJobsPage=lazy(()=>import('./pages/CandidateJobsPage').then(module=>({default:module.CandidateJobsPage})));
const CandidateJobDetailPage=lazy(()=>import('./pages/CandidateJobsPage').then(module=>({default:module.CandidateJobDetailPage})));
import { UnifiedJobMarket, UnifiedJobDetail } from './components/UnifiedJobMarket';
const CompanyStepPage=lazy(()=>import('./pages/recruiter/RecruiterOnboarding').then(module=>({default:module.CompanyStepPage})));
const DocumentsStepPage=lazy(()=>import('./pages/recruiter/RecruiterOnboarding').then(module=>({default:module.DocumentsStepPage})));
const RecruiterWelcomePage=lazy(()=>import('./pages/recruiter/RecruiterOnboarding').then(module=>({default:module.RecruiterWelcomePage})));
const RepresentativeStepPage=lazy(()=>import('./pages/recruiter/RecruiterOnboarding').then(module=>({default:module.RepresentativeStepPage})));
const SubmitReviewPage=lazy(()=>import('./pages/recruiter/RecruiterOnboarding').then(module=>({default:module.SubmitReviewPage})));

import {realAuth,realAuthReady,getRealAuthToken,clearRealAuthToken,realAuthToUser} from './services/realAuth';
const DataUsePage=lazy(()=>import('./pages/DataUsePage').then(module=>({default:module.DataUsePage})));
const StudyAbroadPage=lazy(()=>import('./pages/StudyAbroadPage').then(module=>({default:module.StudyAbroadPage})));
const OverseasDevelopmentPage=lazy(()=>import('./pages/OverseasDevelopmentPage').then(module=>({default:module.OverseasDevelopmentPage})));
const JapanDevelopmentPage=lazy(()=>import('./pages/JapanDevelopmentPage').then(module=>({default:module.JapanDevelopmentPage})));
const GermanyDevelopmentPage=lazy(()=>import('./pages/GermanyDevelopmentPage').then(module=>({default:module.GermanyDevelopmentPage})));
const CanadaDevelopmentPage=lazy(()=>import('./pages/CanadaDevelopmentPage').then(module=>({default:module.CanadaDevelopmentPage})));
const UnitedKingdomDevelopmentPage=lazy(()=>import('./pages/UnitedKingdomDevelopmentPage').then(module=>({default:module.UnitedKingdomDevelopmentPage})));
const SingaporeDevelopmentPage=lazy(()=>import('./pages/SingaporeDevelopmentPage').then(module=>({default:module.SingaporeDevelopmentPage})));
const UnitedStatesDevelopmentPage=lazy(()=>import('./pages/UnitedStatesDevelopmentPage').then(module=>({default:module.UnitedStatesDevelopmentPage})));
const AustraliaDevelopmentPage=lazy(()=>import('./pages/AustraliaDevelopmentPage').then(module=>({default:module.AustraliaDevelopmentPage})));
const WinterInternshipPage=lazy(()=>import('./pages/WinterInternshipPage').then(module=>({default:module.WinterInternshipPage})));
const JoinUsPage=lazy(()=>import('./pages/JoinUsPage').then(module=>({default:module.JoinUsPage})));
const VisionPage=lazy(()=>import('./pages/VisionPage').then(module=>({default:module.VisionPage})));
const TalentServicePage=lazy(()=>import('./pages/TalentServicePage').then(module=>({default:module.TalentServicePage})));
const TalentServiceRoutes=lazy(()=>import('./pages/TalentServiceRoutes').then(module=>({default:module.TalentServiceRoutes})));
const MajorCompaniesPage=lazy(()=>import('./pages/MajorCompaniesPage').then(module=>({default:module.MajorCompaniesPage})));
const DomesticCompanyPage=lazy(()=>import('./pages/DomesticCompanyPage').then(module=>({default:module.DomesticCompanyPage})));
const Company200PreviewPage=lazy(()=>import('./pages/Company200PreviewPage').then(module=>({default:module.Company200PreviewPage})));
const DomesticAutumnPage=lazy(()=>import('./pages/DomesticAutumnPage').then(module=>({default:module.DomesticAutumnPage})));
const AutumnCompanyProfilePage=lazy(()=>import('./pages/AutumnCompanyProfilePage').then(module=>({default:module.AutumnCompanyProfilePage})));
const UnifiedV2CompanyPage=lazy(()=>import('./pages/UnifiedV2CompanyPage').then(module=>({default:module.UnifiedV2CompanyPage})));
const KpmgCompactProfilePage=lazy(()=>import('./pages/KpmgCompactProfilePage').then(module=>({default:module.KpmgCompactProfilePage})));
const SchneiderCompactProfilePage=lazy(()=>import('./pages/SchneiderCompactProfilePage').then(module=>({default:module.SchneiderCompactProfilePage})));
const HuayuVisionCompactProfilePage=lazy(()=>import('./pages/HuayuVisionCompactProfilePage').then(module=>({default:module.HuayuVisionCompactProfilePage})));
const HuaanSecuritiesCompactProfilePage=lazy(()=>import('./pages/HuaanSecuritiesCompactProfilePage').then(module=>({default:module.HuaanSecuritiesCompactProfilePage})));
const GuangfaSecuritiesCompactProfilePage=lazy(()=>import('./pages/GuangfaSecuritiesCompactProfilePage').then(module=>({default:module.GuangfaSecuritiesCompactProfilePage})));
const CiticsSecuritiesCompactProfilePage=lazy(()=>import('./pages/CiticsSecuritiesCompactProfilePage').then(module=>({default:module.CiticsSecuritiesCompactProfilePage})));
const PfizerCompactProfilePage=lazy(()=>import('./pages/PfizerCompactProfilePage').then(module=>({default:module.PfizerCompactProfilePage})));
const CsairCompactProfilePage=lazy(()=>import('./pages/CsairCompactProfilePage').then(module=>({default:module.CsairCompactProfilePage})));
const SfExpressCompactProfilePage=lazy(()=>import('./pages/SfExpressCompactProfilePage').then(module=>({default:module.SfExpressCompactProfilePage})));
const NeteaseGamesCompactProfilePage=lazy(()=>import('./pages/NeteaseGamesCompactProfilePage').then(module=>({default:module.NeteaseGamesCompactProfilePage})));
const HypergryphCompactProfilePage=lazy(()=>import('./pages/HypergryphCompactProfilePage').then(module=>({default:module.HypergryphCompactProfilePage})));
const AnkerCompactProfilePage=lazy(()=>import('./pages/AnkerCompactProfilePage').then(module=>({default:module.AnkerCompactProfilePage})));
const LaifenCompactProfilePage=lazy(()=>import('./pages/LaifenCompactProfilePage').then(module=>({default:module.LaifenCompactProfilePage})));
const ShkpCompactProfilePage=lazy(()=>import('./pages/ShkpCompactProfilePage').then(module=>({default:module.ShkpCompactProfilePage})));
const BoyuCompactProfilePage=lazy(()=>import('./pages/BoyuCompactProfilePage').then(module=>({default:module.BoyuCompactProfilePage})));
const CompanyProfilePage=lazy(()=>import('./pages/CompanyProfilePage').then(module=>({default:module.CompanyProfilePage})));
const IndexedCompanyPage=lazy(()=>import('./pages/IndexedCompanyPage').then(module=>({default:module.IndexedCompanyPage})));
const CompanyDirectoryPage=lazy(()=>import('./pages/CompanyDirectoryPage').then(module=>({default:module.CompanyDirectoryPage})));
const CandidateMatchPage=lazy(()=>import('./pages/CandidateMatchPage').then(module=>({default:module.CandidateMatchPage})));
const AuthPage=lazy(()=>import('./pages/AuthPage').then(module=>({default:module.AuthPage})));
const AuthChoicePage=lazy(()=>import('./pages/AuthChoicePage').then(module=>({default:module.AuthChoicePage})));
const PhoneAuthPage=lazy(()=>import('./pages/PhoneAuthPage').then(module=>({default:module.PhoneAuthPage})));
const OfficialRecruitmentContinuePage=lazy(()=>import('./pages/OfficialRecruitmentContinuePage').then(module=>({default:module.OfficialRecruitmentContinuePage})));
const PersonalCenterPage=lazy(()=>import('./pages/PersonalCenterPage').then(module=>({default:module.PersonalCenterPage})));
const LegalAidLandingPage=lazy(()=>import('./pages/LegalAidLandingPage').then(module=>({default:module.LegalAidLandingPage})));
const LegalAidInterventionPage=lazy(()=>import('./pages/LegalAidInterventionPage').then(module=>({default:module.LegalAidInterventionPage})));
const LegalAidTopicPage=lazy(()=>import('./pages/LegalAidTopicPage').then(module=>({default:module.LegalAidTopicPage})));
const EmployeeFeedbackPage=lazy(()=>import('./pages/EmployeeFeedbackPage').then(module=>({default:module.EmployeeFeedbackPage})));
const EmployerPage=lazy(()=>import('./pages/EmployerPage').then(module=>({default:module.EmployerPage})));
const EmployerWorkspacePage=lazy(()=>import('./pages/EmployerWorkspacePage').then(module=>({default:module.EmployerWorkspacePage})));
const MyEmployerApplicationsPage=lazy(()=>import('./pages/MyEmployerApplicationsPage').then(module=>({default:module.MyEmployerApplicationsPage})));
const EmployerReviewPage=lazy(()=>import('./pages/EmployerReviewPage').then(module=>({default:module.EmployerReviewPage})));
const AdminRecruitmentPage=lazy(()=>import('./pages/AdminRecruitmentPage').then(module=>({default:module.AdminRecruitmentPage})));
const WorkspacePage=lazy(()=>import('./pages/WorkspacePage').then(module=>({default:module.WorkspacePage})));
const SiteSearchPage=lazy(()=>import('./pages/SiteSearchPage').then(module=>({default:module.SiteSearchPage})));
function AppLoadingState(){
 return <main className="app-shell" role="status" aria-busy="true" aria-label="正在打开汇方职场"
   style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f7f9f8'}}>
   <div style={{textAlign:'center',padding:'30px 22px',color:'#244e3c'}}>
     <strong style={{fontSize:21}}>汇方职场 · HHBA</strong>
     <p style={{fontSize:13,marginTop:14,color:'#667e71'}}>正在打开完整网站…</p>
   </div>
 </main>;
}
function App(){const route=useRoute();const [user,setUser]=useState<User|null>(null);const [ready,setReady]=useState(false);
useEffect(()=>{
 let mounted=true;
 async function restore(){
  try{
   // Remove only obsolete local prototype identity. Never touch PNVS tokens,
   // account-backed bookmarks or any real user data.
   try{window.localStorage.removeItem('hhba.demo.candidate.v1');}catch{}
   if(realAuthReady&&getRealAuthToken()){
    try{const me=await realAuth.me();if(mounted){setUser(realAuthToUser(me));return;}}
    catch(e){if(e instanceof ApiError&&e.status===401)clearRealAuthToken();
      else console.warn('Unable to restore real candidate session',e);}
   }
   if(employerApiReady){
    try{const me=await api.me();if(mounted)setUser(me);}
    catch(e){if(!(e instanceof ApiError&&e.status===401))console.warn('Unable to restore session',e);}
   }
  }finally{if(mounted)setReady(true);}
 }
 void restore();
 return()=>{mounted=false};
},[]);
const logout=async()=>{
 try{
  if(realAuthReady&&getRealAuthToken())await realAuth.logout();
  else if(employerApiReady)await api.logout();
 }finally{clearRealAuthToken();setUser(null);navigate('/candidate/login');}
};if(!ready)return <AppLoadingState/>;if(route==='/search')return <Suspense fallback={<AppLoadingState/>}><SiteSearchPage user={user}/></Suspense>;if(route==='/data-use')return <DataUsePage user={user}/>;if(route==='/')return <HomePage user={user}/>;if(route==='/winter-internship')return <WinterInternshipPage user={user}/>;if(/^\/winter-internship\/[a-z0-9-]{3,100}$/.test(route))return <WinterInternshipPage user={user} slug={route.slice('/winter-internship/'.length)}/>;if(route==='/study-abroad')return <OverseasDevelopmentPage user={user}/>;if(route==='/study-abroad/legacy')return <StudyAbroadPage user={user}/>;if(route==='/study-abroad/country/new-zealand')return <OverseasDevelopmentPage user={user} view="country"/>;if(route.startsWith('/study-abroad/nz/occupation/'))return <OverseasOccupationDetailPage user={user} country="nz" id={route.slice('/study-abroad/nz/occupation/'.length)}/>;if(route==='/study-abroad/saved')return <OverseasDevelopmentPage user={user} view="saved"/>;if(route==='/study-abroad/compare')return <OverseasDevelopmentPage user={user} view="compare"/>;if(route==='/study-abroad/match')return <OverseasDevelopmentPage user={user} view="match"/>;if(route.startsWith('/study-abroad/pathway/'))return <OverseasDevelopmentPage user={user} view="pathway" pathwayId={route.slice('/study-abroad/pathway/'.length)}/>;if(route==='/study-abroad/country/united-states')return <UnitedStatesDevelopmentPage user={user}/>;if(route==='/study-abroad/united-states/saved')return <UnitedStatesDevelopmentPage user={user} view="saved"/>;if(route==='/study-abroad/united-states/compare')return <UnitedStatesDevelopmentPage user={user} view="compare"/>;if(route==='/study-abroad/united-states/match')return <UnitedStatesDevelopmentPage user={user} view="match"/>;if(route.startsWith('/study-abroad/united-states/pathway/'))return <UnitedStatesDevelopmentPage user={user} view="pathway" pathwayId={route.slice('/study-abroad/united-states/pathway/'.length)}/>;if(route==='/study-abroad/country/singapore')return <SingaporeDevelopmentPage user={user}/>;if(route==='/study-abroad/singapore/saved')return <SingaporeDevelopmentPage user={user} view="saved"/>;if(route==='/study-abroad/singapore/compare')return <SingaporeDevelopmentPage user={user} view="compare"/>;if(route==='/study-abroad/singapore/match')return <SingaporeDevelopmentPage user={user} view="match"/>;if(route.startsWith('/study-abroad/singapore/pathway/'))return <SingaporeDevelopmentPage user={user} view="pathway" pathwayId={route.slice('/study-abroad/singapore/pathway/'.length)}/>;if(route==='/study-abroad/country/united-kingdom')return <UnitedKingdomDevelopmentPage user={user}/>;if(route==='/study-abroad/united-kingdom/saved')return <UnitedKingdomDevelopmentPage user={user} view="saved"/>;if(route==='/study-abroad/united-kingdom/compare')return <UnitedKingdomDevelopmentPage user={user} view="compare"/>;if(route==='/study-abroad/united-kingdom/match')return <UnitedKingdomDevelopmentPage user={user} view="match"/>;if(route.startsWith('/study-abroad/united-kingdom/pathway/'))return <UnitedKingdomDevelopmentPage user={user} view="pathway" pathwayId={route.slice('/study-abroad/united-kingdom/pathway/'.length)}/>;if(route==='/study-abroad/country/canada')return <CanadaDevelopmentPage user={user}/>;
 if(route==='/study-abroad/canada/saved')return <CanadaDevelopmentPage user={user} view="saved"/>;
 if(route==='/study-abroad/canada/compare')return <CanadaDevelopmentPage user={user} view="compare"/>;
 if(route==='/study-abroad/canada/match')return <CanadaDevelopmentPage user={user} view="match"/>;
 if(route.startsWith('/study-abroad/canada/pathway/'))return <CanadaDevelopmentPage user={user} view="pathway" pathwayId={route.slice('/study-abroad/canada/pathway/'.length)}/>;
 if(route.startsWith('/study-abroad/canada/occupation/')){const parts=route.slice('/study-abroad/canada/occupation/'.length).split('/');if((parts[0]==='express'||parts[0]==='pnp')&&parts.length===2)return <CanadaOccupationDetailPage user={user} track={parts[0]} id={parts[1]}/>;}
 if(route==='/study-abroad/country/germany')return <GermanyDevelopmentPage user={user}/>;
 if(route==='/study-abroad/germany/saved')return <GermanyDevelopmentPage user={user} view="saved"/>;
 if(route==='/study-abroad/germany/compare')return <GermanyDevelopmentPage user={user} view="compare"/>;
 if(route==='/study-abroad/germany/match')return <GermanyDevelopmentPage user={user} view="match"/>;
 if(route.startsWith('/study-abroad/germany/pathway/'))return <GermanyDevelopmentPage user={user} view="pathway" pathwayId={route.slice('/study-abroad/germany/pathway/'.length)}/>;
 if(route.startsWith('/study-abroad/germany/occupation/')){const parts=route.slice('/study-abroad/germany/occupation/'.length).split('/');if((parts[0]==='blue'||parts[0]==='training')&&parts.length===2)return <GermanyOccupationDetailPage user={user} track={parts[0]} id={parts[1]}/>;}
 if(route==='/study-abroad/country/japan')return <JapanDevelopmentPage user={user}/>;
 if(route==='/study-abroad/japan/saved')return <JapanDevelopmentPage user={user} view="saved"/>;
 if(route==='/study-abroad/japan/compare')return <JapanDevelopmentPage user={user} view="compare"/>;
 if(route==='/study-abroad/japan/match')return <JapanDevelopmentPage user={user} view="match"/>;
 if(route.startsWith('/study-abroad/japan/pathway/'))return <JapanDevelopmentPage user={user} view="pathway" pathwayId={route.slice('/study-abroad/japan/pathway/'.length)}/>;
 if(route.startsWith('/study-abroad/japan/occupation/')){const parts=route.slice('/study-abroad/japan/occupation/'.length).split('/');if((parts[0]==='jp-ssw1'||parts[0]==='jp-ssw2'||parts[0]==='jp-engineer')&&parts.length===2)return <JapanOccupationDetailPage user={user} track={parts[0]} id={parts[1]}/>;}
 if(route==='/study-abroad/country/australia')return <AustraliaDevelopmentPage user={user}/>;if(route.startsWith('/study-abroad/australia/occupation/'))return <OverseasOccupationDetailPage user={user} country="au" id={route.slice('/study-abroad/australia/occupation/'.length)}/>;if(route==='/study-abroad/australia/saved')return <AustraliaDevelopmentPage user={user} view="saved"/>;if(route==='/study-abroad/australia/compare')return <AustraliaDevelopmentPage user={user} view="compare"/>;if(route==='/study-abroad/australia/match')return <AustraliaDevelopmentPage user={user} view="match"/>;if(route.startsWith('/study-abroad/australia/pathway/'))return <AustraliaDevelopmentPage user={user} view="pathway" pathwayId={route.slice('/study-abroad/australia/pathway/'.length)}/>;if(route.startsWith('/study-abroad/'))return <StudyAbroadPage user={user} slug={route.slice('/study-abroad/'.length)}/>;if(route==='/join')return <JoinUsPage user={user}/>;if(route==='/vision')return <VisionPage user={user}/>;if(route==='/talent-service')return <TalentServicePage user={user}/>;if(route.startsWith('/talent-service/'))return <TalentServiceRoutes key={route} user={user} route={route}/>;if(route==='/companies/library'||/^\/companies\/library\/[a-z0-9-]{3,40}$/.test(route))return <IndustryLibraryPage user={user} hallId={route.startsWith('/companies/library/')?route.slice('/companies/library/'.length):undefined}/>;if(route==='/companies/discover')return <Company200PreviewPage user={user}/>;if(route==='/candidate/domestic-autumn')return <DomesticAutumnPage user={user}/>;if(route==='/companies/autumn/cn-autumn-001')return <KpmgCompactProfilePage user={user}/>;if(route==='/companies/autumn/cn-autumn-002')return <SchneiderCompactProfilePage user={user}/>;if(route==='/companies/autumn/cn-autumn-003')return <PfizerCompactProfilePage user={user}/>;if(route==='/companies/autumn/cn-autumn-004')return <CsairCompactProfilePage user={user}/>;if(route==='/companies/autumn/cn-autumn-005')return <SfExpressCompactProfilePage user={user}/>;if(route==='/companies/autumn/cn-autumn-006')return <NeteaseGamesCompactProfilePage user={user}/>;if(route==='/companies/autumn/cn-autumn-007')return <HypergryphCompactProfilePage user={user}/>;if(route==='/companies/autumn/cn-autumn-008')return <AnkerCompactProfilePage user={user}/>;if(route==='/companies/autumn/cn-autumn-009')return <LaifenCompactProfilePage user={user}/>;
 if(route==='/companies/autumn/cn-autumn-010')return <ShkpCompactProfilePage user={user}/>;
 if(route==='/companies/autumn/cn-autumn-011')return <BoyuCompactProfilePage user={user}/>;
 if(employerProfileByRoute.has(route))return <UnifiedV2CompanyPage user={user} id={route.split('/').pop()!}/>;if(/^\/companies\/autumn\/cn-autumn-[0-9]{3}$/.test(route))return <AutumnCompanyProfilePage user={user} id={route.split('/').pop()!}/>;if(route==='/companies/domestic/rel-huayu-004')return <HuayuVisionCompactProfilePage user={user}/>;if(route==='/companies/domestic/a-600909')return <HuaanSecuritiesCompactProfilePage user={user}/>;if(route==='/companies/domestic/a-000776')return <GuangfaSecuritiesCompactProfilePage user={user}/>;if(route==='/companies/domestic/a-600030')return <CiticsSecuritiesCompactProfilePage user={user}/>;if(/^\/companies\/domestic\/(?:a-[0-9]{6}|cn-B1-[0-9]{3}|spot-[^/]{2,100}|rel-[a-z]+-[0-9]{3}|group-geely|profile-[a-z0-9-]{3,150})$/.test(route))return <DomesticCompanyPage user={user} id={decodeURIComponent(route.split('/').pop()!)}/>;if(/^\/majors\/[a-z-]{3,80}$/.test(route))return <MajorCompaniesPage user={user} slug={route.split('/').pop()!}/>;if(route==='/companies')return <CompanyDirectoryPage user={user}/>;
  if(/^\/companies\/id\/[A-Za-z0-9_-]{12,600}$/.test(route))return <IndexedCompanyPage user={user} encodedId={route.split('/').pop()!}/>;
  if(/^\/companies\/[a-z-]{2,60}$/.test(route))return <CompanyProfilePage user={user} slug={route.split('/').pop()!}/>;if(route==='/auth')return <AuthChoicePage/>;if(route==='/candidate/login'||route==='/candidate/register')return <PhoneAuthPage user={user} onUser={setUser} accountType="candidate" initialMode={route.endsWith('/register')?'register':'login'}/>;if(route==='/recruiter/login'||route==='/recruiter/register'||route==='/recruiter')return <PhoneAuthPage user={user} onUser={setUser} accountType="recruiter" initialMode={route.endsWith('/register')?'register':'login'}/>;if(route==='/candidate/email-login'||route==='/candidate/email-register')return <AuthPage user={user} onUser={setUser} accountType="candidate" initialMode={route.endsWith('register')?'register':'login'}/>;if(route==='/recruiter/email-login'||route==='/recruiter/email-register')return <AuthPage user={user} onUser={setUser} accountType="recruiter" initialMode={route.endsWith('register')?'register':'login'}/>;if(route==='/recruiter/onboarding')return <RecruiterWelcomePage user={user}/>;if(route==='/recruiter/onboarding/company')return <CompanyStepPage user={user}/>;if(route==='/recruiter/onboarding/documents')return <DocumentsStepPage user={user}/>;if(route==='/recruiter/onboarding/representative')return <RepresentativeStepPage user={user}/>;if(route==='/recruiter/onboarding/submit')return <SubmitReviewPage user={user}/>;if(route==='/candidate/official-outbound')return <OfficialRecruitmentContinuePage user={user}/>;if(route==='/candidate')return user?.account_types?.includes('candidate')?<PersonalCenterPage user={user} onLogout={logout}/>:<UnifiedJobMarket user={user}/>;if(route==='/candidate/account')return <PersonalCenterPage user={user} onLogout={logout}/>;if(/^\/candidate\/account\/(profile|preferences|resume|applications|privacy|apply-assistant)$/.test(route))return <PersonalCenterPage user={user} onLogout={logout} section={route.split('/').pop() as 'profile'|'preferences'|'resume'|'applications'|'privacy'|'apply-assistant'}/>;if(route==='/candidate/saved')return <PersonalCenterPage user={user} onLogout={logout} onlySaved/>;if(route==='/candidate/account/legal-aid')return <LegalAidLandingPage user={user}/>;if(route==='/candidate/account/legal-aid/intervention')return <LegalAidInterventionPage user={user}/>;if(/^\/candidate\/account\/legal-aid\/[a-z-]{5,60}$/.test(route))return <LegalAidTopicPage user={user} slug={route.split('/').pop()!}/>;if(route==='/candidate/resume/new')return <ResumeUploadPage user={user}/>;if(route==='/candidate/match')return <CandidateMatchPage user={user}/>;if(route==='/candidate/jobs')return <UnifiedJobMarket user={user}/>;if(route==='/candidate/jobs/archive')return <CandidateJobsPage user={user}/>;if(/^\/candidate\/jobs\/[A-Za-z0-9_-]{1,180}$/.test(route)){const id=route.split('/').pop()!;return /^(JOB-|ATS-)/.test(id)?<CandidateJobDetailPage user={user} jobId={id}/>:<UnifiedJobDetail user={user} jobId={id}/>;}if(route.startsWith('/candidate/resume/'))return <ResumePage user={user} resumeId={route.split('/').pop()!}/>;if(route==='/candidate/review')return <ReviewPage user={user}/>;if(route==='/candidate/profile')return <ProfilePage user={user}/>;if(route.startsWith('/public/'))return <PublicProfilePage slug={route.split('/').pop()!}/>;if(route==='/admin/recruitment')return <AdminRecruitmentPage user={user}/>;if(route==='/candidate/employer-jobs')return <EmployerPublicJobsPage user={user}/>;if(route==='/candidate/my-applications')return <MyEmployerApplicationsPage user={user}/>;if(/^\/candidate\/employer-jobs\/[a-fA-F0-9-]{36}$/.test(route))return <EmployerPublicJobDetail user={user} id={route.split('/').pop()!}/>;if(route==='/admin/employer-review')return <EmployerReviewPage user={user}/>;if(route==='/employer/start'||route==='/employer/start/')return <EmployerStartPage user={user}/>;if(route==='/employer/onboarding-preview'||route==='/employer/onboarding-preview/')return <EmployerOnboardingPreviewPage user={user}/>;if(route==='/employer/aid/apply'||route==='/employer/aid/apply/')return <EmployerAidApplicationPage user={user}/>;
if(route==='/employer/commercial'||route==='/employer/commercial/')return <EmployerCommercialPage user={user}/>;
if(route==='/admin/employer-aid'||route==='/admin/employer-aid/')return <AdminAidCommercialPage user={user}/>;
if(route==='/employer/verified-profile'||route==='/employer/verified-profile/')return <EmployerVerifiedProfilePage user={user}/>;
if(route==='/admin/employer-publication'||route==='/admin/employer-publication/')return <AdminEmployerPublicationPage user={user}/>;
if(route==='/employer/improvements'||route==='/employer/improvements/')return <EmployerImprovementsPage user={user}/>;
if(route==='/employer/improvements/public'||route==='/employer/improvements/public/')return <PublicEmployerImprovementsPage user={user}/>;
if(route==='/admin/employer-improvements'||route==='/admin/employer-improvements/')return <AdminEmployerImprovementsPage user={user}/>;
if(route==='/employer/appeals'||route==='/employer/appeals/')return <EmployerAppealsPage user={user}/>;
if(route==='/employee/privacy-concerns'||route==='/employee/privacy-concerns/')return <EmployeePrivacyConcernsPage user={user}/>;
if(route==='/admin/employer-appeals'||route==='/admin/employer-appeals/')return <AdminAppealsReviewPage user={user}/>;
if(route==='/employer/scoring'||route==='/employer/scoring/')return <EmployerScoringPage user={user}/>;
if(route==='/admin/employer-scoring'||route==='/admin/employer-scoring/')return <AdminEmployerScoringPage user={user}/>;
if(route==='/employee/feedback'||route==='/employee/feedback/')return <EmployeeFeedbackPage user={user}/>;if(route==='/employer/evidence'||route==='/employer/evidence/')return <EmployerEvidencePage user={user}/>;if(route==='/admin/employer-evidence'||route==='/admin/employer-evidence/')return <AdminEmployerEvidencePage user={user}/>;if(route==='/employer/hub'||route==='/employer/hub/')return <EmployerGrowthHubPage user={user} view="dashboard"/>;if(route==='/employer/growth'||route==='/employer/growth/')return <EmployerGrowthHubPage user={user} view="growth"/>;if(route==='/employer/aid'||route==='/employer/aid/')return <EmployerGrowthHubPage user={user} view="aid"/>;if(route==='/employer/public'||route==='/employer/public/')return <EmployerGrowthHubPage user={user} view="public"/>;if(route==='/employer/workspace'||route==='/employer/workspace/')return <EmployerWorkspacePage user={user}/>;if(route==='/employer')return <EmployerPage user={user}/>;if(route==='/workspace'&&user)return <WorkspacePage user={user} onLogout={logout}/>;navigate('/');return null;}
createRoot(document.getElementById('root')!).render(<><Suspense fallback={<AppLoadingState/>}><App/></Suspense><AnonymousTrafficTracker/></>);
