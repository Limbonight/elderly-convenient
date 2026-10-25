import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import ElderVoiceAssistant from './ElderVoiceAssistant';

const Layout = () => {
  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* 顶部导航 */}
      <header className="border-b-2 border-black bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-black">🏥 智慧挂号</h1>
          <nav className="flex gap-4">
            <NavLink
              to="/elder"
              className={({ isActive }) =>
                `text-lg font-bold px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[#1A73E8] text-white'
                    : 'text-black hover:bg-gray-100'
                }`
              }
            >
              老年端
            </NavLink>
            <NavLink
              to="/family"
              className={({ isActive }) =>
                `text-lg font-bold px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[#1A73E8] text-white'
                    : 'text-black hover:bg-gray-100'
                }`
              }
            >
              子女端
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `text-lg font-bold px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[#1A73E8] text-white'
                    : 'text-black hover:bg-gray-100'
                }`
              }
            >
              数据看板
            </NavLink>
          </nav>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>

      {/* 老年端全程语音助手（挂号页使用分步骤专用助手） */}
      <ElderVoiceAssistant />
    </div>
  );
};

export default Layout;
