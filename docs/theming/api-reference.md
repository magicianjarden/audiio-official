# Theme API Reference

Complete reference for the Audiio theming system internals.

## Theme Store

The theme store manages all theme-related state using Zustand.

### State

```typescript
interface ThemeState {
  // Currently active theme ID
  activeThemeId: string;

  // System color scheme preference
  systemMode: 'auto' | 'light' | 'dark';

  // All built-in themes
  themes: ThemeConfig[];

  // User-installed community themes
  communityThemes: ThemeConfig[];
}
```

### Actions

#### `setTheme(themeId: string)`

Apply a theme by its ID.

```typescript
useThemeStore.getState().setTheme('midnight');
```

#### `setSystemMode(mode: SystemMode)`

Set the system color scheme preference.

```typescript
useThemeStore.getState().setSystemMode('dark');
// Options: 'auto' | 'light' | 'dark'
```

#### `installTheme(theme: ThemeConfig)`

Install a community theme.

```typescript
useThemeStore.getState().installTheme({
  id: 'my-theme-123',
  name: 'My Theme',
  source: 'community',
  // ... other fields
});
```

#### `uninstallTheme(themeId: string)`

Remove an installed community theme.

```typescript
useThemeStore.getState().uninstallTheme('my-theme-123');
```

#### `importTheme(json: string): ThemeConfig | null`

Import a theme from JSON string.

```typescript
const theme = useThemeStore.getState().importTheme(jsonString);
if (theme) {
  console.log('Imported:', theme.name);
}
```

#### `exportTheme(themeId: string): string | null`

Export a theme as JSON string.

```typescript
const json = useThemeStore.getState().exportTheme('midnight');
```

#### `createCustomTheme(config: Partial<ThemeConfig>): ThemeConfig`

Create a new custom theme.

```typescript
const newTheme = useThemeStore.getState().createCustomTheme({
  name: 'My Custom Theme',
  colors: { /* ... */ }
});
```

#### `updateTheme(themeId: string, updates: Partial<ThemeConfig>)`

Update an existing community theme.

```typescript
useThemeStore.getState().updateTheme('my-theme-123', {
  name: 'Updated Name',
  colors: { accent: '#ff0000' }
});
```

#### `getActiveTheme(): ThemeConfig`

Get the currently active theme configuration.

```typescript
const activeTheme = useThemeStore.getState().getActiveTheme();
console.log(activeTheme.name, activeTheme.colors.accent);
```

### Hook Usage

```typescript
import { useThemeStore } from './stores/theme-store';

function MyComponent() {
  const { activeThemeId, setTheme, themes } = useThemeStore();

  return (
    <div>
      {themes.map(theme => (
        <button
          key={theme.id}
          onClick={() => setTheme(theme.id)}
          className={activeThemeId === theme.id ? 'active' : ''}
        >
          {theme.name}
        </button>
      ))}
    </div>
  );
}
```

## Theme Configuration

### ThemeConfig Interface

```typescript
interface ThemeConfig {
  // Unique identifier
  id: string;

  // Display name
  name: string;

  // Creator name
  author: string;

  // Version string (semver)
  version: string;

  // Brief description
  description?: string;

  // Base mode
  mode: 'light' | 'dark';

  // Preview image URL
  preview?: string;

  // Theme origin
  source: 'builtin' | 'community';

  // Color tokens
  colors: ThemeColors;

  // Optional gradient definitions
  gradients?: Partial<ThemeGradients>;

  // Optional shadow definitions
  shadows?: Partial<ThemeShadows>;

  // Optional radius overrides
  radius?: Partial<ThemeRadius>;

  // Optional font overrides
  fonts?: ThemeFonts;

  // Optional glass effects
  glass?: Partial<ThemeGlass>;

  // Additional CSS rules
  customCSS?: string;
}
```

### ThemeColors Interface

```typescript
interface ThemeColors {
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  bgElevated: string;
  bgSurface: string;
  bgOverlay: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Accent
  accent: string;
  accentHover: string;
  accentGlow: string;
  accentSoft: string;
  accentMuted: string;

  // Borders
  borderColor: string;
  borderLight: string;
  borderStrong: string;

  // Semantic
  colorSuccess: string;
  colorWarning: string;
  colorError: string;
  colorInfo: string;
}
```

## Theme Utilities

Located in `utils/theme-utils.ts`.

### `parseGitHubUrl(url: string): GitHubRepo | null`

Parse a GitHub URL into owner/repo parts.

```typescript
import { parseGitHubUrl } from './utils/theme-utils';

parseGitHubUrl('github.com/user/repo');
// { owner: 'user', repo: 'repo' }

parseGitHubUrl('user/repo');
// { owner: 'user', repo: 'repo' }

parseGitHubUrl('invalid');
// null
```

### `validateTheme(theme: unknown): ValidationResult`

Validate a theme configuration object.

```typescript
import { validateTheme } from './utils/theme-utils';

const result = validateTheme(themeObject);
if (result.valid) {
  // Theme is valid
} else {
  console.error(result.errors);
}
```

### `sanitizeCSS(css: string): string`

Sanitize custom CSS to prevent XSS attacks.

```typescript
import { sanitizeCSS } from './utils/theme-utils';

const safeCSS = sanitizeCSS(userProvidedCSS);
```

### `fetchThemeFromGitHub(url: string): Promise<ThemeConfig | null>`

Fetch and validate a theme from a GitHub repository.

```typescript
import { fetchThemeFromGitHub } from './utils/theme-utils';

try {
  const theme = await fetchThemeFromGitHub('user/repo');
  if (theme) {
    installTheme(theme);
  }
} catch (error) {
  console.error(error.message);
}
```

### Color Utilities

```typescript
import {
  hexToRgb,
  rgbToHex,
  adjustBrightness,
  getContrastColor,
  generatePalette
} from './utils/theme-utils';

// Convert hex to RGB
hexToRgb('#1db954');
// { r: 29, g: 185, b: 84 }

// Convert RGB to hex
rgbToHex(29, 185, 84);
// '#1db954'

// Adjust brightness
adjustBrightness('#1db954', 20);
// Lighter color

// Get contrasting text color
getContrastColor('#1db954');
// '#000000' or '#ffffff'

// Generate color palette
generatePalette('#1db954');
// { lightest, lighter, light, base, dark, darker, darkest }
```

## Theme Provider

The `ThemeProvider` component applies CSS variables to the document.

### Usage

```tsx
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <YourApp />
    </ThemeProvider>
  );
}
```

### How It Works

1. Subscribes to theme store changes
2. Reads the active theme configuration
3. Applies each color as a CSS custom property to `:root`
4. Injects sanitized custom CSS into a `<style>` element
5. Listens for system color scheme changes (when mode is 'auto')

## CSS Variables

All theme colors are exposed as CSS custom properties:

```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #141414;
  --text-primary: #ffffff;
  --accent: #1db954;
  /* ... all color tokens */
}
```

### Using in CSS

```css
.my-component {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}
```

### Using in React

```tsx
function MyComponent() {
  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)'
    }}>
      Content
    </div>
  );
}
```

## Built-in Themes

### Dark Themes

| ID | Name | Accent |
|----|------|--------|
| `default-dark` | Default Dark | `#1db954` |
| `midnight` | Midnight | `#8b5cf6` |
| `sunset` | Sunset | `#f97316` |
| `ocean` | Ocean | `#06b6d4` |
| `monochrome-dark` | Monochrome Dark | `#ffffff` |

### Light Themes

| ID | Name | Accent |
|----|------|--------|
| `default-light` | Default Light | `#16a34a` |
| `paper` | Paper | `#78716c` |
| `monochrome-light` | Monochrome Light | `#171717` |

## Events

### System Color Scheme Change

The ThemeProvider listens for system preference changes:

```typescript
window.matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', (e) => {
    // Automatically switches theme when systemMode is 'auto'
  });
```

## Storage

Theme state is persisted to localStorage:

```typescript
// Key: 'audiio-theme-storage'
{
  activeThemeId: 'default-dark',
  systemMode: 'auto',
  communityThemes: [/* installed themes */]
}
```

Built-in themes are not stored - they're defined in code.
