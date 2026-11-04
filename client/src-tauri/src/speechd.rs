use std::env;
use std::path::PathBuf;
use std::process::Command;

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::unix::{OwnedReadHalf, OwnedWriteHalf};
use tokio::net::UnixStream;
use tokio::sync::mpsc;

const ADDRESS_ENV: &str = "SPEECHD_ADDRESS";
const UNIX_ADDRESS: &str = "unix_socket:";
const RUNTIME_ENV: &str = "XDG_RUNTIME_DIR";
const SOCKET_DIR: &str = "speech-dispatcher";
const SOCKET_NAME: &str = "speechd.sock";
const DAEMON: &str = "speech-dispatcher";
const CLIENT: &str = "cconnect";
const USER_ENV: &str = "USER";
const NO_VARIANT: &str = "none";
const LINE_END: &str = "\r\n";
const DATA_END: &str = ".";
const SUCCESS: char = '2';
const EVENT: char = '7';
const ENDED: &str = "702";
const CANCELED: &str = "703";
const CODE_LENGTH: usize = 3;
const FINAL_MARK: u8 = b' ';
const NO_SOCKET: &str = "speech-dispatcher is not available";
const CLOSED: &str = "speech-dispatcher closed the connection";

pub type MessageId = String;

#[derive(Clone)]
pub struct Voice {
    pub name: String,
    pub language: String,
}

pub enum Finished {
    Message(MessageId),
    Closed,
}

struct Reply {
    code: String,
    lines: Vec<String>,
}

pub struct Client {
    writer: OwnedWriteHalf,
    replies: mpsc::UnboundedReceiver<Reply>,
}

fn socket_path() -> Option<PathBuf> {
    if let Ok(address) = env::var(ADDRESS_ENV) {
        return address.strip_prefix(UNIX_ADDRESS).map(PathBuf::from);
    }
    env::var_os(RUNTIME_ENV).map(|runtime| PathBuf::from(runtime).join(SOCKET_DIR).join(SOCKET_NAME))
}

async fn spawn_daemon(path: PathBuf) {
    let _ = tokio::task::spawn_blocking(move || {
        Command::new(DAEMON)
            .args(["--spawn", "--communication-method", "unix_socket", "--socket-path"])
            .arg(path)
            .status()
    })
    .await;
}

fn escaped(text: &str) -> String {
    text.lines()
        .map(|line| if line.starts_with('.') { format!(".{line}") } else { line.to_string() })
        .chain([DATA_END.to_string()])
        .collect::<Vec<_>>()
        .join(LINE_END)
}

async fn read(reader: OwnedReadHalf, replies: mpsc::UnboundedSender<Reply>, finished: impl Fn(Finished)) {
    let mut lines = BufReader::new(reader).lines();
    let mut pending = Vec::new();
    while let Ok(Some(line)) = lines.next_line().await {
        let (Some(code), Some(text)) = (line.get(..CODE_LENGTH), line.get(CODE_LENGTH + 1..)) else {
            continue;
        };
        pending.push(text.to_string());
        if line.as_bytes()[CODE_LENGTH] != FINAL_MARK {
            continue;
        }
        let lines = std::mem::take(&mut pending);
        if code.starts_with(EVENT) {
            if let (true, Some(id)) = (code == ENDED || code == CANCELED, lines.into_iter().next()) {
                finished(Finished::Message(id));
            }
        } else if replies.send(Reply { code: code.to_string(), lines }).is_err() {
            break;
        }
    }
    finished(Finished::Closed);
}

impl Client {
    pub async fn connect(finished: impl Fn(Finished) + Send + 'static) -> Result<Self, String> {
        let path = socket_path().ok_or_else(|| NO_SOCKET.to_string())?;
        let stream = match UnixStream::connect(&path).await {
            Ok(stream) => stream,
            Err(_) => {
                spawn_daemon(path.clone()).await;
                UnixStream::connect(&path).await.map_err(|_| NO_SOCKET.to_string())?
            }
        };
        let (reader, writer) = stream.into_split();
        let (sender, replies) = mpsc::unbounded_channel();
        tokio::spawn(read(reader, sender, finished));
        let mut client = Client { writer, replies };
        let user = env::var(USER_ENV).unwrap_or_default();
        client.command(&format!("SET SELF CLIENT_NAME {user}:{CLIENT}:speech")).await?;
        client.command("SET SELF NOTIFICATION ALL ON").await?;
        Ok(client)
    }

    async fn command(&mut self, line: &str) -> Result<Vec<String>, String> {
        self.writer
            .write_all(format!("{line}{LINE_END}").as_bytes())
            .await
            .map_err(|error| error.to_string())?;
        let reply = self.replies.recv().await.ok_or_else(|| CLOSED.to_string())?;
        if reply.code.starts_with(SUCCESS) {
            Ok(reply.lines)
        } else {
            Err(reply.lines.join(" "))
        }
    }

    pub async fn voices(&mut self) -> Result<Vec<Voice>, String> {
        let lines = self.command("LIST SYNTHESIS_VOICES").await?;
        Ok(lines
            .iter()
            .filter_map(|line| {
                let mut fields = line.split('\t');
                let name = fields.next()?;
                let language = fields.next()?;
                (fields.next().unwrap_or(NO_VARIANT) == NO_VARIANT)
                    .then(|| Voice { name: name.to_string(), language: language.to_string() })
            })
            .collect())
    }

    pub async fn speak(&mut self, text: &str, language: &str, voice: Option<&str>, rate: i32) -> Result<MessageId, String> {
        self.command(&format!("SET SELF LANGUAGE {language}")).await?;
        if let Some(voice) = voice {
            self.command(&format!("SET SELF SYNTHESIS_VOICE {voice}")).await?;
        }
        self.command(&format!("SET SELF RATE {rate}")).await?;
        self.command("SPEAK").await?;
        let queued = self.command(&escaped(text)).await?;
        queued.into_iter().next().ok_or_else(|| CLOSED.to_string())
    }

    pub async fn cancel(&mut self) -> Result<(), String> {
        self.command("CANCEL SELF").await.map(|_| ())
    }
}
