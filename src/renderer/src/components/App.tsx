import { useState } from 'react';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import { Toaster } from 'sonner';

import { darkTheme, theme } from '../theme/mui_theme';
import { HomePage } from './HomePage';

export const App = () => {
  const [darkMode, setDarkMode] = useState<boolean>(false);

  return (
    <ThemeProvider theme={darkMode ? darkTheme : theme}>
      <CssBaseline />
      <HomePage darkMode={darkMode} setDarkMode={setDarkMode} />
      <Box sx={{ '& li': { right: '-60px !important' } }}>
        <Toaster
          position="bottom-right"
          theme={darkMode ? 'dark' : 'light'}
          offset={90}
          toastOptions={{
            style: {
              background: darkMode ? '#191919' : '#e9e9e9',
              width: '300px',
            },
          }}
          closeButton
        />
      </Box>
    </ThemeProvider>
  );
};
