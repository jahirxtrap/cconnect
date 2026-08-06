use base64::{engine::general_purpose::STANDARD, Engine};

// Mirrors the Compose client: DPAPI on Windows, plain text elsewhere.
#[cfg(windows)]
mod platform {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB,
    };

    fn blob(data: &[u8]) -> CRYPT_INTEGER_BLOB {
        CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        }
    }

    unsafe fn take(out: CRYPT_INTEGER_BLOB) -> Vec<u8> {
        let bytes = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        LocalFree(out.pbData as *mut _);
        bytes
    }

    pub fn protect(data: &[u8]) -> Option<Vec<u8>> {
        unsafe {
            let mut input = blob(data);
            let mut output = std::mem::zeroed();
            if CryptProtectData(&mut input, std::ptr::null(), std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), 0, &mut output) == 0 {
                return None;
            }
            Some(take(output))
        }
    }

    pub fn unprotect(data: &[u8]) -> Option<Vec<u8>> {
        unsafe {
            let mut input = blob(data);
            let mut output = std::mem::zeroed();
            if CryptUnprotectData(&mut input, std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), 0, &mut output) == 0 {
                return None;
            }
            Some(take(output))
        }
    }
}

#[cfg(not(windows))]
mod platform {
    pub fn protect(data: &[u8]) -> Option<Vec<u8>> {
        Some(data.to_vec())
    }

    pub fn unprotect(data: &[u8]) -> Option<Vec<u8>> {
        Some(data.to_vec())
    }
}

#[tauri::command]
pub fn secret_protect(value: String) -> Option<String> {
    platform::protect(value.as_bytes()).map(|bytes| STANDARD.encode(bytes))
}

#[tauri::command]
pub fn secret_unprotect(value: String) -> Option<String> {
    let bytes = STANDARD.decode(value).ok()?;
    let plain = platform::unprotect(&bytes)?;
    String::from_utf8(plain).ok()
}

#[tauri::command]
pub fn secret_available() -> bool {
    cfg!(windows)
}
