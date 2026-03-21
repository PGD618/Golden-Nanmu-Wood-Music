import React from 'react';
import {
  Play, SkipBack, SkipForward, Volume2,
  ListMusic, Home, Search, Heart, LayoutGrid,
  Settings, Music
} from 'lucide-react';

// 定义导航项的 Props 类型
interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active = false }) => (
  <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${active
      ? 'bg-white/15 text-white shadow-sm border border-white/10'
      : 'text-white/40 hover:bg-white/5 hover:text-white/80'
    }`}>
    {icon}
    <span className="font-medium text-sm">{label}</span>
  </div>
);

const App: React.FC = () => {
  return (
    // 基础容器：背景色设为深色，确保即使透明度没调好也能看到内容
    <div className="h-screen w-screen bg-[#0f172a] text-white overflow-hidden flex items-center justify-center p-4">

      {/* 磨砂玻璃主面板 */}
      <div className="w-full h-full max-w-[1200px] max-h-[800px] bg-white/5 backdrop-blur-2xl rounded-[32px] border border-white/10 shadow-2xl flex overflow-hidden relative">

        {/* 1. 左侧导航栏 */}
        <aside className="w-64 border-r border-white/5 flex flex-col p-6 bg-black/20 shrink-0">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Music size={24} className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">MeloStream</span>
          </div>

          <nav className="flex-1 space-y-8">
            <div>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-[2px] mb-4 px-2">Discovery</p>
              <div className="space-y-1">
                <NavItem icon={<Home size={18} />} label="Explore" active />
                <NavItem icon={<LayoutGrid size={18} />} label="Albums" />
                <NavItem icon={<Search size={18} />} label="Search" />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-[2px] mb-4 px-2">Library</p>
              <div className="space-y-1">
                <NavItem icon={<Heart size={18} />} label="Favorites" />
                <NavItem icon={<ListMusic size={18} />} label="Local Tracks" />
              </div>
            </div>
          </nav>

          <div className="mt-auto pt-6 border-t border-white/5">
            <NavItem icon={<Settings size={18} />} label="Settings" />
          </div>
        </aside>

        {/* 2. 中间内容区 */}
        <main className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-white/[0.02] to-transparent">
          <header className="h-20 flex items-center justify-between px-8">
            <h2 className="text-xl font-semibold text-white/90">Recently Played</h2>
          </header>

          <div className="flex-1 overflow-y-auto px-8 pb-32">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="group cursor-pointer">
                  <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 shadow-xl border border-white/5">
                    <img
                      src={`https://picsum.photos/seed/${i + 10}/400/400`}
                      className="object-cover w-full h-full transition duration-700 group-hover:scale-110"
                      alt="Cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm">
                      <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 transform translate-y-4 group-hover:translate-y-0 transition-transform">
                        <Play fill="white" size={28} className="ml-1" />
                      </div>
                    </div>
                  </div>
                  <h3 className="font-medium truncate text-white/90">Song Title {i}</h3>
                  <p className="text-sm text-white/40 truncate">Artist Name</p>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* 3. 悬浮播放控制栏 */}
        <footer className="absolute bottom-6 left-6 right-6 h-24 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[24px] shadow-2xl flex items-center px-8 z-50">
          <div className="flex items-center gap-4 w-[30%]">
            <div className="w-14 h-14 rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10">
              <img src="https://picsum.photos/seed/current/200/200" alt="Current" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-white truncate text-sm">Now Playing Song</h4>
              <p className="text-xs text-white/40 truncate">Unknown Artist</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center gap-3">
            <div className="flex items-center gap-8">
              <SkipBack size={20} className="text-white/40 hover:text-white cursor-pointer transition" />
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition shadow-xl shadow-white/5">
                <Play fill="black" size={22} className="ml-0.5 text-black" />
              </div>
              <SkipForward size={20} className="text-white/40 hover:text-white cursor-pointer transition" />
            </div>
            <div className="w-full max-w-md flex items-center gap-3">
              <span className="text-[10px] text-white/30 font-mono w-8 text-right">1:20</span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full relative group cursor-pointer overflow-hidden">
                <div className="absolute top-0 left-0 h-full w-1/3 bg-indigo-500 rounded-full" />
              </div>
              <span className="text-[10px] text-white/30 font-mono w-8">3:45</span>
            </div>
          </div>

          <div className="w-[30%] flex items-center justify-end gap-3">
            <Volume2 size={18} className="text-white/40" />
            <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-white/20" />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;