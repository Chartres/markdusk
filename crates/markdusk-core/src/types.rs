use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/lib/ipc/types.gen.ts")]
pub struct Block {
    pub kind: String,
    pub text: String,
    pub byte_range: (usize, usize),
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/lib/ipc/types.gen.ts")]
pub struct ParsedDoc {
    pub blocks: Vec<Block>,
}
