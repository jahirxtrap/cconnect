#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::process::Command;

use tauri::utils::{config::BundleType, platform::bundle_type};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const APPIMAGE_VAR: &str = "APPIMAGE";
const APPIMAGE_EXTENSION: &str = ".AppImage";
#[cfg(target_os = "linux")]
const EXECUTABLE_MODE: u32 = 0o755;

#[cfg(target_os = "macos")]
const MAC_GRAPHITE: i64 = -1;
#[cfg(target_os = "macos")]
const MAC_MULTICOLOR: i64 = 4;
#[cfg(target_os = "macos")]
const MAC_ACCENTS: [&str; 8] = [
    "#ff5257", "#f7821b", "#ffc600", "#62ba46", "#0433ff", "#a550a7", "#f74f9e", "#8e8e93",
];

fn run(program: &str, args: &[&str]) -> Option<String> {
    let mut command = Command::new(program);
    command.args(args);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let output = command.output().ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(windows)]
fn read_accent() -> Option<String> {
    let output = run(
        "reg",
        &[
            "query",
            r"HKCU\Software\Microsoft\Windows\DWM",
            "/v",
            "AccentColor",
        ],
    )?;
    let token = output.split_whitespace().find(|part| part.starts_with("0x"))?;
    let value = u32::from_str_radix(token.trim_start_matches("0x"), 16).ok()?;
    Some(format!(
        "#{:02x}{:02x}{:02x}",
        value & 0xFF,
        (value >> 8) & 0xFF,
        (value >> 16) & 0xFF
    ))
}

#[cfg(target_os = "macos")]
fn read_accent() -> Option<String> {
    let index = run("defaults", &["read", "-g", "AppleAccentColor"])
        .and_then(|raw| raw.trim().parse::<i64>().ok())
        .unwrap_or(MAC_MULTICOLOR);
    let slot = if index == MAC_GRAPHITE { MAC_ACCENTS.len() - 1 } else { usize::try_from(index).ok()? };
    MAC_ACCENTS.get(slot).map(|color| color.to_string())
}

#[cfg(all(not(windows), not(target_os = "macos")))]
fn read_accent() -> Option<String> {
    portal_accent().or_else(gnome_accent)
}

#[cfg(all(not(windows), not(target_os = "macos")))]
fn portal_accent() -> Option<String> {
    let raw = run(
        "busctl",
        &[
            "--user",
            "call",
            "org.freedesktop.portal.Desktop",
            "/org/freedesktop/portal/desktop",
            "org.freedesktop.portal.Settings",
            "ReadOne",
            "ss",
            "org.freedesktop.appearance",
            "accent-color",
        ],
    )?;
    let channels: Vec<f64> = raw.split_whitespace().filter_map(|part| part.parse().ok()).collect();
    match channels[..] {
        [red, green, blue] if [red, green, blue].iter().all(|channel| (0.0..=1.0).contains(channel)) => {
            let byte = |channel: f64| (channel * 255.0).round() as u8;
            Some(format!("#{:02x}{:02x}{:02x}", byte(red), byte(green), byte(blue)))
        }
        _ => None,
    }
}

#[cfg(all(not(windows), not(target_os = "macos")))]
fn gnome_accent() -> Option<String> {
    if !std::env::var("XDG_CURRENT_DESKTOP").is_ok_and(|desktop| desktop.to_uppercase().contains("GNOME")) {
        return None;
    }
    let raw = run("gsettings", &["get", "org.gnome.desktop.interface", "accent-color"])?;
    let name = raw.trim().trim_matches('\'');
    let color = match name {
        "blue" => "#3584e4",
        "teal" => "#2190a4",
        "green" => "#3a944a",
        "yellow" => "#c88800",
        "orange" => "#ed5b00",
        "red" => "#e62d42",
        "pink" => "#d56199",
        "purple" => "#9141ac",
        "slate" => "#6f8396",
        _ => return None,
    };
    Some(color.to_string())
}

#[tauri::command]
pub fn system_accent() -> Option<String> {
    read_accent()
}

#[tauri::command(async)]
pub fn install_update(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let file = std::path::PathBuf::from(&path);
    if !file.is_file() {
        return Err("missing installer".into());
    }

    if cfg!(windows) {
        let spawned = if path.to_lowercase().ends_with(".msi") {
            Command::new("msiexec").args(["/i", &path]).spawn()
        } else {
            Command::new(&path).spawn()
        };
        spawned.map_err(|error| error.to_string())?;
        app.exit(0);
        return Ok(());
    }

    if cfg!(target_os = "macos") {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        if path.ends_with(APPIMAGE_EXTENSION) {
            return replace_appimage(&app, &file);
        }
    }

    if let Some(command) = package_command(&path) {
        if detached_install(&command) {
            app.exit(0);
            return Ok(());
        }
        Command::new(&command[0])
            .args(&command[1..])
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn stamped_kind() -> Option<&'static str> {
    Some(match bundle_type()? {
        BundleType::Msi => ".msi",
        BundleType::Nsis => ".exe",
        BundleType::Deb => ".deb",
        BundleType::Rpm => ".rpm",
        BundleType::AppImage => APPIMAGE_EXTENSION,
        BundleType::App | BundleType::Dmg => ".dmg",
    })
}

#[tauri::command]
pub fn installer_kind() -> &'static str {
    if let Some(kind) = stamped_kind() {
        return kind;
    }
    if cfg!(windows) {
        let per_machine = std::env::current_exe()
            .ok()
            .zip(std::env::var_os("ProgramFiles"))
            .is_some_and(|(exe, root)| exe.starts_with(root));
        return if per_machine { ".msi" } else { ".exe" };
    }
    if cfg!(target_os = "macos") {
        return ".dmg";
    }
    if std::env::var_os(APPIMAGE_VAR).is_some() {
        return APPIMAGE_EXTENSION;
    }
    if owns_executable("dpkg", "-S") {
        ".deb"
    } else if owns_executable("rpm", "-qf") || !has_command("dpkg") {
        ".rpm"
    } else {
        ".deb"
    }
}

fn owns_executable(manager: &str, flag: &str) -> bool {
    std::env::current_exe().is_ok_and(|exe| {
        Command::new(manager)
            .arg(flag)
            .arg(exe)
            .output()
            .is_ok_and(|output| output.status.success())
    })
}

#[cfg(target_os = "linux")]
fn replace_appimage(app: &tauri::AppHandle, downloaded: &std::path::Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let current = std::env::var_os(APPIMAGE_VAR)
        .map(std::path::PathBuf::from)
        .ok_or_else(|| "not running from an AppImage".to_string())?;
    let staged = current.with_extension("new");
    std::fs::copy(downloaded, &staged).map_err(|error| error.to_string())?;
    std::fs::set_permissions(&staged, std::fs::Permissions::from_mode(EXECUTABLE_MODE))
        .map_err(|error| error.to_string())?;
    std::fs::rename(&staged, &current).map_err(|error| error.to_string())?;
    Command::new(&current)
        .spawn()
        .map_err(|error| error.to_string())?;
    app.exit(0);
    Ok(())
}

fn has_command(name: &str) -> bool {
    Command::new("which")
        .arg(name)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn package_command(path: &str) -> Option<Vec<String>> {
    if !has_command("pkexec") {
        return None;
    }
    let owned = path.to_string();
    let args: Vec<&str> = if path.ends_with(".deb") {
        vec!["apt-get", "install", "-y"]
    } else if path.ends_with(".rpm") && has_command("dnf") {
        vec!["dnf", "install", "-y"]
    } else if path.ends_with(".rpm") && has_command("zypper") {
        vec!["zypper", "--non-interactive", "install", "--allow-unsigned-rpm"]
    } else if path.ends_with(".rpm") {
        vec!["rpm", "-U", "--force"]
    } else {
        return None;
    };
    let mut command = vec!["pkexec".to_string()];
    command.extend(args.into_iter().map(String::from));
    command.push(owned);
    Some(command)
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn detached_install(command: &[String]) -> bool {
    if !has_command("setsid") {
        return false;
    }
    let Ok(current) = std::env::current_exe() else {
        return false;
    };
    let script = format!(
        "{}; exec {}",
        command
            .iter()
            .map(|part| shell_quote(part))
            .collect::<Vec<_>>()
            .join(" "),
        shell_quote(&current.to_string_lossy()),
    );
    Command::new("setsid")
        .args(["sh", "-c", &script])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .is_ok()
}
