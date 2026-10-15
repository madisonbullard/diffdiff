import type { GitHubPullRequestDetail } from "@madisonbullard/diffdiff-core";
import type { UiTheme } from "../theme.ts";
import { DialogInspector } from "../components/dialog/inspector.tsx";
import { DialogList, DialogRow } from "../components/dialog/list-view.tsx";
import { useDialogUi } from "../components/dialog/context.tsx";
import * as A from "../app/keymap/actions.ts";
import { CommentTimestamp } from "./comment-metadata.tsx";
export function PullRequestCommentsModal({
  selectedItemId,
  pullRequest,
  theme,
}: {
  selectedItemId?: string;
  pullRequest: GitHubPullRequestDetail;
  theme: UiTheme;
}) {
  const ui = useDialogUi();
  const items = pullRequest.conversationItems;
  const index = Math.max(
    0,
    items.findIndex((item) => String(item.id) === selectedItemId),
  );
  const selected = items[index];
  const group =
    selected?.kind === "review"
      ? pullRequest.reviewGroups.find(
          (candidate) =>
            candidate.reviewId === selected.reviewId ||
            candidate.reviewNodeId === selected.reviewNodeId,
        )
      : undefined;
  return (
    <DialogInspector
      title="PR Conversation"
      context={`#${pullRequest.number} · ${items.length} entries`}
      theme={theme}
      detailKey={selectedItemId}
      actions={[
        { action: A.LIST_MOVE_DOWN, label: "move" },
        { action: A.CONVERSATION_REPLY, label: "reply", primary: true },
        { action: A.GITHUB_COPY_COMMENT_URL, label: "copy link" },
      ]}
      list={(width, height) => (
        <DialogList
          items={items}
          index={index}
          height={height}
          theme={theme}
          empty="No PR conversation items yet."
          onMove={(delta) => ui.run(delta > 0 ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP, Math.abs(delta))}
          render={(item, i) => (
            <DialogRow
              selected={i === index}
              label={`${item.author.login} · ${item.body.trim().split("\n")[0] || item.reviewState || item.kind}`}
              right={
                item.kind === "review" ? (item.reviewState ?? "review").toLowerCase() : "pr comment"
              }
              width={width}
              theme={theme}
              onSelect={() =>
                ui.run(i > index ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP, Math.abs(i - index))
              }
            />
          )}
        />
      )}
      detail={
        <>
          <text fg={theme.text} attributes={1}>
            {selected ? (
              <>
                {selected.author.login}
                {" · "}
                <CommentTimestamp value={selected.createdAt || selected.updatedAt} theme={theme} />
              </>
            ) : (
              "No item selected"
            )}
          </text>
          <text fg={theme.text} wrapMode="word">
            {selected?.body ?? ""}
          </text>
          {group?.comments.map((comment) => (
            <box key={comment.id} flexDirection="column" marginTop={1}>
              <text
                fg={theme.accent}
                wrapMode="word"
              >{`${comment.author.login} · ${comment.path}:${comment.startLine != null ? `${comment.startLine}-` : ""}${comment.line ?? comment.originalLine ?? ""}${comment.isOutdated ? " [outdated]" : ""}`}</text>
              <text fg={theme.text} wrapMode="word">
                {comment.body}
              </text>
            </box>
          ))}
        </>
      }
    />
  );
}
