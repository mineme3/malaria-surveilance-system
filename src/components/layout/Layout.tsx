import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { InstallBanner } from '../pwa/InstallPrompt';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:ml-64">
        <Header />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <InstallBanner />
    </div>
  );
}
