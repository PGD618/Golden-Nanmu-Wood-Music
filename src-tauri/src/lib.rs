use base64::{engine::general_purpose, Engine as _};
use lofty::{prelude::*, probe::Probe, tag::ItemKey};
use serde::Serialize;
use std::fs;

#[derive(Serialize)]
pub struct Track {
    pub name: String,
    pub path: String,
    pub artist: String,
    pub duration: u64,
    pub cover: Option<String>,
    pub lyrics: Option<String>,
}

#[tauri::command]
async fn get_music_files(dir_path: String) -> Result<Vec<Track>, String> {
    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;
    let mut tracks = Vec::new();

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_str().unwrap_or("").to_lowercase();
                if ["mp3", "wav", "flac", "m4a", "ogg"].contains(&ext_str.as_str()) {
                    let mut artist = String::from("未知歌手");
                    let mut title = path.file_name().unwrap().to_string_lossy().into_owned();
                    let mut duration = 0;
                    let mut cover_base64 = None;
                    let mut lyrics = None;

                    if let Ok(tagged_file) = Probe::open(&path).and_then(|p| p.read()) {
                        let properties = tagged_file.properties();
                        duration = properties.duration().as_secs();

                        if let Some(tag) = tagged_file.primary_tag() {
                            // 优先使用 Accessor 方法获取基础信息
                            if let Some(t) = tag.title() {
                                title = t.to_string();
                            }
                            if let Some(a) = tag.artist() {
                                artist = a.to_string();
                            }

                            // 修复点：提取内嵌歌词
                            // 1. 去掉 & 符号，直接传入 ItemKey::Lyrics
                            // 2. 移除不存在的 UnsynchronizedLyrics 变体
                            lyrics = tag.get_string(ItemKey::Lyrics).map(|l| l.to_string());

                            if let Some(picture) = tag.pictures().first() {
                                let b64 = general_purpose::STANDARD.encode(picture.data());
                                let mime = picture
                                    .mime_type()
                                    .map(|m| m.to_string())
                                    .unwrap_or_else(|| "image/jpeg".to_string());
                                cover_base64 = Some(format!("data:{};base64,{}", mime, b64));
                            }
                        }
                    }

                    tracks.push(Track {
                        name: title,
                        path: path.to_string_lossy().into_owned(),
                        artist,
                        duration,
                        cover: cover_base64,
                        lyrics,
                    });
                }
            }
        }
    }
    Ok(tracks)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_music_files])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
