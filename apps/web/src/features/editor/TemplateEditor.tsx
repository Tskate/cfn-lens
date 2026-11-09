import type { Diagnostic, Format, SourceRange } from '@cfn-lens/core';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { lintGutter, setDiagnostics, type Diagnostic as EditorDiagnostic } from '@codemirror/lint';
import { RangeSetBuilder, StateEffect, StateField, type Text } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { useEffect, useEffectEvent, useState } from 'react';
import { optionalLineSpan, spanFrom, type LineSpan } from '@/features/source/lineSpan';

interface TemplateEditorProps {
  source: string;
  format: Format | undefined;
  diagnostics: readonly Diagnostic[];
  highlight: SourceRange | undefined;
  // A new value scrolls to the highlight; lines shifting under it while typing don't
  revealKey: object | undefined;
  onChange: (source: string) => void;
}

// Two lines of context above the revealed resource
const REVEAL_MARGIN_PX = 40;

// ── Highlighted lines: the selected resource, drawn like the read-only view ─────────────────────

const setHighlight = StateEffect.define<LineSpan | undefined>();
const highlightedLine = Decoration.line({ class: 'cm-highlighted-line' });

const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    const effect = transaction.effects.find((candidate) => candidate.is(setHighlight));

    if (!effect) {
      // Edits move the highlight with the text until the next parse replaces it
      return decorations.map(transaction.changes);
    }

    return lineDecorations(transaction.state.doc, effect.value);
  },
  provide: (field) => EditorView.decorations.from(field),
});

// ── Look: matches the workspace (Geist Mono 12.5/20, neutral gutter) ────────────────────────────

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '12.5px', backgroundColor: 'var(--color-background)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '20px' },
  '.cm-content': { padding: '8px 0' },
  '.cm-gutters': { backgroundColor: 'var(--color-background)', border: 'none', color: 'var(--color-neutral-400)' },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '32px', paddingRight: '6px' },
  '.cm-highlighted-line': { backgroundColor: '#eff4ff', boxShadow: 'inset 2px 0 0 var(--color-blue-600)' },
});

// Defined once: @uiw/react-codemirror reconfigures the editor whenever the extensions array changes.
const sharedExtensions = [highlightField, lintGutter(), theme, EditorView.contentAttributes.of({ 'aria-label': 'Template source' })];
const languages = { yaml: [...sharedExtensions, yaml()], json: [...sharedExtensions, json()] };

const setupOptions = { foldGutter: false, autocompletion: false, highlightActiveLine: false };

/** The editable template. Diagnostics and the highlight are pushed into CodeMirror as transactions. */
export function TemplateEditor({ source, format, diagnostics, highlight, revealKey, onChange }: TemplateEditorProps) {
  // CodeMirror owns its DOM and state; React talks to it through the view, once it exists
  const [view, setView] = useState<EditorView>();
  const highlighted = optionalLineSpan(highlight);
  const firstLine = highlighted?.first;
  const lastLine = highlighted?.last;

  useEffect(() => {
    if (!view) {
      return;
    }

    view.dispatch(setDiagnostics(view.state, toEditorDiagnostics(diagnostics, view.state.doc.length)));
  }, [view, diagnostics]);

  useEffect(() => {
    if (!view) {
      return;
    }

    view.dispatch({ effects: setHighlight.of(spanFrom(firstLine, lastLine)) });
  }, [view, firstLine, lastLine]);

  // An effect event reads the latest lines without making a change to them a reason to scroll
  const revealHighlight = useEffectEvent((editor: EditorView) => {
    editor.dispatch({ effects: scrollTo(editor.state.doc, spanFrom(firstLine, lastLine)) });
  });

  useEffect(() => {
    if (!view) {
      return;
    }

    revealHighlight(view);
  }, [view, revealKey]);

  return (
    <CodeMirror
      value={source}
      onChange={onChange}
      onCreateEditor={setView}
      extensions={languageFor(format)}
      basicSetup={setupOptions}
      height="100%"
      className="min-h-0 flex-1"
    />
  );
}

function languageFor(format: Format | undefined) {
  if (format === 'json') {
    return languages.json;
  }

  return languages.yaml;
}

function lineDecorations(doc: Text, span: LineSpan | undefined): DecorationSet {
  if (!span) {
    return Decoration.none;
  }

  const builder = new RangeSetBuilder<Decoration>();
  const last = Math.min(span.last, doc.lines);

  for (let number = span.first; number <= last; number++) {
    const line = doc.line(number);
    builder.add(line.from, line.from, highlightedLine);
  }

  return builder.finish();
}

function scrollTo(doc: Text, span: LineSpan | undefined) {
  const isInDocument = span !== undefined && span.first <= doc.lines;

  if (!isInDocument) {
    return [];
  }

  return [EditorView.scrollIntoView(doc.line(span.first).from, { y: 'start', yMargin: REVEAL_MARGIN_PX })];
}

// Offsets come from the last parse; text typed since may be shorter, so they're clamped.
// Problems with the whole template (no range) only appear in the list under the editor.
function toEditorDiagnostics(diagnostics: readonly Diagnostic[], length: number): EditorDiagnostic[] {
  return diagnostics.flatMap(({ range, severity, message }) => {
    if (!range) {
      return [];
    }

    const from = Math.min(range.start.offset, length);
    const to = Math.max(from, Math.min(range.end.offset, length));
    return [{ from, to, severity, message }];
  });
}
