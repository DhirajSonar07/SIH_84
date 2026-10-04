import { createBrowserRouter } from 'react-router';
import Shell from '../components/Shell';
import CommandCenter from '../pages/CommandCenter';
import { NowcastPage, RadarPage, HazardsPage, ScenariosPage, PerformancePage, TechnicalPage } from '../pages/AnalysisPages';
export const router = createBrowserRouter([{ path:'/', Component:Shell, children:[{index:true,Component:CommandCenter},{path:'nowcast',Component:NowcastPage},{path:'radar',Component:RadarPage},{path:'hazards',Component:HazardsPage},{path:'scenarios',Component:ScenariosPage},{path:'performance',Component:PerformancePage},{path:'technical',Component:TechnicalPage},{path:'*',Component:CommandCenter}] }]);
