import { useState } from 'react';
import { theme, darkTheme } from '../theme/mui_theme';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { HomePage } from './HomePage';

export const App = () => {
  const [darkMode, setDarkMode] = useState<boolean>(false);

  return (
    <ThemeProvider theme={darkMode ? darkTheme : theme}>
      <CssBaseline />
      <HomePage darkMode={darkMode} setDarkMode={setDarkMode} />
    </ThemeProvider>
  );
};
