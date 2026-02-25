import { lightTheme, darkTheme } from '../theme';
import type { ThemeFamily } from './types';

// Default theme — directly uses upstream's lightTheme/darkTheme colors.
// This means upstream color changes are automatically picked up.
export const defaultTheme: ThemeFamily = {
    id: 'default',
    name: 'Default',
    light: lightTheme.colors as ThemeFamily['light'],
    dark: darkTheme.colors as ThemeFamily['dark'],
};
