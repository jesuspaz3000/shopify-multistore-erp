'use client';

import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatClearIcon from '@mui/icons-material/FormatClear';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import LinkIcon from '@mui/icons-material/Link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { EditorContent, type Editor, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState } from 'react';

type Props = {
  label: string;
  /** HTML (lo limpia la API antes de guardarlo). */
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  error?: string;
};

type Block = 'p' | 'h2' | 'h3' | 'h4';
const BLOCKS: { value: Block; label: string }[] = [
  { value: 'p', label: 'Párrafo' },
  { value: 'h2', label: 'Título 1' },
  { value: 'h3', label: 'Título 2' },
  { value: 'h4', label: 'Título 3' },
];

/** Editor de texto enriquecido (Tiptap) con una barra como la de Shopify. */
export default function RichTextEditor({ label, value, onChange, disabled, error }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: false,
        code: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
      }),
    ],
    content: value,
    editable: !disabled,
    // Next renderiza en el servidor: el editor se crea en el cliente (sin desajuste de hidratación).
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  });

  // Si el valor cambia desde fuera (descartar cambios, recargar el producto), el editor lo refleja.
  useEffect(() => {
    if (editor && value !== (editor.isEmpty ? '' : editor.getHTML())) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 500, mb: 1, color: error ? 'error.main' : undefined }}>
        {label}
      </Typography>
      <Box
        sx={{
          border: 1,
          borderColor: error ? 'error.main' : 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          '&:focus-within': { borderColor: error ? 'error.main' : 'primary.main', boxShadow: (t) => `0 0 0 1px ${t.palette.primary.main}` },
        }}
      >
        {/* La barra se dibuja desde el primer render (también en el servidor): no "aparece" después. */}
        <Toolbar editor={editor} disabled={disabled} />
        <Box
          sx={{
            '& .ProseMirror': { minHeight: 160, px: 2, py: 1.5, outline: 'none', typography: 'body1' },
            '& .ProseMirror p': { my: 0.75 },
            '& .ProseMirror h2': { typography: 'h5', my: 1 },
            '& .ProseMirror h3': { typography: 'h6', my: 1 },
            '& .ProseMirror h4': { typography: 'subtitle1', fontWeight: 600, my: 1 },
            '& .ProseMirror ul, & .ProseMirror ol': { pl: 3, my: 0.75 },
            '& .ProseMirror blockquote': { borderLeft: 3, borderColor: 'divider', pl: 2, ml: 0, color: 'text.secondary' },
            '& .ProseMirror a': { color: 'primary.main' },
          }}
        >
          {editor ? (
            <EditorContent editor={editor} aria-label={label} />
          ) : (
            // Mientras Tiptap se crea en el cliente: el mismo texto con el mismo estilo (sin salto visual).
            // `value` es la descripción que devolvió la API, ya limpiada en el servidor (sanitizeDescription).
            <div className="ProseMirror" aria-label={label} dangerouslySetInnerHTML={{ __html: value }} />
          )}
        </Box>
      </Box>
      {error && (
        <Typography variant="caption" sx={{ color: 'error.main', mt: 0.5, display: 'block' }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}

const IDLE_STATE = {
  block: 'p' as Block,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  link: false,
  bullet: false,
  ordered: false,
  quote: false,
};

/** Barra de formato. Con el editor aún sin crear (primer render) se ve igual y los botones no hacen nada. */
function Toolbar({ editor, disabled }: { editor: Editor | null; disabled?: boolean }) {
  // Estado de los botones (activo/inactivo) sin re-renderizar el formulario en cada tecla.
  const state =
    useEditorState({
      editor,
      selector: ({ editor: e }) =>
        e
          ? {
              block: (e.isActive('heading', { level: 2 })
                ? 'h2'
                : e.isActive('heading', { level: 3 })
                  ? 'h3'
                  : e.isActive('heading', { level: 4 })
                    ? 'h4'
                    : 'p') as Block,
              bold: e.isActive('bold'),
              italic: e.isActive('italic'),
              underline: e.isActive('underline'),
              strike: e.isActive('strike'),
              link: e.isActive('link'),
              bullet: e.isActive('bulletList'),
              ordered: e.isActive('orderedList'),
              quote: e.isActive('blockquote'),
            }
          : IDLE_STATE,
    }) ?? IDLE_STATE;
  const [linkAnchor, setLinkAnchor] = useState<HTMLElement | null>(null);
  const [url, setUrl] = useState('');

  /** Ejecuta un comando solo cuando el editor ya existe. */
  const run = (command: (e: Editor) => void) => () => {
    if (editor) command(editor);
  };

  const setBlock = (block: Block) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (block === 'p') chain.setParagraph().run();
    else chain.toggleHeading({ level: Number(block[1]) as 2 | 3 | 4 }).run();
  };

  const button = (title: string, active: boolean, onClick: (target: HTMLElement) => void, icon: React.ReactNode) => (
    <Tooltip title={title} key={title}>
      <span>
        <IconButton
          size="small"
          disabled={disabled}
          onClick={(e) => onClick(e.currentTarget)}
          aria-label={title}
          aria-pressed={active}
          sx={{ borderRadius: 1, color: active ? 'primary.main' : 'text.secondary', bgcolor: active ? 'action.selected' : undefined }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );

  return (
    <Stack
      direction="row"
      sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.25, px: 1, py: 0.5, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}
    >
      <Select
        size="small"
        variant="standard"
        disableUnderline
        value={state.block}
        disabled={disabled}
        onChange={(e) => setBlock(e.target.value as Block)}
        sx={{ minWidth: 110, mx: 1, fontSize: 14 }}
        inputProps={{ 'aria-label': 'Tipo de texto' }}
      >
        {BLOCKS.map((b) => (
          <MenuItem key={b.value} value={b.value}>
            {b.label}
          </MenuItem>
        ))}
      </Select>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      {button('Negrita', state.bold, run((e) => e.chain().focus().toggleBold().run()), <FormatBoldIcon fontSize="small" />)}
      {button('Cursiva', state.italic, run((e) => e.chain().focus().toggleItalic().run()), <FormatItalicIcon fontSize="small" />)}
      {button('Subrayado', state.underline, run((e) => e.chain().focus().toggleUnderline().run()), <FormatUnderlinedIcon fontSize="small" />)}
      {button('Tachado', state.strike, run((e) => e.chain().focus().toggleStrike().run()), <FormatStrikethroughIcon fontSize="small" />)}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      {button(
        'Enlace',
        state.link,
        (target) => {
          if (!editor) return;
          setUrl((editor.getAttributes('link').href as string | undefined) ?? '');
          setLinkAnchor(target);
        },
        <LinkIcon fontSize="small" />,
      )}
      {button('Lista con viñetas', state.bullet, run((e) => e.chain().focus().toggleBulletList().run()), <FormatListBulletedIcon fontSize="small" />)}
      {button('Lista numerada', state.ordered, run((e) => e.chain().focus().toggleOrderedList().run()), <FormatListNumberedIcon fontSize="small" />)}
      {button('Cita', state.quote, run((e) => e.chain().focus().toggleBlockquote().run()), <FormatQuoteIcon fontSize="small" />)}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      {button('Quitar formato', false, run((e) => e.chain().focus().unsetAllMarks().clearNodes().run()), <FormatClearIcon fontSize="small" />)}

      <Popover
        open={!!linkAnchor}
        anchorEl={linkAnchor}
        onClose={() => setLinkAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box
          component="form"
          sx={{ p: 2, display: 'flex', gap: 1, alignItems: 'center' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!editor) return;
            const chain = editor.chain().focus().extendMarkRange('link');
            if (url.trim()) chain.setLink({ href: url.trim() }).run();
            else chain.unsetLink().run();
            setLinkAnchor(null);
          }}
        >
          <TextField size="small" autoFocus label="URL del enlace" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} sx={{ width: 280 }} />
          <Button type="submit" variant="contained" size="small">
            {url.trim() ? 'Aplicar' : 'Quitar'}
          </Button>
        </Box>
      </Popover>
    </Stack>
  );
}
