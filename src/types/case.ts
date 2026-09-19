export type CaseRecord = {
  id: string;
  description: string;
  created_at: string;
};

export type CaseListItem = {
  id: string;
  created_at: string;
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
