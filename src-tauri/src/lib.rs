use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[tauri::command]
fn read_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let rd = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for entry in rd.flatten() {
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let p = entry.path();
        out.push(DirEntry {
            name,
            path: p.to_string_lossy().to_string(),
            is_dir: file_type.is_dir(),
        });
    }
    out.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(out)
}

#[tauri::command]
fn read_file_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("{}: {}", path, e))
}

#[tauri::command]
fn read_file_base64(path: String) -> Result<String, String> {
    use base64::Engine as _;
    let bytes = fs::read(&path).map_err(|e| format!("{}: {}", path, e))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn list_md_files(root: String, max_depth: u32) -> Result<Vec<String>, String> {
    const MAX_FILES: usize = 5000;
    let mut out: Vec<String> = Vec::new();
    let mut stack: Vec<(String, u32)> = vec![(root, 0)];
    while let Some((dir, depth)) = stack.pop() {
        if out.len() >= MAX_FILES {
            break;
        }
        let rd = match fs::read_dir(&dir) {
            Ok(rd) => rd,
            Err(_) => continue,
        };
        for entry in rd.flatten() {
            if out.len() >= MAX_FILES {
                break;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            let p = entry.path();
            if p.is_dir() {
                if depth + 1 <= max_depth {
                    stack.push((p.to_string_lossy().to_string(), depth + 1));
                }
            } else if name.ends_with(".md") || name.ends_with(".markdown") {
                out.push(p.to_string_lossy().to_string());
            }
        }
    }
    out.sort();
    Ok(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_dir,
            read_file_text,
            read_file_base64,
            file_exists,
            list_md_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
