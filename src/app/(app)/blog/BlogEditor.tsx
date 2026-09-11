"use client";

import { useEffect, useRef } from "react";
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";

// note のように書ける WYSIWYG エディタ。裏側は Markdown なので、WEBRIS API に
// そのまま渡せる（getMarkdown()）。ツールバー左下のタブで Markdown 直接編集にも
// 切り替えられる。アプリはライト固定なのでエディタもライトのみ。
//
// SSR で document を触るため、呼び出し側は next/dynamic の ssr:false で読み込む。
// next/dynamic はコンポーネントへの ref を転送しないため、命令的な操作は
// forwardRef ではなく onReady コールバックで公開する。

export type BlogEditorHandle = {
  /** カーソル位置に生のHTMLを挿入する。WEBRISの公開ページはMarkdown中の生HTMLを
   *  そのまま出力するため、CTAボタンのような装飾リンクに使える（動作確認済み）。 */
  insertHtml: (html: string) => void;
};

export default function BlogEditor({
  initialValue,
  onChange,
  onUploadImage,
  onReady,
}: {
  initialValue: string;
  onChange: (markdown: string) => void;
  /** blob を受け取り、公開画像URLを返す。失敗時は throw。 */
  onUploadImage: (file: File) => Promise<string>;
  onReady?: (handle: BlogEditorHandle) => void;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  const onUploadRef = useRef(onUploadImage);
  const onReadyRef = useRef(onReady);
  onChangeRef.current = onChange;
  onUploadRef.current = onUploadImage;
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!holderRef.current) return;

    const editor = new Editor({
      el: holderRef.current,
      height: "600px",
      initialEditType: "wysiwyg",
      previewStyle: "vertical",
      initialValue: initialValue || "",
      usageStatistics: false,
      autofocus: false,
      placeholder: "本文を入力… 「/」やツールバーで見出し・リスト・画像などを追加できます",
      toolbarItems: [
        ["heading", "bold", "italic", "strike"],
        ["hr", "quote"],
        ["ul", "ol", "task"],
        ["table", "link"],
        ["image"],
        ["code", "codeblock"],
      ],
      hooks: {
        addImageBlobHook: async (blob, callback) => {
          try {
            const file =
              blob instanceof File
                ? blob
                : new File([blob], "image.png", { type: blob.type || "image/png" });
            const url = await onUploadRef.current(file);
            callback(url, file.name);
          } catch (e) {
            alert(e instanceof Error ? e.message : "画像のアップロードに失敗しました。");
          }
        },
      },
    });

    editor.on("change", () => onChangeRef.current(editor.getMarkdown()));
    editorRef.current = editor;

    onReadyRef.current?.({
      insertHtml: (html: string) => {
        // WYSIWYGにテキストとして挿入するとタグがエスケープされてしまう。
        // Markdownモードに切り替えて挿入すれば生HTMLとして本文に残る。
        //
        // 挿入後にWYSIWYGへ戻すと、ProseMirrorのスキーマがstyle属性や
        // 装飾用のdivラッパーを保持できず消えてしまう（動作確認済み）。
        // ボタンの見た目を保つため、挿入後はMarkdown表示のままにする。
        if (!editor.isMarkdownMode()) editor.changeMode("markdown", true);
        editor.insertText(`\n\n${html}\n\n`);
        onChangeRef.current(editor.getMarkdown());
      },
    });

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // マウント時に一度だけ初期化する。初期値の後続変更は扱わない
    // （本文の source of truth はこのエディタ自身）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={holderRef} className="toastui-blog-editor" />;
}
