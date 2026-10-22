use std::hash::{DefaultHasher, Hash, Hasher};
use std::sync::{Arc, Mutex};

use adblock::content_blocking::{CbAction, CbRule, CbTrigger, CbType};
use adblock::lists::{FilterSet, ParseOptions};

use super::{Shield, PRIVATE_SITES};

pub const EXTENSION: &str = "json";
const LIMIT: usize = 50_000;
const PREFIX: &str = "cconnect-";

pub struct RuleList {
    pub identifier: String,
    pub json: String,
}

pub struct Compiled {
    rules: Vec<CbRule>,
    prepared: Mutex<Option<(Vec<String>, Arc<Vec<RuleList>>)>>,
}

impl From<Vec<CbRule>> for Compiled {
    fn from(rules: Vec<CbRule>) -> Self {
        Self { rules, prepared: Mutex::new(None) }
    }
}

pub fn build(texts: Vec<String>) -> Compiled {
    let mut set = FilterSet::new(true);
    for text in texts {
        set.add_filter_list(text, ParseOptions::default());
    }
    set.into_content_blocking().map(|(rules, _)| rules).unwrap_or_default().into()
}

pub fn encode(compiled: &Compiled) -> Vec<u8> {
    serde_json::to_vec(&compiled.rules).unwrap_or_default()
}

pub fn decode(bytes: &[u8]) -> Option<Compiled> {
    serde_json::from_slice::<Vec<CbRule>>(bytes).ok().map(Compiled::from)
}

pub fn ours(identifier: &str) -> bool {
    identifier.starts_with(PREFIX)
}

fn digest(text: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    text.hash(&mut hasher);
    hasher.finish()
}

fn spared(allowed: &[String]) -> CbRule {
    let sites = PRIVATE_SITES
        .iter()
        .map(|site| site.to_string())
        .chain(allowed.iter().map(|host| format!("^https?://([^/]*\\.)?{}[:/]", regex::escape(host))))
        .collect();
    CbRule {
        action: CbAction { typ: CbType::IgnorePreviousRules, selector: None },
        trigger: CbTrigger { url_filter: ".*".to_string(), if_top_url: Some(sites), ..CbTrigger::default() },
    }
}

impl Compiled {
    fn split(&self, allowed: &[String]) -> Vec<RuleList> {
        let (exceptions, blocks): (Vec<&CbRule>, Vec<&CbRule>) =
            self.rules.iter().partition(|rule| rule.action.typ == CbType::IgnorePreviousRules);
        let spared = spared(allowed);
        blocks
            .chunks(LIMIT)
            .map(|chunk| {
                let list: Vec<&CbRule> = chunk.iter().chain(exceptions.iter()).copied().chain([&spared]).collect();
                let json = serde_json::to_string(&list).unwrap_or_default();
                RuleList { identifier: format!("{PREFIX}{:016x}", digest(&json)), json }
            })
            .collect()
    }
}

impl Shield {
    pub fn rule_lists(&self) -> Arc<Vec<RuleList>> {
        let Some(compiled) = self.current() else {
            return Arc::default();
        };
        let mut allowed: Vec<String> = self.allowed.read().map(|hosts| hosts.iter().cloned().collect()).unwrap_or_default();
        allowed.sort();
        let Ok(mut prepared) = compiled.prepared.lock() else {
            return Arc::default();
        };
        if let Some((hosts, lists)) = prepared.as_ref() {
            if *hosts == allowed {
                return lists.clone();
            }
        }
        let lists = Arc::new(compiled.split(&allowed));
        *prepared = Some((allowed, lists.clone()));
        lists
    }
}
