import { EditorView } from "@codemirror/view";
import { Compartment, EditorState, type Extension } from "@codemirror/state";

/**
 * Smart-punctuation input filter. Off by default — the file-fidelity principle
 * says we don't silently rewrite characters the user typed unless they ask.
 *
 * When enabled:
 *  - "  → opening curly quote ("); ASCII " inside a word becomes closing ".
 *  - '  → ’ for apostrophes in contractions; ‘ for opening.
 *  - -- → en-dash (–); --- → em-dash (—).
 *  - ... → ellipsis (…).
 *
 * Disabled inside fenced code blocks (best-effort heuristic — does not
 * trigger inside ``` … ```).
 */

const compartment = new Compartment();

function isInCodeBlock(state: { doc: { sliceString: (a: number, b: number) => string } }, pos: number): boolean {
  const before = state.doc.sliceString(0, pos);
  let fences = 0;
  let i = 0;
  while (true) {
    const next = before.indexOf("```", i);
    if (next === -1) break;
    fences++;
    i = next + 3;
  }
  return fences % 2 === 1;
}

function transactionFilter() {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr;
    // Only rewrite simple user input — leave undo/redo, IME, and paste alone.
    if (tr.isUserEvent("undo") || tr.isUserEvent("redo")) return tr;
    if (!tr.isUserEvent("input.type")) return tr;

    // Collect ALL rewrites against the PRE-change doc. iterChanges gives us
    // positions in the original doc (fromA..toA) and the new doc (fromB..toB).
    // We re-express each substitution as a change to the original document
    // so the returned spec can replace tr.changes wholesale.
    const oldDoc = tr.startState.doc;
    const replacements: { from: number; to: number; insert: string }[] = [];
    let mutated = false;

    tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      const text = inserted.toString();
      if (!text) {
        replacements.push({ from: fromA, to: toA, insert: text });
        return;
      }
      if (isInCodeBlock(tr.startState, fromA)) {
        replacements.push({ from: fromA, to: toA, insert: text });
        return;
      }

      // Context lookup is against the OLD doc, just before the insertion point.
      const prev1 = oldDoc.sliceString(Math.max(0, fromA - 1), fromA);
      const prev2 = oldDoc.sliceString(Math.max(0, fromA - 2), fromA);
      let modified = text;
      let extendFrom = fromA;

      if (text === '"') {
        modified = /\s|^$|[\(\[\{]/.test(prev1) ? "“" : "”";
      } else if (text === "'") {
        modified = /\s|^$|[\(\[\{]/.test(prev1) ? "‘" : "’";
      } else if (text === "-") {
        if (prev2 === "--") {
          // Three dashes typed in a row.
          extendFrom = fromA - 2;
          modified = "—";
        } else if (prev1 === "–") {
          // Two dashes already collapsed to en-dash; a third makes em-dash.
          extendFrom = fromA - 1;
          modified = "—";
        } else if (prev1 === "-") {
          extendFrom = fromA - 1;
          modified = "–";
        }
      } else if (text === ".") {
        if (prev2 === "..") {
          extendFrom = fromA - 2;
          modified = "…";
        }
      }

      if (modified !== text || extendFrom !== fromA) mutated = true;
      replacements.push({ from: extendFrom, to: toA, insert: modified });
    });

    if (!mutated) return tr;
    // Place the cursor right after the final replacement to match user
    // expectation when typing — let CM compute the rest.
    const last = replacements[replacements.length - 1];
    const head = last.from + last.insert.length;
    return [
      {
        changes: replacements,
        selection: { anchor: head },
        scrollIntoView: tr.scrollIntoView,
      },
    ];
  });
}

export function smartPunctuation(enabled = false): Extension {
  return compartment.of(enabled ? transactionFilter() : []);
}

export function setSmartPunctuation(view: EditorView, enabled: boolean): void {
  view.dispatch({ effects: compartment.reconfigure(enabled ? transactionFilter() : []) });
}
