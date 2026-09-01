use std::process::Command;

#[cfg(target_os = "macos")]
const MAC_ACCENTS: [&str; 8] = [
    "#ff5257", "#f7821b", "#ffc600", "#62ba46", "#0433ff", "#a550a7", "#f74f9e", "#8e8e93",
];

fn run(program: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(program).args(args).output().ok()?;
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
    let raw = run("defaults", &["read", "-g", "AppleAccentColor"])?;
    let index: usize = raw.trim().parse().ok()?;
    MAC_ACCENTS.get(index).map(|color| color.to_string())
}

#[cfg(all(not(windows), not(target_os = "macos")))]
fn read_accent() -> Option<String> {
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

#[tauri::command]
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
