use base64::{engine::general_purpose, Engine as _};
use lofty::{prelude::*, probe::Probe, tag::ItemKey};
use serde::Serialize;
use std::fs;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager, State,
};

// 定义全局配置状态
struct AppConfig {
    close_to_tray: Mutex<bool>,
}

#[derive(Serialize)]
pub struct Track {
    pub name: String,
    pub path: String,
    pub artist: String,
    pub duration: u64,
    pub cover: Option<String>,
    pub lyrics: Option<String>,
}

// 供前端调用的：设置是否关闭到托盘
#[tauri::command]
fn set_close_to_tray(state: State<'_, AppConfig>, enabled: bool) {
    let mut config = state.close_to_tray.lock().unwrap();
    *config = enabled;
}

// 供前端调用的：彻底退出
#[tauri::command]
fn exit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
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
                            if let Some(t) = tag.title() {
                                title = t.to_string();
                            }
                            if let Some(a) = tag.artist() {
                                artist = a.to_string();
                            }
                            // 修复点 1：使用 &ItemKey
                            lyrics = tag.get_string(&ItemKey::Lyrics).map(|l| l.to_string());
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
        .manage(AppConfig {
            close_to_tray: Mutex::new(true),
        }) // 默认配置
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--quoted-arguments"]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // --- 1. 托盘初始化 ---
            let quit_i = MenuItem::with_id(app, "quit", "彻底退出", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "显示主界面", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        let win = app.get_webview_window("main").unwrap();
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let win = tray.app_handle().get_webview_window("main").unwrap();
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                })
                .build(app)?;

            // --- 2. 核心：处理关闭拦截 (修复点 2) ---
            let window = app.get_webview_window("main").unwrap();

            // 克隆一个引用用于闭包内部
            let win_handle = window.clone();

            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    // 使用克隆好的 win_handle 获取状态
                    let state = win_handle.state::<AppConfig>();
                    let is_enabled = *state.close_to_tray.lock().unwrap();

                    if is_enabled {
                        win_handle.hide().unwrap();
                        api.prevent_close();
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_music_files,
            set_close_to_tray,
            exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
