import { createTheme } from '@mui/material/styles';
import '@fontsource/m-plus-1p';

const fontFamilySet = [
  'M PLUS 1p',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'sans-serif',
  'Apple Color Emoji',
  'Segoe UI Emoji',
  'Segoe UI Symbol',
].join(',');

const breakpointsValues = {
  xs: 0,
  sm: 750,
  md: 960,
  lg: 1280,
  xl: 1920,
};

const windowsScrollbarStyles = {
  '&::-webkit-scrollbar': {
    width: '10px',
    borderRadius: '5px',
  },
  '&::-webkit-scrollbar-track': {
    boxShadow: 'inset 0 0 8px rgba(0,0,0,0.2)',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#bbb',
    color: '#bbb',
    borderRadius: '5px',
  },
};

const windowsScrollbarStylesDark = {
  '&::-webkit-scrollbar': {
    width: '10px',
    borderRadius: '5px',
  },
  '&::-webkit-scrollbar-track': {
    boxShadow: 'inset 0 0 8px rgba(255,255,255,0.2)',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#444',
    color: '#444',
    borderRadius: '5px',
  },
};

export const theme = createTheme({
  breakpoints: {
    values: breakpointsValues,
  },
  palette: {
    mode: 'light',
    primary: {
      main: '#694dff',
    },
    secondary: {
      main: '#ef0a0a',
    },
    divider: 'rgba(128, 128, 128, 0.3)',
  },
  typography: {
    fontFamily: fontFamilySet,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // ユーザーエージェントにWinを含むか、プラットフォームがWinから始まる場合にスクロールバーのスタイルを適用
        body: navigator.userAgent?.indexOf('Win') > 0 || navigator.platform.startsWith('Win') ? windowsScrollbarStyles : {},
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

export const darkTheme = createTheme({
  breakpoints: {
    values: breakpointsValues,
  },
  palette: {
    mode: 'dark',
    primary: {
      main: '#755EFF',
    },
    secondary: {
      main: '#ef0a0a',
    },
    divider: 'rgba(128, 128, 128, 0.3)',
    background: {
      default: '#212121',
      paper: '#212121',
    },
  },
  typography: {
    fontFamily: fontFamilySet,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: navigator.userAgent?.indexOf('Win') > 0 || navigator.platform.startsWith('Win') ? windowsScrollbarStylesDark : {},
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});
