import { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import { Bold, Italic, List, Link as LinkIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface Props {
  value: string
  onChange: (html: string) => void
}

/** Editor de texto rico pro corpo do e-mail de convite (ver Tokens.tsx) —
 * toolbar mínima de propósito: negrito/itálico/lista/link são os únicos
 * elementos que o layout do e-mail (email/src/templates/base.js) sabe
 * renderizar bem. `value`/`onChange` trafegam HTML puro, sem sanitização
 * extra — quem edita aqui é sempre um superuser autenticado, não input de
 * usuário externo. */
export function RichTextEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener" } }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "min-h-32 px-3 py-2 text-sm focus:outline-none [&_p]:mb-2 [&_p:last-child]:mb-0 " +
          "[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-primary [&_a]:underline",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  // Sincroniza quando o value muda de fora (ex.: prefill do template padrão
  // ao trocar o app selecionado) — sem isso o editor ignora updates externos
  // depois da primeira renderização (comportamento padrão do Tiptap).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  if (!editor) return null

  return (
    <div className="rounded-md border bg-background">
      <div className="flex items-center gap-1 border-b p-1">
        <Button
          type="button"
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          size="icon"
          className="size-7"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          size="icon"
          className="size-7"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
          size="icon"
          className="size-7"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("link") ? "secondary" : "ghost"}
          size="icon"
          className="size-7"
          onClick={() => {
            const url = window.prompt("URL do link:")
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
        >
          <LinkIcon className="size-3.5" />
        </Button>
      </div>
      <EditorContent editor={editor} className={cn(!value && "text-muted-foreground")} />
    </div>
  )
}
