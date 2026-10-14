import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import './styles.css';
import { api, ApiError, type User } from './services/api';
import { useRoute, navigate } from './router';
import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { CandidatePage, ProfilePage, PublicProfilePage, ResumePage, ReviewPage } from './pages/CandidatePages';
import { EmployerPage } from './pages/EmployerPage';
import { WorkspacePage } from './pages/WorkspacePage';
function App(){const route=useRoute();const [user,setUser]=useState<User|null>(null);const [ready,setReady]=useState(false);useEffect(()=>{api.me().then(setUser).catch((e)=>{if(!(e instanceof ApiError&&e.status===401))console.warn('Unable to restore session',e);}).finally(()=>setReady(true));},[]);const logout=async()=>{try{await api.logout();}finally{setUser(null);navigate('/');}};if(!ready)return <main className="app-shell" aria-busy="true"/>;if(route==='/')return <HomePage user={user}/>;if(route==='/auth'||route==='/candidate/login'||route==='/candidate/register')return <AuthPage user={user} onUser={setUser} accountType="candidate"/>;if(route==='/recruiter/login'||route==='/recruiter/register'||route==='/recruiter')return <AuthPage user={user} onUser={setUser} accountType="recruiter"/>;if(route==='/candidate')return <CandidatePage user={user}/>;if(route.startsWith('/candidate/resume/'))return <ResumePage user={user} resumeId={route.split('/').pop()!}/>;if(route==='/candidate/review')return <ReviewPage user={user}/>;if(route==='/candidate/profile')return <ProfilePage user={user}/>;if(route.startsWith('/public/'))return <PublicProfilePage slug={route.split('/').pop()!}/>;if(route==='/employer')return <EmployerPage user={user}/>;if(route==='/workspace'&&user)return <WorkspacePage user={user} onLogout={logout}/>;navigate('/');return null;}
createRoot(document.getElementById('root')!).render(<App/>);
