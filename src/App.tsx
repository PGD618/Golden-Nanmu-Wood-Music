import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2,
  ListMusic, Heart, FolderOpen,
  Shuffle, Repeat, Repeat1, ChevronDown, Settings, X, Power
} from 'lucide-react';
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { LazyStore } from '@tauri-apps/plugin-store';
import logo from './assets/logo.png';

const store = new LazyStore('.settings.dat');

// 快捷键中英文对照表
const SHORTCUT_LABELS: Record<string, string> = {
  playPause: '播放 / 暂停',
  next: '下一首',
  prev: '上一首',
  volUp: '增加音量',
  volDown: '减小音量'
};

interface Track {
  name: string; path: string; artist: string; duration: number; cover?: string; lyrics?: string;
}

const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<'sequence' | 'shuffle' | 'loop'>('sequence');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [progress, setProgress] = useState(0);
  const [rawTime, setRawTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState<string | null>(null);

  // 1. 初始化设置，补全缺失的快捷键
  const [settings, setSettings] = useState({
    closeToTray: true,
    autoStart: false,
    shortcuts: {
      playPause: 'Alt+P',
      next: 'Alt+Right',
      prev: 'Alt+Left',
      volUp: 'Alt+Up',
      volDown: 'Alt+Down'
    }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrack = currentIdx >= 0 ? tracks[currentIdx] : null;

  // 使用 Ref 解决快捷键回调中的闭包陷阱
  const stateRef = useRef({ isPlaying, currentIdx, tracks, volume });
  useEffect(() => {
    stateRef.current = { isPlaying, currentIdx, tracks, volume };
  }, [isPlaying, currentIdx, tracks, volume]);

  // 初始化加载配置
  useEffect(() => {
    const init = async () => {
      const saved = await store.get<any>("config");
      if (saved) {
        // 合并配置，防止旧版本配置缺少新按键
        const mergedSettings = {
          ...settings,
          ...saved,
          shortcuts: { ...settings.shortcuts, ...saved.shortcuts }
        };
        setSettings(mergedSettings);
        await invoke("set_close_to_tray", { enabled: mergedSettings.closeToTray });
        rebindShortcuts(mergedSettings);
      }
    };
    init();
  }, []);

  // 2. 核心：重绑定所有快捷键逻辑
  const rebindShortcuts = async (s: typeof settings) => {
    await unregisterAll();
    try {
      // 播放暂停
      await register(s.shortcuts.playPause, (e) => {
        if (e.state === 'Pressed') {
          stateRef.current.isPlaying ? audioRef.current?.pause() : audioRef.current?.play();
        }
      });
      // 下一首
      await register(s.shortcuts.next, (e) => {
        if (e.state === 'Pressed') handleNext();
      });
      // 上一首
      await register(s.shortcuts.prev, (e) => {
        if (e.state === 'Pressed') playAtIndex(stateRef.current.currentIdx - 1);
      });
      // 音量加
      await register(s.shortcuts.volUp, (e) => {
        if (e.state === 'Pressed') {
          const newVol = Math.min(1, stateRef.current.volume + 0.1);
          setVolume(newVol);
          if (audioRef.current) audioRef.current.volume = newVol;
        }
      });
      // 音量减
      await register(s.shortcuts.volDown, (e) => {
        if (e.state === 'Pressed') {
          const newVol = Math.max(0, stateRef.current.volume - 0.1);
          setVolume(newVol);
          if (audioRef.current) audioRef.current.volume = newVol;
        }
      });
    } catch (err) { console.error("快捷键绑定失败", err); }
  };

  // 应用并保存设置
  const applySettings = async (newS: any) => {
    setSettings(newS);
    await store.set("config", newS);
    await store.save();
    await invoke("set_close_to_tray", { enabled: newS.closeToTray });
    if (newS.autoStart) { if (!(await isEnabled())) await enable(); } else { if (await isEnabled()) await disable(); }
    rebindShortcuts(newS);
  };

  const handleRecordKey = (e: React.KeyboardEvent) => {
    if (!isRecording) return;
    e.preventDefault();
    if (['Control', 'Alt', 'Shift'].includes(e.key)) return;
    const key = `${e.ctrlKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key.toUpperCase()}`;
    const newS = { ...settings, shortcuts: { ...settings.shortcuts, [isRecording]: key } };
    applySettings(newS);
    setIsRecording(null);
  };

  const playAtIndex = (idx: number) => {
    const list = stateRef.current.tracks;
    if (list.length === 0) return;
    let targetIdx = idx;
    if (idx < 0) targetIdx = list.length - 1;
    if (idx >= list.length) targetIdx = 0;

    setCurrentIdx(targetIdx);
    if (audioRef.current) {
      audioRef.current.src = convertFileSrc(list[targetIdx].path);
      audioRef.current.volume = stateRef.current.volume;
      audioRef.current.play();
    }
  };

  const handleNext = () => {
    const { tracks: list, currentIdx: idx } = stateRef.current;
    if (list.length === 0) return;
    const nextIdx = playMode === 'shuffle' ? Math.floor(Math.random() * list.length) : (idx + 1) % list.length;
    playAtIndex(nextIdx);
  };

  const parsedLyrics = useMemo(() => {
    if (!currentTrack?.lyrics) return [];
    const timeReg = /\[(\d+):(\d+\.\d+)\]/;
    return currentTrack.lyrics.split('\n').map(l => {
      const m = timeReg.exec(l);
      return m ? { time: parseInt(m[1]) * 60 + parseFloat(m[2]), text: l.replace(timeReg, '').trim() } : null;
    }).filter(l => l && l.text) as any[];
  }, [currentTrack]);

  const activeLyricIdx = useMemo(() => parsedLyrics.findIndex((l, i) => rawTime >= l.time && (!parsedLyrics[i + 1] || rawTime < parsedLyrics[i + 1].time)), [rawTime, parsedLyrics]);

  useEffect(() => { if (isDetailOpen && activeLyricIdx !== -1) document.getElementById(`lyric-${activeLyricIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [activeLyricIdx, isDetailOpen]);

  return (
    <div className="h-screen w-screen bg-[#020617] text-white overflow-hidden flex items-center justify-center p-4 select-none relative" onKeyDown={handleRecordKey}>
      <audio ref={audioRef} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => playMode === 'loop' ? playAtIndex(currentIdx) : handleNext()} onTimeUpdate={() => { if (audioRef.current && !isDragging) { setRawTime(audioRef.current.currentTime); setDuration(audioRef.current.duration || 0); setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0); } }} />

      {/* --- 全屏详情页 --- */}
      <div className={`fixed inset-0 z-100 bg-black transition-all duration-700 transform ${isDetailOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 opacity-30 blur-[120px] scale-150" style={{ background: currentTrack?.cover ? `url(${currentTrack.cover}) center/cover no-repeat` : '#1e293b' }} />
        <div className="relative h-full w-full flex flex-col p-10 max-w-[1600px] mx-auto">
          <header className="flex justify-between items-center mb-10 shrink-0">
            <div className="flex items-center gap-4"><img src={logo} className="w-12 h-12 bg-amber-600 rounded-lg p-2" /><h1 className="text-xl font-bold text-amber-500">金丝楠音乐</h1></div>
            <button onClick={() => setIsDetailOpen(false)} className="p-3 hover:bg-white/10 rounded-full"><ChevronDown size={32} /></button>
          </header>
          <div className="flex-1 flex flex-col md:flex-row items-center gap-20 overflow-hidden">
            <div className="w-[420px] shrink-0 text-center md:text-left">
              <div className={`aspect-square rounded-3xl overflow-hidden shadow-2xl transition-all duration-1000 ${isPlaying ? 'scale-100' : 'scale-90 opacity-60'}`}>
                {currentTrack?.cover ? <img src={currentTrack.cover} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center"><img src={logo} className="w-32 opacity-10" /></div>}
              </div>
              <h2 className="text-4xl font-bold mt-10 truncate">{currentTrack?.name || "未选择歌曲"}</h2>
              <p className="text-xl text-amber-500/80 mt-2">{currentTrack?.artist || "等待播放"}</p>
            </div>
            <div className="flex-1 h-full overflow-y-auto pr-4 custom-scrollbar-lyrics mask-linear-fade pb-[40%] pt-[20%] text-center">
              {parsedLyrics.length > 0 ? parsedLyrics.map((l, i) => (<p key={i} id={`lyric-${i}`} className={`text-2xl md:text-4xl font-bold mb-8 transition-all duration-500 ${activeLyricIdx === i ? 'text-white scale-105 opacity-100' : 'text-white/20 scale-95 opacity-40'}`}>{l.text}</p>)) : <div className="text-white/10 text-xl italic">暂无内嵌歌词</div>}
            </div>
          </div>
          <footer className="mt-10 shrink-0 space-y-6">
            <div className="flex items-center gap-4 text-xs font-mono text-white/40">
              <span className="w-12 text-right">{Math.floor(rawTime / 60)}:{String(Math.floor(rawTime % 60)).padStart(2, '0')}</span>
              <input type="range" min="0" max="100" step="0.01" value={progress} onMouseDown={() => setIsDragging(true)} onMouseUp={() => setIsDragging(false)} onChange={(e) => { const val = parseFloat(e.target.value); setProgress(val); if (audioRef.current) audioRef.current.currentTime = (val / 100) * audioRef.current.duration; }} style={{ background: `linear-gradient(to right, #f59e0b ${progress}%, rgba(255,255,255,0.1) ${progress}%)` }} className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-transparent slider-thumb-custom" />
              <span className="w-12">{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}</span>
            </div>
            <div className="flex justify-center items-center gap-12 text-white/40">
              <button onClick={() => setPlayMode(p => p === 'sequence' ? 'shuffle' : p === 'shuffle' ? 'loop' : 'sequence')}>{playMode === 'shuffle' ? <Shuffle className="text-amber-500" size={24} /> : playMode === 'loop' ? <Repeat1 className="text-amber-500" size={24} /> : <Repeat size={24} />}</button>
              <SkipBack onClick={() => playAtIndex(currentIdx - 1)} size={32} className="hover:text-white cursor-pointer" />
              <button onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition">{isPlaying ? <Pause size={36} /> : <Play size={36} className="ml-1" />}</button>
              <SkipForward onClick={() => playAtIndex(currentIdx + 1)} size={32} className="hover:text-white cursor-pointer" />
              <Heart size={24} className="hover:text-pink-500 cursor-pointer" />
            </div>
          </footer>
        </div>
      </div>

      {/* --- 主界面 --- */}
      <div className="w-full h-full bg-white/3 backdrop-blur-3xl rounded-[32px] border border-white/10 shadow-2xl flex overflow-hidden">
        <aside className="w-64 border-r border-white/5 flex flex-col p-6 bg-black/20 shrink-0">
          <div className="flex items-center gap-3 mb-10 group cursor-default">
            <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center overflow-hidden transition-transform group-hover:scale-110"><img src={logo} className="w-full h-full object-contain" /></div>
            <span className="font-bold text-xl tracking-tight bg-linear-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">金丝楠音乐</span>
          </div>
          <nav className="flex-1 space-y-2">
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/10 text-white font-medium border border-white/10"><ListMusic size={18} className="text-amber-500" /> 本地音乐库</button>
            <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all group"><Settings size={18} className="group-hover:rotate-45 transition-transform duration-500" /> 软件设置</button>
          </nav>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-20 flex items-center justify-between px-8 shrink-0">
            <h2 className="text-xl font-bold text-white/90 underline decoration-amber-500/30 underline-offset-8 tracking-widest">全部音乐 ({tracks.length})</h2>
            <button onClick={async () => { try { const sel = await open({ directory: true, multiple: false }); if (sel && typeof sel === 'string') { setTracks(await invoke("get_music_files", { dirPath: sel })); } } catch (e) { console.error(e) } }} className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-full text-xs font-bold shadow-lg active:scale-95 transition-all"><FolderOpen size={16} /> 导入音乐</button>
          </header>
          <div className="flex-1 overflow-y-auto px-8 pb-40 custom-scrollbar grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6 pt-4">
            {tracks.map((t, i) => (
              <div key={i} onClick={() => playAtIndex(i)} className="group cursor-pointer">
                <div className={`relative aspect-square rounded-2xl overflow-hidden mb-3 border transition-all ${currentIdx === i ? 'border-amber-500 ring-4 ring-amber-500/20 scale-95' : 'border-white/5 group-hover:border-white/10'}`}>
                  {t.cover ? <img src={t.cover} className="w-full h-full object-cover transition duration-500 group-hover:scale-110" /> : <div className="w-full h-full bg-slate-900 flex items-center justify-center opacity-40"><img src={logo} className="w-12 grayscale" /></div>}
                  <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${currentIdx === i ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {currentIdx === i && isPlaying ? <div className="flex gap-1 h-6 items-end"><div className="w-1 bg-amber-400 h-full animate-bounce"></div><div className="w-1 bg-amber-400 h-4 animate-bounce"></div><div className="w-1 bg-amber-400 h-6 animate-bounce"></div></div> : <Play fill="white" size={28} className="text-white ml-1" />}
                  </div>
                </div>
                <h3 className={`text-sm font-medium truncate ${currentIdx === i ? 'text-amber-400' : 'text-white'}`}>{t.name}</h3>
                <p className="text-xs text-white/40 truncate">{t.artist}</p>
              </div>
            ))}
          </div>
        </main>

        <footer className="absolute bottom-6 left-6 right-6 h-24 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[28px] shadow-2xl flex items-center px-8 z-50">
          <div className="flex items-center gap-4 w-[25%] min-w-0">
            <div onClick={() => setIsDetailOpen(true)} className="w-14 h-14 rounded-xl overflow-hidden ring-1 ring-white/20 cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center bg-amber-500/10">
              {currentTrack?.cover ? <img src={currentTrack.cover} className="w-full h-full object-cover" /> : <img src={logo} className="w-8 opacity-20" />}
            </div>
            <div className="min-w-0"><h4 onClick={() => setIsDetailOpen(true)} className="font-bold text-white truncate text-sm cursor-pointer hover:text-amber-400">{currentTrack?.name || "金丝楠音乐"}</h4><p className="text-xs text-white/40 truncate">{currentTrack?.artist || "等待播放"}</p></div>
          </div>
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="flex items-center gap-6 text-white/40">
              <button onClick={() => setPlayMode(p => p === 'sequence' ? 'shuffle' : p === 'shuffle' ? 'loop' : 'sequence')}>{playMode === 'shuffle' ? <Shuffle size={18} className="text-amber-500" /> : playMode === 'loop' ? <Repeat1 size={18} className="text-amber-500" /> : <Repeat size={18} />}</button>
              <SkipBack onClick={() => playAtIndex(currentIdx - 1)} size={22} className="hover:text-white" />
              <button onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition">{isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}</button>
              <SkipForward onClick={() => playAtIndex(currentIdx + 1)} size={22} className="hover:text-white" />
              <Heart size={18} className="hover:text-pink-500" />
            </div>
            <div className="w-full max-w-xl flex items-center gap-3">
              <span className="text-[10px] text-white/40 font-mono w-10 text-right">{Math.floor(rawTime / 60)}:{String(Math.floor(rawTime % 60)).padStart(2, '0')}</span>
              <input type="range" min="0" max="100" step="0.01" value={progress} onMouseDown={() => setIsDragging(true)} onMouseUp={() => setIsDragging(false)} onChange={(e) => { const val = parseFloat(e.target.value); setProgress(val); if (audioRef.current) audioRef.current.currentTime = (val / 100) * audioRef.current.duration }} style={{ background: `linear-gradient(to right, #f59e0b ${progress}%, rgba(255,255,255,0.1) ${progress}%)` }} className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-transparent slider-thumb-custom" />
              <span className="text-[10px] text-white/40 font-mono w-10">{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}</span>
            </div>
          </div>
          <div className="w-[25%] flex justify-end items-center gap-3">
            <Volume2 size={18} className="text-amber-500/60" />
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); if (audioRef.current) audioRef.current.volume = v }} style={{ background: `linear-gradient(to right, #f59e0b ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)` }} className="w-24 h-1 rounded-full appearance-none cursor-pointer accent-transparent slider-thumb-custom" />
          </div>
        </footer>
      </div>

      {/* --- 设置面板 (Modal) --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/70 backdrop-blur-xl animate-in fade-in duration-300 px-4">
          <div className="w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <header className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-3 text-amber-500"><Settings size={24} /><h3 className="text-xl font-bold text-white tracking-widest">设置</h3></div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              <section className="space-y-6">
                <div className="text-white/40 text-xs font-bold uppercase tracking-[0.2em]">常规设置</div>
                <div className="space-y-4">
                  {[
                    { id: 'closeToTray', label: '关闭窗口时隐藏到托盘', sub: '点击 [X] 将在后台运行' },
                    { id: 'autoStart', label: '开机自启动', sub: '随系统启动自动开启' }
                  ].map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-white/3 rounded-2xl hover:bg-white/5 transition-colors">
                      <div><p className="font-semibold text-white/90">{item.label}</p><p className="text-xs text-white/40">{item.sub}</p></div>
                      <div onClick={() => applySettings({ ...settings, [item.id]: !settings[item.id as keyof typeof settings] })} className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-300 ${settings[item.id as keyof typeof settings] ? 'bg-amber-600' : 'bg-white/10'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${settings[item.id as keyof typeof settings] ? 'left-7' : 'left-1'}`} /></div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. 修改后的全局快捷键 UI 遍历 */}
              <section className="space-y-6">
                <div className="text-white/40 text-xs font-bold uppercase tracking-[0.2em]">全局快捷键</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(settings.shortcuts).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-2 p-4 bg-white/3 rounded-2xl border border-white/5">
                      <span className="text-xs text-white/60">{SHORTCUT_LABELS[k] || k}</span>
                      <div onClick={() => setIsRecording(k)} className={`px-3 py-2 bg-black/40 rounded-lg text-sm font-mono text-amber-500 border transition-all cursor-pointer flex justify-between items-center ${isRecording === k ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-lg' : 'border-amber-500/20'}`}>
                        <span className="truncate mr-2">{isRecording === k ? '请按下按键...' : (v as string)}</span>
                        <kbd className="text-[10px] text-white/20 shrink-0">点击修改</kbd>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="pt-6 border-t border-white/5 flex items-center justify-between">
                <div className="text-[10px] text-white/10 uppercase font-mono">GOLDEN-NANMU-WOOD MUSIC v1.0.0</div>
                <button onClick={() => invoke("exit_app")} className="flex items-center gap-2 text-xs text-red-400/60 hover:text-red-400 transition-colors font-bold"><Power size={14} /> 彻底退出软件</button>
              </section>
            </div>

            <footer className="p-6 bg-white/5 text-center">
              <button onClick={() => setIsSettingsOpen(false)} className="px-12 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl transition-all shadow-xl active:scale-95">保存设置</button>
            </footer>
          </div>
        </div>
      )}

      <style>{`
        .slider-thumb-custom::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; background: white; border-radius: 50%; cursor: pointer; border: 3px solid #f59e0b; box-shadow: 0 0 15px rgba(0,0,0,0.5); transition: transform 0.2s; }
        .slider-thumb-custom:hover::-webkit-slider-thumb { transform: scale(1.3); }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar-lyrics::-webkit-scrollbar { width: 0px; }
        .mask-linear-fade { mask-image: linear-gradient(to bottom, transparent, black 15%, black 85%, transparent); }
      `}</style>
    </div>
  );
};

export default App;