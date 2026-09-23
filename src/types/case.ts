export type CaseRecord = {
  id: string;
  description: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseListItem = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type CaseInsert = {
  user_id: string;
  description: string;
};

export type CreateCaseResult =
  | { ok: true }
  | { ok: false; message: string };

export type UpdateCaseResult =
  | { ok: true }
  | { ok: false; message: string };

export type DeleteCaseResult =
  | { ok: true }
  | { ok: false; message: string };
