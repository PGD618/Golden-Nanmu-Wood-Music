// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // 这里指向 lib.rs 里的 run 函数
    golden_nanmu_wood_music_lib::run()
}
