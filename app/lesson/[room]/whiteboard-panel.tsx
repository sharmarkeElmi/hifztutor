"use client";

import { useEffect, useRef } from "react";
import { Tldraw } from "tldraw";
import type { Editor } from "@tldraw/editor";
import { getSnapshot, loadSnapshot } from "@tldraw/editor";
import type { TLStoreSnapshot } from "@tldraw/tlschema";
import "@tldraw/tldraw/tldraw.css";

type WhiteboardPanelProps = {
  snapshot: TLStoreSnapshot | null;
  readOnly?: boolean;
  onSnapshotChange: (snapshot: TLStoreSnapshot) => void;
};

export function WhiteboardPanel({
  snapshot,
  readOnly = false,
  onSnapshotChange,
}: WhiteboardPanelProps) {
  const editorRef = useRef<Editor | null>(null);
  const lastEmitted = useRef<string | null>(null);

  const handleMount = (editor: Editor) => {
    editorRef.current = editor;
    if (readOnly) {
      editor.updateInstanceState({ isReadonly: true });
    }

    if (snapshot) {
      loadSnapshot(editor.store, snapshot);
      lastEmitted.current = JSON.stringify(snapshot);
    }

    const unsubscribe = editor.store.listen(
      () => {
        const current = getSnapshot(editor.store).document;
        const serialized = JSON.stringify(current);
        if (serialized === lastEmitted.current) return;
        lastEmitted.current = serialized;
        onSnapshotChange(current);
      },
      { scope: "document" }
    );

    return () => {
      unsubscribe();
      editorRef.current = null;
    };
  };

  // Apply incoming snapshots (from Supabase) to the editor.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !snapshot) return;
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastEmitted.current) return;
    lastEmitted.current = serialized;
    loadSnapshot(editor.store, snapshot);
  }, [snapshot]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateInstanceState({ isReadonly: readOnly });
  }, [readOnly]);

  return (
    <div className="whiteboard-wrapper h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner">
      <Tldraw onMount={handleMount} autoFocus />
    </div>
  );
}
