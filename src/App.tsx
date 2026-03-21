import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2,
  ListMusic, Heart, FolderOpen,
  Shuffle, Repeat, Repeat1, ChevronDown
} from 'lucide-react';
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";

// --- 类型定义 ---
interface Track {
  name: string;
  path: string;
  artist: string;
  duration: number;
  cover?: string;
  lyrics?: string;
}

interface LyricLine {
  time: number;
  text: string;
}

const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<'sequence' | 'shuffle' | 'loop'>('sequence');

  // 详情页、音量与进度状态
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [progress, setProgress] = useState(0);
  const [rawTime, setRawTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrack = currentIdx >= 0 ? tracks[currentIdx] : null;

  // --- 歌词解析逻辑 ---
  const parsedLyrics = useMemo(() => {
    if (!currentTrack?.lyrics) return [];
    const lines = currentTrack.lyrics.split('\n');
    const result: LyricLine[] = [];
    const timeReg = /\[(\d+):(\d+\.\d+)\]/;
    lines.forEach(line => {
      const match = timeReg.exec(line);
      if (match) {
        const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
        const text = line.replace(timeReg, '').trim();
        if (text) result.push({ time, text });
      }
    });
    return result.sort((a, b) => a.time - b.time);
  }, [currentTrack]);

  const activeLyricIdx = useMemo(() => {
    return parsedLyrics.findIndex((l, i) => {
      const next = parsedLyrics[i + 1];
      return rawTime >= l.time && (!next || rawTime < next.time);
    });
  }, [rawTime, parsedLyrics]);

  useEffect(() => {
    if (isDetailOpen && activeLyricIdx !== -1) {
      document.getElementById(`lyric-${activeLyricIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLyricIdx, isDetailOpen]);

  // --- 核心播放逻辑 ---
  const handleImport = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        const fileList: Track[] = await invoke("get_music_files", { dirPath: selected });
        setTracks(fileList);
      }
    } catch (err) { console.error(err); }
  };

  const playAtIndex = (index: number) => {
    if (index < 0 || index >= tracks.length || !audioRef.current) return;
    setCurrentIdx(index);
    audioRef.current.src = convertFileSrc(tracks[index].path);
    audioRef.current.volume = volume;
    audioRef.current.play();
    setIsPlaying(true);
  };

  const handleNext = () => {
    if (tracks.length === 0) return;
    let nextIdx = playMode === 'shuffle' ? Math.floor(Math.random() * tracks.length) : (currentIdx + 1) % tracks.length;
    playAtIndex(nextIdx);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${m}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="h-screen w-screen bg-[#020617] text-white overflow-hidden flex items-center justify-center p-4 select-none">
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setRawTime(audioRef.current.currentTime);
            setDuration(audioRef.current.duration || 0);
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
          }
        }}
        onEnded={() => playMode === 'loop' ? playAtIndex(currentIdx) : handleNext()}
      />

      {/* --- 全屏详情页 --- */}
      <div className={`fixed inset-0 z-100 bg-black transition-all duration-700 ease-in-out transform ${isDetailOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
        }`}>
        <div className="absolute inset-0 opacity-30 blur-[120px] scale-150 transition-all duration-1000" style={{ background: currentTrack?.cover ? `url(${currentTrack.cover}) center/cover no-repeat` : '#1e293b' }} />
        <div className="relative h-full w-full flex flex-col p-10 max-w-7xl mx-auto">
          <header className="flex justify-between items-center mb-10 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-600 rounded-lg flex items-center justify-center shadow-lg overflow-hidden">
                <img src="/logo.png" className="w-8 h-8 object-contain" alt="Logo" />
              </div>
              <h1 className="text-xl font-bold tracking-widest text-amber-500">金丝楠音乐</h1>
            </div>
            <button onClick={() => setIsDetailOpen(false)} className="p-3 hover:bg-white/10 rounded-full transition-all group">
              <ChevronDown size={32} className="group-hover:translate-y-1 transition-transform" />
            </button>
          </header>

          <div className="flex-1 flex flex-col md:flex-row items-center gap-10 md:gap-20 overflow-hidden">
            <div className="w-[280px] md:w-[420px] shrink-0 flex flex-col items-center text-center md:text-left">
              <div className={`w-full aspect-square rounded-3xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.6)] transition-all duration-1000 ${isPlaying ? 'scale-100' : 'scale-90 opacity-60'}`}>
                {currentTrack?.cover ? <img src={currentTrack.cover} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center"><img src="/logo.png" className="w-32 h-32 opacity-10 object-contain" /></div>}
              </div>
              <div className="mt-10 w-full">
                <h2 className="text-3xl md:text-4xl font-bold mb-2 truncate px-4 md:px-0">{currentTrack?.name || "未选择歌曲"}</h2>
                <p className="text-xl text-amber-500/80 mb-8">{currentTrack?.artist || "等待播放"}</p>
              </div>
            </div>
            <div className="flex-1 h-full w-full relative overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar-lyrics mask-linear-fade pb-[50%] pt-[20%] text-center md:text-left">
                {parsedLyrics.length > 0 ? parsedLyrics.map((line, i) => (
                  <p key={i} id={`lyric-${i}`} className={`text-2xl md:text-4xl font-bold mb-8 transition-all duration-500 origin-left cursor-default ${activeLyricIdx === i ? 'text-white scale-105 opacity-100 filter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'text-white/20 scale-95 opacity-40 hover:text-white/40'}`}>
                    {line.text}
                  </p>
                )) : <div className="h-full flex items-center justify-center text-white/20 text-xl italic tracking-widest px-10">暂无内嵌歌词</div>}
              </div>
            </div>
          </div>

          <footer className="mt-10 shrink-0 space-y-6">
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono text-white/40 w-12">{formatTime(rawTime)}</span>
              <input type="range" min="0" max="100" value={progress} onChange={(e) => {
                if (audioRef.current) audioRef.current.currentTime = (parseFloat(e.target.value) / 100) * audioRef.current.duration;
              }} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500" />
              <span className="text-xs font-mono text-white/40 w-12">{formatTime(duration)}</span>
            </div>
            <div className="flex justify-center items-center gap-10">
              <SkipBack onClick={() => playAtIndex((currentIdx - 1 + tracks.length) % tracks.length)} size={32} className="cursor-pointer hover:text-amber-500 transition-colors" />
              <button onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} className="w-20 h-20 bg-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition shadow-2xl">
                {isPlaying ? <Pause size={36} className="text-black" /> : <Play size={36} className="text-black ml-1" />}
              </button>
              <SkipForward onClick={() => playAtIndex((currentIdx + 1) % tracks.length)} size={32} className="cursor-pointer hover:text-amber-500 transition-colors" />
            </div>
          </footer>
        </div>
      </div>

      {/* --- 主界面 --- */}
      <div className="w-full h-full max-w-[1280px] max-h-[900px] bg-white/3 backdrop-blur-3xl rounded-[32px] border border-white/10 shadow-2xl flex overflow-hidden relative">
        {/* 左侧侧边栏 */}
        <aside className="w-64 border-r border-white/5 flex flex-col p-6 bg-black/20 shrink-0">
          <div className="flex items-center gap-3 mb-10 px-2 group cursor-default">
            {/* 修改：侧边栏应用 Logo */}
            <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-600/20 overflow-hidden group-hover:scale-110 transition-transform">
              <img src="/logo.png" className="w-full h-full object-contain" alt="Logo" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-linear-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">金丝楠音乐</span>
          </div>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white font-medium shadow-inner"><ListMusic size={18} className="text-amber-500" /> 本地音乐库</button>
        </aside>

        {/* 主内容区域 */}
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-20 flex items-center justify-between px-8 shrink-0">
            <h2 className="text-xl font-semibold text-white/90 underline decoration-amber-500/30 underline-offset-8">全部音乐 ({tracks.length})</h2>
            <button onClick={handleImport} className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-full text-xs font-bold transition-all shadow-lg shadow-amber-600/20 active:scale-95"><FolderOpen size={16} /> 导入音乐</button>
          </header>

          <div className="flex-1 overflow-y-auto px-8 pb-40 custom-scrollbar">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pt-4">
              {tracks.map((track, i) => (
                <div key={i} onClick={() => playAtIndex(i)} className="group cursor-pointer">
                  <div className={`relative aspect-square rounded-2xl overflow-hidden mb-3 shadow-lg border transition-all ${currentIdx === i ? 'border-amber-500 ring-4 ring-amber-500/20 scale-95' : 'border-white/5 group-hover:border-white/10 group-hover:shadow-amber-500/5'}`}>
                    {track.cover ? <img src={track.cover} className="object-cover w-full h-full transition duration-500 group-hover:scale-110" /> : <div className="w-full h-full bg-slate-900 flex items-center justify-center opacity-40"><img src="/logo.png" className="w-12 h-12 grayscale opacity-30 object-contain" /></div>}
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${currentIdx === i ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {currentIdx === i && isPlaying ? <div className="flex gap-1 items-end h-6"><div className="w-1.5 bg-amber-400 animate-bounce h-full"></div><div className="w-1.5 bg-amber-400 animate-bounce h-4"></div><div className="w-1.5 bg-amber-400 animate-bounce h-6"></div></div> : <Play fill="white" size={28} className="text-white ml-1" />}
                    </div>
                  </div>
                  <h3 className={`font-medium truncate text-sm transition-colors ${currentIdx === i ? 'text-amber-400' : 'text-white/90'}`}>{track.name}</h3>
                  <p className="text-xs text-white/40 truncate mt-0.5">{track.artist}</p>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* 底部播放栏 */}
        <footer className="absolute bottom-6 left-6 right-6 h-24 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[28px] shadow-2xl flex items-center px-8 z-50">
          <div className="flex items-center gap-4 w-[25%] min-w-0">
            <div onClick={() => setIsDetailOpen(true)} className="w-14 h-14 rounded-xl overflow-hidden shadow-lg ring-1 ring-white/20 shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all bg-amber-500/10 flex items-center justify-center">
              {currentTrack?.cover ? (
                <img src={currentTrack.cover} className="w-full h-full object-cover" />
              ) : (
                /* 修改：没选歌曲时显示 Logo 占位 */
                <img src="/logo.png" className="w-full h-full opacity-20 object-contain" />
              )}
            </div>
            <div className="min-w-0">
              <h4 onClick={() => setIsDetailOpen(true)} className="font-bold text-white truncate text-sm cursor-pointer hover:text-amber-400 transition-colors">{currentTrack?.name || "金丝楠音乐"}</h4>
              <p className="text-xs text-white/40 truncate">{currentTrack?.artist || "等待播放"}</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="flex items-center gap-6">
              <button onClick={() => setPlayMode(prev => prev === 'sequence' ? 'shuffle' : prev === 'shuffle' ? 'loop' : 'sequence')} className="text-white/20 hover:text-white transition active:scale-90">
                {playMode === 'sequence' && <Repeat size={18} />}
                {playMode === 'shuffle' && <Shuffle size={18} className="text-amber-500" />}
                {playMode === 'loop' && <Repeat1 size={18} className="text-amber-500" />}
              </button>
              <button onClick={() => playAtIndex((currentIdx - 1 + tracks.length) % tracks.length)} className="text-white/40 hover:text-white transition active:scale-90"><SkipBack size={22} fill="currentColor" /></button>
              <button onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition shadow-xl shadow-amber-500/5">
                {isPlaying ? <Pause fill="black" size={24} className="text-black" /> : <Play fill="black" size={24} className="ml-1 text-black" />}
              </button>
              <button onClick={() => playAtIndex((currentIdx + 1) % tracks.length)} className="text-white/40 hover:text-white transition active:scale-90"><SkipForward size={22} fill="currentColor" /></button>
              <button className="text-white/20 hover:text-pink-500 transition active:scale-90"><Heart size={18} /></button>
            </div>
            <div className="w-full max-w-xl flex items-center gap-3">
              <span className="text-[10px] text-white/40 font-mono w-10 text-right">{formatTime(rawTime)}</span>
              <input type="range" min="0" max="100" step="0.1" value={progress} onChange={(e) => {
                if (audioRef.current) audioRef.current.currentTime = (parseFloat(e.target.value) / 100) * audioRef.current.duration;
              }} className="flex-1 h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-amber-500" />
              <span className="text-[10px] text-white/40 font-mono w-10">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="w-[25%] flex items-center justify-end gap-3 group/vol">
            <Volume2 size={18} className="text-amber-500/60" />
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              if (audioRef.current) audioRef.current.volume = val;
            }} className="w-24 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500" />
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;