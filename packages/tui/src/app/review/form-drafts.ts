import type { GitHubMergeMethod } from "@madisonbullard/diffdiff-core";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
export interface FormDrafts {
  review?: { body: string; event: number };
  merge?: { body: string; title: string; method?: GitHubMergeMethod; auto: boolean };
}
export function saveFormDraft(state: DiffdiffAppState, kind: "merge" | "review") {
  const key = formDraftKey(state.session);
  const drafts = state.formDraftsRef.current.get(key) ?? {};
  if (kind === "review")
    drafts.review = {
      body: state.reviewSubmissionInput.value,
      event: state.reviewSubmissionEventIndex,
    };
  else
    drafts.merge = {
      body: state.mergeCommitMessageInput.value,
      title: state.mergeCommitTitleInput.value,
      method: state.mergeMethod === "close" ? undefined : state.mergeMethod,
      auto: state.mergeAutoMerge,
    };
  state.formDraftsRef.current.set(key, drafts);
}
export function formDraftKey(session: {
  github?: { pullRequest: { url: string } };
  repository: { rootPath: string };
}) {
  return `${session.repository.rootPath}\0${session.github?.pullRequest.url ?? ""}`;
}
