import type { UiTheme } from "../theme.ts";
import type { TextInputSurface } from "../text-input-surface.ts";
import { DialogPanel } from "../components/dialog/panel.tsx";
import { DialogEditor } from "../components/dialog/editor.tsx";
import { DialogList, DialogRow } from "../components/dialog/list-view.tsx";
import { useDialogUi, primaryBinding } from "../components/dialog/context.tsx";
import { fitPath, fitText, cellWidth } from "../components/dialog/text.ts";
import { dialogTokens } from "../components/dialog/tokens.ts";
import * as A from "../app/keymap/actions.ts";
export function ReviewComposerModal({
  autocomplete,
  autocompleteIndex,
  bodySurface,
  context,
  historyEntryCount,
  isSubmitting,
  theme,
}: {
  autocomplete: import("./composer-autocomplete.ts").ReviewComposerAutocompleteState;
  autocompleteIndex: number;
  bodySurface: TextInputSurface;
  context: { snippet: string; subtitle: string; title: string };
  historyEntryCount: number;
  isSubmitting: boolean;
  theme: UiTheme;
}) {
  const ui = useDialogUi();
  return (
    <DialogPanel
      title={context.title}
      context={context.subtitle}
      family="form"
      theme={theme}
      status={isSubmitting ? "Sending… input paused · Esc continues in background" : undefined}
      actions={[
        {
          action: A.LIST_ACCEPT,
          label: autocomplete.isVisible ? "insert file" : "send",
          primary: true,
          disabled: isSubmitting || !bodySurface.value.trim(),
        },
        { action: A.TEXT_NEWLINE, label: "newline" },
        { action: A.TEXT_OPEN_EXTERNAL_EDITOR, label: "editor" },
        ...(autocomplete.isVisible
          ? [{ action: A.TEXT_ACCEPT_COMPLETION, label: "insert file" }]
          : []),
      ]}
    >
      {(rect) => {
        const options = autocomplete.isVisible ? Math.min(4, Math.max(1, rect.bodyRows - 6)) : 0;
        const editorHeight = rect.bodyRows - 4;
        const before = bodySurface.value.slice(0, bodySurface.cursorOffset);
        const lines = before.split("\n");
        const row =
          lines.reduce(
            (total, line) =>
              total + Math.max(1, Math.ceil((cellWidth(line) + 1) / rect.innerWidth)),
            0,
          ) - 1;
        const col = cellWidth(lines.at(-1) ?? "") % rect.innerWidth;
        const popupWidth = Math.min(60, rect.innerWidth);
        return (
          <>
            <text height={2} flexShrink={0} fg={theme.textMuted} wrapMode="word">
              {fitText(context.snippet, rect.innerWidth * 2)}
            </text>
            <box height={editorHeight} flexShrink={0}>
              <DialogEditor
                surface={bodySurface}
                height={editorHeight}
                width={rect.innerWidth}
                paused={isSubmitting}
                placeholder="Write a comment…"
                theme={theme}
              />
              {autocomplete.isVisible ? (
                <box
                  position="absolute"
                  top={Math.max(0, Math.min(row + 1, editorHeight - options))}
                  left={Math.min(col, rect.innerWidth - popupWidth)}
                  width={popupWidth}
                  height={options}
                  zIndex={2}
                  backgroundColor={dialogTokens(theme).popover}
                >
                  <DialogList
                    items={autocomplete.options}
                    index={autocompleteIndex}
                    height={options}
                    theme={theme}
                    empty={`No files match @${autocomplete.query}.`}
                    render={(option, index) => (
                      <DialogRow
                        selected={index === autocompleteIndex}
                        label={fitPath(option.insertText, popupWidth - 2)}
                        width={popupWidth}
                        theme={theme}
                        onSelect={() =>
                          ui.run(
                            index > autocompleteIndex ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP,
                            Math.abs(index - autocompleteIndex),
                          )
                        }
                        onActivate={() => ui.run(A.TEXT_ACCEPT_COMPLETION)}
                      />
                    )}
                  />
                </box>
              ) : null}
            </box>
            <text
              height={2}
              flexShrink={0}
              fg={theme.textMuted}
              wrapMode="word"
            >{`@ reference files · ${historyEntryCount} saved drafts${primaryBinding(ui, A.TEXT_NEWLINE) ? ` · ${primaryBinding(ui, A.TEXT_NEWLINE)} newline` : ""}`}</text>
          </>
        );
      }}
    </DialogPanel>
  );
}
