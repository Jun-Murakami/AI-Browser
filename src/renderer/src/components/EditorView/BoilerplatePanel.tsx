import {
  ArrowBack,
  ArrowDownward,
  ArrowForward,
  ArrowUpward,
  KeyboardReturn,
} from '@mui/icons-material';
import {
  Box,
  Button,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

const BOILERPLATE_SLOTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const COMMAND_BUTTONS = [
  { key: 'c', label: 'Ctrl+C', tip: 'Interrupt' },
  { key: 'd', label: 'Ctrl+D', tip: 'EOF / Exit' },
  { key: 'z', label: 'Ctrl+Z', tip: 'Suspend' },
  { key: 'l', label: 'Ctrl+L', tip: 'Clear screen' },
  { key: 'a', label: 'Ctrl+A', tip: 'Beginning of line' },
  { key: 'e', label: 'Ctrl+E', tip: 'End of line' },
  { key: 'u', label: 'Ctrl+U', tip: 'Delete to start' },
  { key: 'o', label: 'Ctrl+O', tip: 'Execute' },
];

interface BoilerplatePanelProps {
  commandKey: string;
  boilerplates: Record<string, string>;
  boilerplateBank: 'A' | 'B' | 'C' | 'D' | 'E';
  isTerminalActive: boolean;
  isAltHeld: boolean;
  activeArrowKey: 'up' | 'down' | 'left' | 'right' | 'enter' | null;
  onBoilerplateBankChange: (bank: 'A' | 'B' | 'C' | 'D' | 'E') => void;
  onBoilerplateChange: (key: string, text: string) => void;
  onInsertBoilerplate: (key: string) => void;
  onClosePanel: () => void;
  onSendArrowKey: (
    direction: 'up' | 'down' | 'left' | 'right' | 'enter',
  ) => void;
  onSendControlKey: (key: string) => void;
}

const TOOLTIP_Z = { popper: { sx: { zIndex: 10000 } } } as const;

export function BoilerplatePanel({
  commandKey,
  boilerplates,
  boilerplateBank,
  isTerminalActive,
  isAltHeld,
  activeArrowKey,
  onBoilerplateBankChange,
  onBoilerplateChange,
  onInsertBoilerplate,
  onClosePanel,
  onSendArrowKey,
  onSendControlKey,
}: BoilerplatePanelProps) {
  const altKey = commandKey === 'Cmd' ? 'Opt' : 'Alt';

  return (
    <>
      {/* ヘッダー: タイトル + バンク切替 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          mb: 0.5,
          px: 1,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 'bold', mr: 'auto' }}>
          Boilerplate
        </Typography>
        <Tooltip
          title={`Change Bank (${commandKey} + -/+)`}
          arrow
          placement="top"
          slotProps={TOOLTIP_Z}
        >
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {(['A', 'B', 'C', 'D', 'E'] as const).map((bank) => (
              <Button
                key={bank}
                variant={boilerplateBank === bank ? 'contained' : 'outlined'}
                size="small"
                sx={{
                  minWidth: 28,
                  width: 28,
                  height: 22,
                  p: 0,
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                }}
                onClick={() => onBoilerplateBankChange(bank)}
              >
                {bank}
              </Button>
            ))}
          </Box>
        </Tooltip>
      </Box>

      {/* 定型文スロット */}
      {BOILERPLATE_SLOTS.map((slot) => {
        const key = `${boilerplateBank}${slot}`;
        return (
          <Box
            key={key}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 0.5,
              px: 0.5,
            }}
          >
            <Button
              variant="contained"
              size="small"
              sx={{
                minWidth: 32,
                width: 32,
                height: 32,
                p: 0,
                fontWeight: 'bold',
                flexShrink: 0,
              }}
              onClick={() => {
                onInsertBoilerplate(key);
                onClosePanel();
              }}
            >
              {slot}
            </Button>
            <TextField
              size="small"
              variant="outlined"
              placeholder={`${commandKey}+${slot}`}
              value={boilerplates[key] ?? ''}
              onChange={(e) => onBoilerplateChange(key, e.target.value)}
              fullWidth
              slotProps={{
                input: {
                  sx: { fontSize: '0.8rem', height: 32 },
                },
              }}
            />
          </Box>
        );
      })}

      {/* 矢印キー十字ボタン + コマンドセクション */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          mt: 1,
          pt: 1,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {/* Arrow Cursor */}
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 'bold',
              fontSize: '0.7rem',
              userSelect: 'none',
              display: 'block',
              px: 0.5,
            }}
          >
            Arrow Cursor
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '34px 34px 34px',
              gridTemplateRows: '30px 30px 30px',
              gap: 0,
              alignItems: 'center',
              justifyItems: 'center',
              justifyContent: 'center',
              flex: 1,
              alignContent: 'center',
            }}
          >
            {/* 上段: 空 / ↑ / 空 */}
            <Box />
            <Tooltip
              title={`Up (${commandKey} + ${altKey} + ↑)`}
              arrow
              placement="top"
              slotProps={TOOLTIP_Z}
            >
              <span>
                <IconButton
                  size="small"
                  disabled={!isTerminalActive}
                  onClick={() => onSendArrowKey('up')}
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor:
                      activeArrowKey === 'up' ? 'primary.main' : undefined,
                    color:
                      activeArrowKey === 'up'
                        ? 'primary.contrastText'
                        : undefined,
                    transition: 'all 0.1s',
                  }}
                >
                  <ArrowUpward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Box />
            {/* 中段: ← / +Alt(Opt) / → */}
            <Tooltip
              title={`Left (${commandKey} + ${altKey} + ←)`}
              arrow
              placement="left"
              slotProps={TOOLTIP_Z}
            >
              <span>
                <IconButton
                  size="small"
                  disabled={!isTerminalActive}
                  onClick={() => onSendArrowKey('left')}
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor:
                      activeArrowKey === 'left' ? 'primary.main' : undefined,
                    color:
                      activeArrowKey === 'left'
                        ? 'primary.contrastText'
                        : undefined,
                    transition: 'all 0.1s',
                  }}
                >
                  <ArrowBack fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Box
              sx={{
                fontSize: '0.65rem',
                fontWeight: 'bold',
                lineHeight: 1,
                textAlign: 'center',
                userSelect: 'none',
                color: isAltHeld ? 'primary.contrastText' : 'text.secondary',
                bgcolor: isAltHeld ? 'primary.main' : 'action.hover',
                borderRadius: '8px',
                px: 0.6,
                py: 0.5,
                transition: 'all 0.15s',
              }}
            >
              +{altKey}
            </Box>
            <Tooltip
              title={`Right (${commandKey} + ${altKey} + →)`}
              arrow
              placement="right"
              slotProps={TOOLTIP_Z}
            >
              <span>
                <IconButton
                  size="small"
                  disabled={!isTerminalActive}
                  onClick={() => onSendArrowKey('right')}
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor:
                      activeArrowKey === 'right' ? 'primary.main' : undefined,
                    color:
                      activeArrowKey === 'right'
                        ? 'primary.contrastText'
                        : undefined,
                    transition: 'all 0.1s',
                  }}
                >
                  <ArrowForward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            {/* 下段: 空 / ↓ / Enter */}
            <Box />
            <Tooltip
              title={`Down (${commandKey} + ${altKey} + ↓)`}
              arrow
              placement="bottom"
              slotProps={TOOLTIP_Z}
            >
              <span>
                <IconButton
                  size="small"
                  disabled={!isTerminalActive}
                  onClick={() => onSendArrowKey('down')}
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor:
                      activeArrowKey === 'down' ? 'primary.main' : undefined,
                    color:
                      activeArrowKey === 'down'
                        ? 'primary.contrastText'
                        : undefined,
                    transition: 'all 0.1s',
                  }}
                >
                  <ArrowDownward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip
              title={`Enter (${commandKey} + ${altKey} + Enter)`}
              arrow
              placement="bottom"
              slotProps={TOOLTIP_Z}
            >
              <span>
                <IconButton
                  size="small"
                  disabled={!isTerminalActive}
                  onClick={() => onSendArrowKey('enter')}
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor:
                      activeArrowKey === 'enter' ? 'primary.main' : undefined,
                    color:
                      activeArrowKey === 'enter'
                        ? 'primary.contrastText'
                        : undefined,
                    transition: 'all 0.1s',
                  }}
                >
                  <KeyboardReturn fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
        {/* Command */}
        <Box>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 'bold',
              fontSize: '0.7rem',
              userSelect: 'none',
              display: 'block',
              px: 0.5,
              mb: 0.5,
            }}
          >
            Send Command
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {[0, 1].map((col) => (
              <Box
                key={col}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                  flex: 1,
                }}
              >
                {COMMAND_BUTTONS.filter((_, i) => i % 2 === col).map(
                  ({ key, label, tip }) => (
                    <Tooltip
                      key={key}
                      title={tip}
                      arrow
                      placement={col === 0 ? 'left' : 'right'}
                      slotProps={TOOLTIP_Z}
                    >
                      <span>
                        <Button
                          variant="contained"
                          size="small"
                          sx={{
                            fontSize: '0.65rem',
                            fontWeight: 'bold',
                            height: 26,
                            minWidth: 0,
                            width: '100%',
                            px: 0.5,
                          }}
                          disabled={!isTerminalActive}
                          onClick={() => onSendControlKey(key)}
                        >
                          {label}
                        </Button>
                      </span>
                    </Tooltip>
                  ),
                )}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </>
  );
}
