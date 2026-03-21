import React, { useState } from 'react';
import {
  Play, SkipBack, SkipForward, Volume2,
  ListMusic, Home, Search, Heart, LayoutGrid,
  Settings, Music, Plus, FolderOpen
} from 'lucide-react';
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

// --- 类型定义 ---
interface Track {
  name: string;
  path: string;
}

// --- 子组件：导航项 ---
const NavItem = ({ icon, label, active = false, onClick }: any) => (
  <div onClick={onClick} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all ${active ? 'bg-white/10 text-white border border-white/10' : 'text-white/40 hover:bg-white/5 hover:text-white/70'}`}>
    {icon}
    <span className="font-medium text-sm">{label}</span>
  </div>
);

// --- 子组件：歌曲卡片 ---
const SongCard = ({ track, index }: { track: Track, index: number }) => (
  <div className="group cursor-pointer">
    <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 shadow-lg border border-white/5 group-hover:border-white/10 transition-all">
      <img src={`https://picsum.photos/seed/${index + 100}/400/400`} className="object-cover w-full h-full transition duration-700 group-hover:scale-110" alt="封面" />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-[2px]">
        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 transform translate-y-4 group-hover:translate-y-0 transition-transform shadow-xl">
          <Play fill="white" size={24} className="ml-1 text-white" />
        </div>
      </div>
    </div>
    <h3 className="font-medium truncate text-white/90 text-sm">{track.name.replace(/\.[^/.]+$/, "")}</h3>
    <p className="text-xs text-white/40 truncate mt-0.5">本地音乐</p>
  </div>
);

// --- 主组件 ---
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('本地音乐');
  const [tracks, setTracks] = useState<Track[]>([]);

  // 核心逻辑：导入文件夹
  const handleImport = async () => {
    try {
      console.log("准备打开文件夹选择框...");
      // 1. 弹出文件夹选择框
      const selected = await open({
        directory: true,
        multiple: false,
        title: "请选择存放音乐的文件夹"
      });

      console.log("选择结果:", selected);

      if (selected && typeof selected === 'string') {
        // 2. 调用后端 Rust 函数获取文件
        const fileList: Track[] = await invoke("get_music_files", { dirPath: selected });
        setTracks(fileList);
        setActiveTab('本地音乐');
      }
    } catch (err) {
      console.error("导入失败:", err);
      alert("无法导入音乐，请检查权限配置。\n错误详情: " + err);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#020617] text-white overflow-hidden flex items-center justify-center p-4">
      <div className="w-full h-full max-w-[1280px] max-h-[900px] bg-white/[0.03] backdrop-blur-3xl rounded-[32px] border border-white/10 shadow-2xl flex overflow-hidden relative">

        {/* 左侧导航 */}
        <aside className="w-64 border-r border-white/5 flex flex-col p-6 bg-black/20 shrink-0">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20"><Music size={22} /></div>
            <span className="font-bold text-xl tracking-tight">金丝楠音乐</span>
          </div>
          <nav className="flex-1 space-y-8">
            <div>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-[2px] mb-4 px-2">发现</p>
              <NavItem icon={<Home size={18} />} label="浏览" active={activeTab === '浏览'} onClick={() => setActiveTab('浏览')} />
              <NavItem icon={<Search size={18} />} label="搜索" active={activeTab === '搜索'} onClick={() => setActiveTab('搜索')} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-[2px] mb-4 px-2">我的媒体库</p>
              <NavItem icon={<ListMusic size={18} />} label="本地音乐" active={activeTab === '本地音乐'} onClick={() => setActiveTab('本地音乐')} />
              <NavItem icon={<Heart size={18} />} label="我的收藏" active={activeTab === '我的收藏'} onClick={() => setActiveTab('我的收藏')} />
            </div>
          </nav>
        </aside>

        {/* 中间内容 */}
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-20 flex items-center justify-between px-8 shrink-0">
            <h2 className="text-xl font-semibold text-white/90">{activeTab}</h2>
            {/* 导入按钮 */}
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-full text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
            >
              <FolderOpen size={16} /> 导入本地音乐
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-8 pb-36 custom-scrollbar">
            {tracks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                <Music size={80} strokeWidth={1} className="mb-4" />
                <p className="text-sm tracking-widest">暂无音乐，请点击右上角“导入本地音乐”</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {tracks.map((track, i) => (
                  <SongCard key={i} track={track} index={i} />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* 底部播放栏 */}
        <footer className="absolute bottom-6 left-6 right-6 h-24 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[28px] shadow-2xl flex items-center px-8 z-50">
          <div className="flex items-center gap-4 w-[30%] min-w-0">
            <div className="w-14 h-14 rounded-xl overflow-hidden shadow-lg ring-1 ring-white/20 shrink-0 bg-white/5 flex items-center justify-center">
              <Music size={24} className="opacity-20" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-white truncate text-sm">{tracks[0]?.name.replace(/\.[^/.]+$/, "") || "未选择歌曲"}</h4>
              <p className="text-xs text-white/40 truncate">本地音轨</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center gap-2.5">
            <div className="flex items-center gap-7">
              <SkipBack size={20} className="text-white/30 hover:text-white cursor-pointer" />
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all">
                <Play fill="black" size={22} className="ml-0.5 text-black" />
              </div>
              <SkipForward size={20} className="text-white/30 hover:text-white cursor-pointer" />
            </div>
            <div className="w-full max-w-md flex items-center gap-3">
              <span className="text-[10px] text-white/20 font-mono w-8 text-right">0:00</span>
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full w-0 bg-indigo-500" />
              </div>
              <span className="text-[10px] text-white/20 font-mono w-8">0:00</span>
            </div>
          </div>

          <div className="w-[30%] flex items-center justify-end gap-4">
            <Volume2 size={18} className="text-white/30" />
            <div className="w-20 h-1 bg-white/10 rounded-full">
              <div className="h-full w-2/3 bg-white/40" />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;