import type { TLStoreSnapshot } from "@tldraw/tlschema";

export type ToolTab = "whiteboard" | "mushaf" | "notes";

export type LessonState = {
  activeTab: ToolTab;
  whiteboard: {
    lastSavedAt: string | null;
    snapshot: TLStoreSnapshot | null;
  };
  mushaf: {
    surah: number;
    ayah: number;
    page: number;
  };
  notes: {
    content: string;
    updatedAt: string | null;
  };
};

type LessonStateBasePatch = Partial<
  Omit<LessonState, "whiteboard" | "mushaf" | "notes">
>;

export type LessonStatePatch = LessonStateBasePatch & {
  whiteboard?: Partial<LessonState["whiteboard"]>;
  mushaf?: Partial<LessonState["mushaf"]>;
  notes?: Partial<LessonState["notes"]>;
};

export const DEFAULT_LESSON_STATE: LessonState = {
  activeTab: "whiteboard",
  whiteboard: {
    lastSavedAt: null,
    snapshot: null,
  },
  mushaf: {
    surah: 1,
    ayah: 1,
    page: 1,
  },
  notes: {
    content: "",
    updatedAt: null,
  },
};

export function mergeLessonState(
  base: LessonState,
  incoming?: LessonState | LessonStatePatch | null
): LessonState {
  if (!incoming) {
    return base;
  }

  return {
    ...base,
    ...incoming,
    whiteboard: {
      ...base.whiteboard,
      ...(incoming.whiteboard ?? {}),
    },
    mushaf: {
      ...base.mushaf,
      ...(incoming.mushaf ?? {}),
    },
    notes: {
      ...base.notes,
      ...(incoming.notes ?? {}),
    },
  };
}
