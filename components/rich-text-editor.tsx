'use client'

import * as React from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Code,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Heading2,
  Heading3,
  RemoveFormatting,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

/* -------------------------------------------------------------------------- */
/*  Toolbar button                                                             */
/* -------------------------------------------------------------------------- */

type ToolbarButtonProps = {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  label: string
  children: React.ReactNode
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  label,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={isActive}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-8 w-8 shrink-0',
        isActive && 'bg-accent text-accent-foreground'
      )}
    >
      {children}
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Toolbar                                                                    */
/* -------------------------------------------------------------------------- */

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  function setLink() {
    if (!editor) return
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Enter URL', previous ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .run()
  }

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1"
    >
      <ToolbarButton
        label="Bold"
        isActive={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        label="Italic"
        isActive={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        label="Strikethrough"
        isActive={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        label="Heading 2"
        isActive={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        label="Heading 3"
        isActive={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        label="Bullet list"
        isActive={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        label="Numbered list"
        isActive={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        label="Blockquote"
        isActive={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        label="Code block"
        isActive={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        label="Link"
        isActive={editor.isActive('link')}
        onClick={setLink}
      >
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        label="Clear formatting"
        onClick={() =>
          editor.chain().focus().clearNodes().unsetAllMarks().run()
        }
      >
        <RemoveFormatting className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Editor                                                                     */
/* -------------------------------------------------------------------------- */

export type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Extra classes applied to the editable content area. */
  contentClassName?: string
  minHeight?: string
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder = 'Write something…',
  disabled = false,
  className,
  contentClassName,
  minHeight = '180px',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value || '',
    editable: !disabled,
    // Required for Next.js 15+ / React 19 SSR to avoid hydration mismatch
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2',
          'prose-headings:mt-4 prose-headings:mb-2',
          'prose-p:my-2',
          'prose-ul:my-2 prose-ol:my-2',
          'prose-blockquote:my-2 prose-blockquote:border-l-2 prose-blockquote:pl-4',
          'prose-pre:my-2 prose-pre:bg-muted prose-pre:text-foreground',
          contentClassName
        ),
        style: `min-height: ${minHeight};`,
      },
    },
    onUpdate: ({ editor }) => {
      // Normalize empty doc ("<p></p>") to empty string
      const html = editor.isEmpty ? '' : editor.getHTML()
      onChange(html)
    },
    onBlur: () => {
      onBlur?.()
    },
  })

  // Sync external value changes (e.g., form.reset) without re-emitting onUpdate
  React.useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? '' : editor.getHTML()
    const incoming = value || ''
    if (current === incoming) return
    editor.commands.setContent(incoming, { emitUpdate: false })
  }, [editor, value])

  // Keep editable in sync with the disabled prop
  React.useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  return (
    <div
      data-disabled={disabled || undefined}
      className={cn(
        'rounded-md border bg-background transition-shadow',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

export default RichTextEditor