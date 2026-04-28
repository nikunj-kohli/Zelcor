import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const Layout = () => {
  const location = useLocation();
  const path = location.pathname;

  // Define which pages should have the sidebar
  // User said: home, my order, zelcor wallet, complaints
  const sidebarPaths = ['/dashboard', '/orders', '/wallet', '/complaints'];
  const showSidebar = sidebarPaths.includes(path) || path.startsWith('/complaint/');

  return (
    <div className="bg-[#f8f9fc] text-[#191c1e] min-h-screen font-body-lg flex">
      {showSidebar && <Sidebar />}
      
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
