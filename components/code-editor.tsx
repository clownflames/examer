'use client'

import * as React from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils'

export type CodeEditorProps = {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  language?: string
  height?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

const DEFAULT_PLACEHOLDER = `// Write your starter code here
function solution() {
  
}
`

export function CodeEditor({
  value,
  onChange,
  onBlur,
  language = 'javascript',
  height = '220px',
  placeholder = DEFAULT_PLACEHOLDER,
  disabled = false,
  className,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme()

  const handleMount: OnMount = (editor) => {
    editor.onDidBlurEditorWidget(() => {
      onBlur?.()
    })
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border',
        disabled && 'pointer-events-none opacity-60',
        className
      )}
    >
      <Editor
        height={height}
        language={language}
        value={value}
        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
        onChange={(v) => onChange(v ?? '')}
        onMount={handleMount}
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
          automaticLayout: true,
          renderLineHighlight: 'none',
          padding: { top: 12, bottom: 12 },
          placeholder,
        }}
        loading={
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            Loading editor…
          </div>
        }
      />
    </div>
  )
}