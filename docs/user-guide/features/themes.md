# Themes

Customize Audiio's appearance with built-in themes or create your own.

## Accessing Themes

Go to **Settings** > **Appearance** > **Themes**

## Built-in Themes

### Light Themes

| Theme | Description |
|-------|-------------|
| Light | Clean, minimal light theme |
| Soft Light | Warm, easy on the eyes |
| Paper | Subtle, paper-like aesthetic |

### Dark Themes

| Theme | Description |
|-------|-------------|
| Dark | Default dark theme |
| Midnight | Deep black, OLED-friendly |
| Nord | Cool, Nordic colors |
| Dracula | Popular developer theme |

### Accent Themes

| Theme | Accent Color |
|-------|--------------|
| Ocean | Blue accents |
| Forest | Green accents |
| Sunset | Orange/red accents |
| Lavender | Purple accents |
| Cherry | Pink accents |

## Applying a Theme

1. Go to **Settings** > **Appearance**
2. Click on a theme to preview
3. Click **Apply** to confirm
4. Theme changes instantly

## Theme Editor

Create completely custom themes.

### Opening the Editor

1. Go to **Settings** > **Appearance**
2. Click **Create Custom Theme**
3. Or click **Edit** on any theme

### Editor Interface

```
┌─────────────────────────────────────────────────────────────┐
│ Theme Editor                                                 │
├───────────────────────┬─────────────────────────────────────┤
│                       │                                      │
│ Color Palette         │   Live Preview                       │
│ ─────────────         │                                      │
│ Background   [█████]  │   ┌────────────────────────────────┐│
│ Surface      [█████]  │   │                                ││
│ Text         [█████]  │   │   Preview of your theme        ││
│ Accent       [█████]  │   │                                ││
│ ...                   │   │                                ││
│                       │   └────────────────────────────────┘│
│ Typography            │                                      │
│ ─────────────         │                                      │
│ Font Family  [─────]  │                                      │
│ Font Size    [─────]  │                                      │
│                       │                                      │
└───────────────────────┴─────────────────────────────────────┘
```

### Customizable Colors

| Color | Used For |
|-------|----------|
| **Background** | Main app background |
| **Surface** | Cards, panels, modals |
| **Surface Hover** | Hover states |
| **Text Primary** | Main text |
| **Text Secondary** | Subtle text |
| **Text Muted** | Disabled/hint text |
| **Accent** | Primary action color |
| **Accent Hover** | Accent hover state |
| **Success** | Success states |
| **Warning** | Warning states |
| **Error** | Error states |
| **Border** | Borders and dividers |

### Color Picker

Click any color swatch to open the picker:

- **Presets**: Quick color options
- **Custom**: Enter hex, RGB, or HSL
- **Eye Dropper**: Pick from screen
- **Opacity**: Adjust transparency

### Typography

Customize fonts:

| Setting | Options |
|---------|---------|
| Font Family | System, Inter, Roboto, etc. |
| Font Size | Small, Medium, Large |
| Font Weight | Light, Regular, Medium, Bold |
| Line Height | Compact, Normal, Relaxed |

### Spacing

Adjust layout density:

| Setting | Description |
|---------|-------------|
| Compact | Minimal spacing, more content |
| Comfortable | Balanced (default) |
| Spacious | More breathing room |

### Border Radius

Corner roundness:

| Setting | Value |
|---------|-------|
| Sharp | 0px |
| Subtle | 4px |
| Rounded | 8px (default) |
| Pill | 16px |

## Advanced Customization

### CSS Variables

For developers, themes use CSS variables:

```css
:root {
  --color-background: #1a1a1a;
  --color-surface: #2a2a2a;
  --color-accent: #3b82f6;
  --color-text-primary: #ffffff;
  --font-family: 'Inter', sans-serif;
  --border-radius: 8px;
}
```

### Custom CSS

Inject custom CSS for fine-tuning:

1. In Theme Editor, click **Advanced**
2. Enter custom CSS rules
3. Preview changes live

Example:
```css
/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-thumb {
  background: var(--color-accent);
  border-radius: 4px;
}
```

## Saving Themes

### Save Custom Theme

1. Click **Save Theme**
2. Enter a name
3. Theme appears in your collection

### Export Theme

Share your theme:

1. Right-click theme
2. Select **Export**
3. Save `.audiio-theme` file

### Import Theme

Use shared themes:

1. Click **Import Theme**
2. Select `.audiio-theme` file
3. Theme added to collection

## Dynamic Themes

### Album Art Colors

Enable to extract colors from album art:

1. Go to **Settings** > **Appearance**
2. Enable **Dynamic Colors**
3. Player and UI adapt to current track

### Time-based Themes

Automatically switch themes:

| Time | Theme |
|------|-------|
| 6am - 6pm | Light theme |
| 6pm - 6am | Dark theme |

Enable in **Settings** > **Appearance** > **Auto Theme**.

## Theme Components

### Sidebar

Customize sidebar appearance:

- Width (narrow/normal/wide)
- Background opacity
- Icon style

### Player Bar

Player bar styling:

- Background blur amount
- Progress bar style
- Compact mode option

### Album Art

Album art display:

- Corner radius
- Shadow intensity
- Hover effects

## Accessibility

### High Contrast

Built-in high contrast themes:

- High Contrast Light
- High Contrast Dark

### Reduced Motion

Disable animations:

1. **Settings** > **Accessibility**
2. Enable **Reduce Motion**

### Font Scaling

System font size respected.

## Theme Presets

### Import from Systems

Some themes match popular systems:

| Preset | Based On |
|--------|----------|
| macOS Light | Apple Light mode |
| macOS Dark | Apple Dark mode |
| Windows 11 | Fluent Design |
| Material | Google Material |

## Troubleshooting

### Theme Not Applying

1. Refresh the app (`Cmd/Ctrl + R`)
2. Check for CSS conflicts
3. Reset to default theme

### Colors Look Wrong

1. Check monitor color profile
2. Try a different theme
3. Adjust individual colors

### Performance Issues

1. Disable dynamic colors
2. Reduce blur effects
3. Use simpler theme

## Related

- [Settings](../settings.md) - All settings
- [Accessibility](../settings.md#accessibility) - Accessibility options

