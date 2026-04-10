import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Close, Download, FolderOpen, Refresh } from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  Paper,
  Typography,
} from '@mui/material';

import type { ReleaseAsset } from '../hooks/useCheckForUpdates';

const ReactMarkdown = lazy(() => import('react-markdown'));

type DownloadState = 'idle' | 'downloading' | 'installing' | 'error';

interface DownloadProgress {
  receivedBytes: number;
  totalBytes: number;
  percent: number;
}

interface UpdateDialogProps {
  open: boolean;
  onClose: () => void;
  latestVersion: string;
  releaseBody: string;
  releaseAssets: ReleaseAsset[];
  releasePageUrl: string;
  osInfo: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
};

const findAssetForPlatform = (
  assets: ReleaseAsset[],
  osInfo: string,
): ReleaseAsset | null => {
  if (osInfo === 'win32') {
    return assets.find((a) => a.name.includes('setup_win')) ?? null;
  }
  if (osInfo === 'darwin') {
    return assets.find((a) => a.name.includes('mac')) ?? null;
  }
  // linux
  return assets.find((a) => a.name.endsWith('.AppImage')) ?? null;
};

export const UpdateDialog = ({
  open,
  onClose,
  latestVersion,
  releaseBody,
  releaseAssets,
  releasePageUrl,
  osInfo,
}: UpdateDialogProps) => {
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [progress, setProgress] = useState<DownloadProgress>({
    receivedBytes: 0,
    totalBytes: 0,
    percent: 0,
  });
  const [errorMessage, setErrorMessage] = useState('');

  const asset = findAssetForPlatform(releaseAssets, osInfo);
  const canDownload = downloadState === 'idle' || downloadState === 'error';
  const isBlocking =
    downloadState === 'downloading' || downloadState === 'installing';

  // 進捗リスナーの登録・解除
  useEffect(() => {
    if (!open) return;

    const handleProgress = (p: DownloadProgress) => {
      setProgress(p);
    };
    window.electron.onUpdateDownloadProgress(handleProgress);

    return () => {
      window.electron.removeUpdateDownloadProgressListener();
    };
  }, [open]);

  // ダイアログを閉じるときに状態をリセット
  const handleClose = useCallback(() => {
    onClose();
    setDownloadState('idle');
    setProgress({ receivedBytes: 0, totalBytes: 0, percent: 0 });
    setErrorMessage('');
  }, [onClose]);

  const handleDownload = useCallback(async () => {
    if (!asset) return;
    setDownloadState('downloading');
    setProgress({ receivedBytes: 0, totalBytes: 0, percent: 0 });
    setErrorMessage('');

    const result = await window.electron.startUpdateDownload(
      asset.browserDownloadUrl,
    );

    if (result.success) {
      setDownloadState('installing');
    } else if (result.error === 'cancelled') {
      setDownloadState('idle');
    } else {
      setDownloadState('error');
      setErrorMessage(result.error ?? 'Unknown error');
    }
  }, [asset]);

  const handleCancel = useCallback(() => {
    window.electron.cancelUpdateDownload();
  }, []);

  const handleOpenReleasePage = useCallback(() => {
    window.electron.openExternalLink(releasePageUrl);
  }, [releasePageUrl]);

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
      onClick={isBlocking ? undefined : handleClose}
    >
      <Paper
        sx={{
          width: '70%',
          height: '70%',
          maxWidth: 700,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
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
          <Typography variant="h6">
            Update Available - v{latestVersion}
          </Typography>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            disabled={isBlocking}
            sx={{ color: (theme) => theme.palette.grey[500] }}
          >
            <Close />
          </IconButton>
        </Box>

        {/* リリースノート */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 2,
            '& img': { maxWidth: '100%' },
            '& a': { color: 'primary.main' },
            '& pre': {
              overflow: 'auto',
              bgcolor: 'action.hover',
              p: 1,
              borderRadius: 1,
            },
            '& code': { fontSize: '0.875em' },
          }}
        >
          {releaseBody ? (
            <Suspense
              fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              }
            >
              <ReactMarkdown>{releaseBody}</ReactMarkdown>
            </Suspense>
          ) : (
            <Typography color="text.secondary">
              No release notes available.
            </Typography>
          )}
        </Box>

        {/* フッター */}
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {/* ダウンロード進捗 */}
          {downloadState === 'downloading' && (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 0.5,
                }}
              >
                <Typography variant="body2">
                  Downloading... {progress.percent}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatBytes(progress.receivedBytes)} /{' '}
                  {progress.totalBytes > 0
                    ? formatBytes(progress.totalBytes)
                    : '---'}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress.percent}
                sx={{ mb: 1 }}
              />
            </Box>
          )}

          {/* インストール中 */}
          {downloadState === 'installing' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2">
                {osInfo === 'linux'
                  ? 'Opening file location...'
                  : 'Launching installer...'}
              </Typography>
            </Box>
          )}

          {/* エラー */}
          {downloadState === 'error' && (
            <Typography variant="body2" color="error">
              Download failed: {errorMessage}
            </Typography>
          )}

          {/* ボタン */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {asset ? (
              <>
                {canDownload && (
                  <>
                    <Button onClick={handleClose}>Cancel</Button>
                    <Button
                      variant="contained"
                      startIcon={
                        downloadState === 'error' ? <Refresh /> : <Download />
                      }
                      onClick={handleDownload}
                    >
                      {downloadState === 'error'
                        ? 'Retry'
                        : 'Download & Install'}
                      {downloadState === 'idle' && asset.size > 0 && (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ ml: 1, opacity: 0.8 }}
                        >
                          ({formatBytes(asset.size)})
                        </Typography>
                      )}
                    </Button>
                  </>
                )}
                {downloadState === 'downloading' && (
                  <Button onClick={handleCancel}>Cancel Download</Button>
                )}
              </>
            ) : (
              <>
                <Button onClick={handleClose}>Close</Button>
                <Button
                  variant="contained"
                  startIcon={<FolderOpen />}
                  onClick={handleOpenReleasePage}
                >
                  Open Release Page
                </Button>
              </>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
