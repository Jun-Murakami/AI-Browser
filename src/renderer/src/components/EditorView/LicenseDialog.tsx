import { Close, Launch } from '@mui/icons-material';
import {
  Box,
  IconButton,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import licenseData from '../../assets/license.json';

interface LicenseDialogProps {
  currentVersion: string | null;
  open: boolean;
  onClose: () => void;
}

interface LicenseInfo {
  licenses: string;
  repository?: string;
  publisher?: string;
  email?: string;
  url?: string;
  path: string;
  licenseFile: string;
}

export const LicenseDialog = ({
  currentVersion,
  open,
  onClose,
}: LicenseDialogProps) => {
  const licenses = Object.entries(licenseData) as [string, LicenseInfo][];

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1300,
      }}
      onClick={onClose}
    >
      <Paper
        sx={{
          width: '80%',
          height: '80%',
          maxWidth: 'none',
          maxHeight: 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Box
          sx={{
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6">Licenses</Typography>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <Close />
          </IconButton>
        </Box>
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h6">
              AI-Browser {currentVersion ? `v${currentVersion}` : ''}
            </Typography>
            <Typography variant="caption">
              Developed by Jun Murakami{' '}
              <IconButton
                href="https://jun-murakami.web.app/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Launch />
              </IconButton>
            </Typography>
          </Box>
          <Typography variant="body1">
            This software (MIT License) is licensed under the following
            licenses:
          </Typography>
        </Box>
        <TableContainer sx={{ height: 'calc(100% - 64px)', overflow: 'auto' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: '0.875rem' }}>Package</TableCell>
                <TableCell sx={{ fontSize: '0.875rem' }}>License</TableCell>
                <TableCell sx={{ fontSize: '0.875rem' }}>Publisher</TableCell>
                <TableCell sx={{ fontSize: '0.875rem' }}>Repository</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {licenses.map(([name, info]) => (
                <TableRow key={name}>
                  <TableCell
                    component="th"
                    scope="row"
                    sx={{ fontSize: '0.875rem' }}
                  >
                    {name}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.875rem' }}>
                    {info.licenses}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.875rem' }}>
                    {info.publisher}
                    {info.email && (
                      <Box
                        component="span"
                        sx={{
                          display: 'block',
                          fontSize: '0.75em',
                          color: 'text.secondary',
                        }}
                      >
                        {info.email}
                      </Box>
                    )}
                    {info.url && (
                      <Box
                        component="span"
                        sx={{
                          display: 'block',
                          fontSize: '0.75em',
                          color: 'text.secondary',
                        }}
                      >
                        {info.url}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.875rem' }}>
                    {info.repository ? (
                      <Link
                        href={info.repository}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          window.electron.openExternalLink(
                            info.repository as string,
                          );
                        }}
                      >
                        {info.repository}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};
