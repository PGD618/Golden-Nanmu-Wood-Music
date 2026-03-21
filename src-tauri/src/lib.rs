use serde::Serialize;
use std::fs;

// 定义发给前端的歌曲信息格式
#[derive(Serialize)]
pub struct Track {
    pub name: String,
    pub path: String,
}

// 定义一个“命令”让前端调用：读取指定文件夹里的音乐文件
#[tauri::command]
async fn get_music_files(dir_path: String) -> Result<Vec<Track>, String> {
    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;
    let mut tracks = Vec::new();

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_str().unwrap_or("").to_lowercase();
                // 只找这几种格式的音乐
                if ["mp3", "wav", "flac", "m4a", "ogg"].contains(&ext_str.as_str()) {
                    if let Some(file_name) = path.file_name() {
                        tracks.push(Track {
                            name: file_name.to_string_lossy().into_owned(),
                            path: path.to_string_lossy().into_owned(),
                        });
                    }
                }
            }
        }
    }
    Ok(tracks)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init()) // 启用选择对话框插件
        .plugin(tauri_plugin_fs::init()) // 启用文件系统插件
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_music_files // 注册我们写的函数
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
