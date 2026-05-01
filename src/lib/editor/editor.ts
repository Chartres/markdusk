import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";

export type ChangeHandler = (newContents: string) => void;

export function createEditor(
  parent: HTMLElement,
  initial: string,
  onChange?: ChangeHandler,
): EditorView {
  const extensions: Extension[] = [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    markdown(),
    EditorView.updateListener.of((v) => {
      if (v.docChanged && onChange) onChange(v.state.doc.toString());
    }),
  ];

  return new EditorView({
    parent,
    state: EditorState.create({ doc: initial, extensions }),
  });
}
