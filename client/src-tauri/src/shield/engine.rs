use std::sync::{Arc, LazyLock};

use adblock::lists::{FilterSet, ParseOptions};
use adblock::request::Request;
use adblock::Engine;
use regex::RegexSet;
use tauri::Url;

use super::{Shield, PRIVATE_SITES};

pub type Compiled = Engine;
pub const EXTENSION: &str = "dat";

static PRIVATE: LazyLock<RegexSet> =
    LazyLock::new(|| RegexSet::new(PRIVATE_SITES).expect("private site patterns are valid"));

pub fn build(texts: Vec<String>) -> Engine {
    let mut set = FilterSet::new(false);
    for text in texts {
        set.add_filter_list(text, ParseOptions::default());
    }
    Engine::new_with_filter_set(set)
}

pub fn encode(engine: &Engine) -> Vec<u8> {
    engine.serialize()
}

pub fn decode(bytes: &[u8]) -> Option<Engine> {
    let mut engine = Engine::default();
    engine.deserialize(bytes).ok()?;
    Some(engine)
}

fn host_of(address: &str) -> Option<String> {
    Url::parse(address).ok()?.host_str().map(|host| host.trim_start_matches("www.").to_lowercase())
}

impl Shield {
    fn guards(&self, source: &str) -> Option<Arc<Engine>> {
        let host = host_of(source)?;
        if PRIVATE.is_match(&source.to_lowercase()) || self.allowed.read().ok()?.contains(&host) {
            return None;
        }
        self.current()
    }

    pub fn blocks(&self, url: &str, source: &str, kind: &str) -> bool {
        let Some(engine) = self.guards(source) else {
            return false;
        };
        Request::new(url, source, kind, "GET")
            .map(|request| engine.check_network_request(&request).should_block())
            .unwrap_or(false)
    }

    pub fn hiding(&self, url: &str) -> Option<String> {
        let selectors = self.guards(url)?.url_cosmetic_resources(url).hide_selectors;
        if selectors.is_empty() {
            return None;
        }
        let rules = selectors
            .iter()
            .map(|selector| format!("{selector}{{display:none!important}}"))
            .collect::<Vec<_>>()
            .join("\n");
        Some(format!(
            "(() => {{ const sheet = new CSSStyleSheet(); sheet.replaceSync({}); document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]; }})()",
            serde_json::to_string(&rules).unwrap_or_default()
        ))
    }
}
