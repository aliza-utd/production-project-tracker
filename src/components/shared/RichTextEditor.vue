<template>
  <div class="rte-wrap" :class="{ 'rte-disabled': disabled }">
    <!-- Toolbar — hidden when disabled (read-only) -->
    <div v-if="!disabled" class="rte-toolbar">
      <button type="button" class="rte-btn" :class="{ active: editor?.isActive('bold') }"
        @mousedown.prevent="editor?.chain().focus().toggleBold().run()" title="Bold">
        <strong>B</strong>
      </button>
      <button type="button" class="rte-btn" :class="{ active: editor?.isActive('italic') }"
        @mousedown.prevent="editor?.chain().focus().toggleItalic().run()" title="Italic">
        <em>I</em>
      </button>
      <button type="button" class="rte-btn" :class="{ active: editor?.isActive('strike') }"
        @mousedown.prevent="editor?.chain().focus().toggleStrike().run()" title="Strikethrough">
        <s>S</s>
      </button>
      <div class="rte-sep"></div>
      <button type="button" class="rte-btn" :class="{ active: editor?.isActive('bulletList') }"
        @mousedown.prevent="editor?.chain().focus().toggleBulletList().run()" title="Bullet list">
        &#8226;&#8212;
      </button>
      <button type="button" class="rte-btn" :class="{ active: editor?.isActive('orderedList') }"
        @mousedown.prevent="editor?.chain().focus().toggleOrderedList().run()" title="Numbered list">
        1&#8212;
      </button>
    </div>

    <!-- Editor body -->
    <EditorContent :editor="editor" class="rte-body" />
  </div>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const editor = useEditor({
  content:   props.modelValue,
  editable:  !props.disabled,
  extensions: [
    StarterKit.configure({
      blockquote:     false,
      code:           false,
      codeBlock:      false,
      heading:        false,
      horizontalRule: false,
      // Keep: bold, italic, strike, bulletList, orderedList, listItem, paragraph,
      //        document, text, hardBreak, history, dropcursor, gapcursor
    }),
  ],
  editorProps: {
    attributes: {
      class: 'rte-content',
      'data-placeholder': props.placeholder,
    },
  },
  onUpdate({ editor: ed }) {
    const html = ed.isEmpty ? '' : ed.getHTML()
    emit('update:modelValue', html)
  },
})

// Sync incoming value changes (e.g. week navigation loads new data)
watch(() => props.modelValue, (val) => {
  if (!editor.value) return
  const current = editor.value.isEmpty ? '' : editor.value.getHTML()
  if (val !== current) {
    editor.value.commands.setContent(val || '', false)
  }
})

// Sync disabled state
watch(() => props.disabled, (val) => {
  editor.value?.setEditable(!val)
})

onBeforeUnmount(() => editor.value?.destroy())
</script>

<style scoped>
.rte-wrap {
  border: 1px solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  transition: border-color .15s;
  overflow: hidden;
}
.rte-wrap:focus-within:not(.rte-disabled) {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99,102,241,.1);
}
.rte-disabled {
  background: var(--bg);
  opacity: 0.7;
  cursor: not-allowed;
}

.rte-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.rte-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
  transition: background .12s, color .12s;
  font-family: inherit;
  padding: 0;
  user-select: none;
}
.rte-btn:hover { background: var(--border); color: var(--text); }
.rte-btn.active { background: #eef2ff; color: var(--primary); }

.rte-sep {
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 3px;
}

.rte-body {
  padding: 8px 10px;
  min-height: 76px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text);
}
</style>

<!-- Unscoped: styles the ProseMirror contenteditable that Tiptap renders -->
<style>
.rte-content {
  outline: none;
  min-height: 60px;
}
.rte-content p { margin: 0 0 4px; }
.rte-content p:last-child { margin-bottom: 0; }
.rte-content ul,
.rte-content ol {
  margin: 4px 0;
  padding-left: 20px;
}
.rte-content li { margin: 2px 0; }
.rte-content strong { font-weight: 700; }
.rte-content em { font-style: italic; }
.rte-content s { text-decoration: line-through; }

/* Placeholder */
.rte-content.ProseMirror-empty::before {
  content: attr(data-placeholder);
  color: #94a3b8;
  pointer-events: none;
  float: left;
  height: 0;
}
</style>
