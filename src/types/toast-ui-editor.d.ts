// @toast-ui/editor v3 は types を同梱しているが、package.json の exports に
// types 条件が無く moduleResolution:"bundler" では拾えないため、使う分だけ
// ここで宣言する。
declare module "@toast-ui/editor" {
  export interface EditorHooks {
    addImageBlobHook?: (
      blob: Blob | File,
      callback: (url: string, altText?: string) => void,
      source?: "markdown" | "wysiwyg",
    ) => void | Promise<void>;
  }

  export interface EditorOptions {
    el: HTMLElement;
    height?: string;
    minHeight?: string;
    initialEditType?: "markdown" | "wysiwyg";
    previewStyle?: "tab" | "vertical";
    initialValue?: string;
    usageStatistics?: boolean;
    autofocus?: boolean;
    placeholder?: string;
    hideModeSwitch?: boolean;
    toolbarItems?: string[][];
    hooks?: EditorHooks;
  }

  export default class Editor {
    constructor(options: EditorOptions);
    getMarkdown(): string;
    setMarkdown(markdown: string, cursorToEnd?: boolean): void;
    insertText(text: string): void;
    changeMode(mode: "markdown" | "wysiwyg", withoutFocus?: boolean): void;
    isMarkdownMode(): boolean;
    on(event: string, handler: (...args: unknown[]) => void): void;
    off(event: string): void;
    destroy(): void;
    focus(): void;
  }
}

declare module "@toast-ui/editor/dist/toastui-editor.css";
