import { forwardRef, useMemo, useRef } from 'react';
import { Clear, KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/system';
import { useVirtualizer } from '@tanstack/react-virtual';

import { useResizeObserver } from '../../hooks/useResizeObserver';

import type { TouchRippleActions } from '@mui/material/ButtonBase/TouchRipple';
import type { RefObject } from 'react';
import type { Log } from '../../types/log.types';

/**
 * ログ一覧の仮想化Listbox。
 *
 * - MUI `Autocomplete` の `ListboxComponent` として差し込む想定。
 * - ログ件数が増えたときに、開いた瞬間の「全件レンダリング」を避けるために
 *   `@tanstack/react-virtual` で可視領域の行だけを描画する。
 * - MUIから渡される `children` は `<li>` の配列なので、それを1つのスクロール領域に配置し直す。
 *
 * 重要:
 * - 行の高さは固定（`estimateSize`）として扱う。もし将来的に多行表示にしたい場合は、
 *   `measureElement` を使った可変サイズ対応に切り替える。
 */
const VirtualizedLogListbox = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLElement>
>(function VirtualizedLogListbox(props, ref) {
  const { children, style, ...other } = props;

  // `children` は ReactNode なので配列化して扱う。
  const items = useMemo(() => {
    return Array.isArray(children) ? children : [children];
  }, [children]);

  // スクロール要素。ここを基準に virtualizer が計算する。
  const parentRef = useRef<HTMLDivElement | null>(null);

  // MenuItem相当の高さ（MUIのdenseではない通常の行に近い値）。
  // 多少ズレても overscan で見切れにくくする。
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 16,
    // MUI デフォルトの ul パディング（8px）を除去した代わりに、
    // 仮想化の総サイズ計算側で同等の余白を確保する。
    paddingStart: 8,
    paddingEnd: 8,
  });

  return (
    // 外側: MUI の ref / aria 属性を受け取る。overflow: hidden にして
    // MUI が scrollTop を操作しても見た目に影響しないようにする。
    <div
      {...other}
      ref={ref}
      style={{
        ...(style ?? {}),
        overflow: 'hidden',
      }}
    >
      {/* 内側: virtualizer のスクロールコンテナ。MUI の干渉を受けない。 */}
      <div
        ref={parentRef}
        style={{
          overflow: 'auto',
          maxHeight: 'inherit',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const child = items[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {child}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

interface LogSelectorProps {
  logs: Log[];
  selectedLog: Log | null;
  commandKey: string;
  onSelectLog: (logId: number) => void;
  onDeleteLog: (logId: number, event: React.MouseEvent) => void;
  onNextLog: () => void;
  onPreviousLog: () => void;
  language: string;
  supportedLanguages: Array<{ id: string; aliases?: string[] }>;
  onLanguageChange: (language: string) => void;
  newerLogButtonRef?: RefObject<HTMLButtonElement | null>;
  olderLogButtonRef?: RefObject<HTMLButtonElement | null>;
  newerLogButtonTouchRippleRef?: RefObject<TouchRippleActions | null>;
  olderLogButtonTouchRippleRef?: RefObject<TouchRippleActions | null>;
}

export function LogSelector({
  logs,
  selectedLog,
  commandKey,
  onSelectLog,
  onDeleteLog,
  onNextLog,
  onPreviousLog,
  language,
  supportedLanguages,
  onLanguageChange,
  newerLogButtonRef,
  olderLogButtonRef,
  newerLogButtonTouchRippleRef,
  olderLogButtonTouchRippleRef,
}: LogSelectorProps) {
  const theme = useTheme();
  // `Autocomplete` の幅を元に、オプション内のテキスト幅を計算する。
  // ログ表示テキストが長い場合でも、削除ボタン分の余白を確保して右端で省略する。
  const { ref: promptHistoryRef, width: promptHistoryWidth } =
    useResizeObserver<HTMLDivElement>();

  return (
    <Box sx={{ w: '100%', p: 1 }}>
      <FormControl sx={{ width: 'calc(100% - 202px)' }}>
        {/* 旧 `Select` は `logs.map(...)` で全件レンダリングしていたため、件数増加で表示が遅くなる。
            `Autocomplete` + 仮想化Listboxに置き換え、DOM数を抑える。 */}
        <Box ref={promptHistoryRef}>
          <Autocomplete
            options={logs}
            // disableClearable により型は T | undefined だが、ランタイムでは null が
            // controlled な「未選択」状態。undefined にすると uncontrolled 扱いになり警告が出る。
            value={selectedLog as Log | undefined}
            onChange={(_, newValue) => {
              // `newValue === null` はクリア操作。
              // ここではログ選択の操作に限定したいので null は無視する。
              if (!newValue) return;
              onSelectLog(newValue.id);
            }}
            getOptionLabel={(option) => option.displayText}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            size="small"
            disableClearable={true}
            ListboxComponent={VirtualizedLogListbox}
            slotProps={{
              listbox: {
                style: {
                  maxHeight: '60vh',
                  // パディング込みで maxHeight に収めないとスクロールバー下端が見切れる。
                  boxSizing: 'border-box',
                  // MUI デフォルトの ul パディング（8px）は仮想化レイアウトと干渉するので除去。
                  padding: 0,
                },
              },
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Logs"
                InputLabelProps={{
                  ...params.InputLabelProps,
                  sx: { fontSize: 14 },
                }}
              />
            )}
            renderOption={({ key, ...renderProps }, log) => {
              return (
                <Box
                  component="li"
                  key={key}
                  {...renderProps}
                  sx={{
                    // 仮想化の配置div配下でも「削除ボタンを右寄せ」できるように相対配置にする。
                    position: 'relative',
                    width: '100%',
                    // ドロップダウンはポータル経由で描画されるため、Autocomplete root の sx からは
                    // 子孫セレクタが届かない。ホバースタイルはここで直接指定する。
                    '&:hover .delete-button': {
                      opacity: 1,
                    },
                  }}
                >
                  <Typography
                    noWrap
                    sx={{ width: `calc(${promptHistoryWidth}px - 40px)` }}
                    variant="body2"
                  >
                    {log.displayText}
                  </Typography>
                  <IconButton
                    className="delete-button"
                    size="small"
                    onClick={(e) => {
                      // 削除ボタンを押したときに「選択変更」が発火しないように止める。
                      e.preventDefault();
                      e.stopPropagation();
                      onDeleteLog(log.id, e);
                    }}
                    sx={{
                      position: 'absolute',
                      right: 8,
                      opacity: 0,
                      transition: 'opacity 0.2s',
                      color: theme.palette.text.secondary,
                      '&:hover': {
                        color: theme.palette.error.main,
                      },
                    }}
                  >
                    <Clear fontSize="small" />
                  </IconButton>
                </Box>
              );
            }}
            sx={{
              width: '100%',
            }}
          />
        </Box>

        {/* `FormControl` の `InputLabel` は `TextField` に移行したため削除 */}
        {/* 旧Select実装
        <Select
          ref={promptHistoryRef}
          label="Logs"
          value={selectedLog ? selectedLog.id : ''}
          onChange={(e) => {
            const logId = e.target.value as number;
            if (logId) {
              onSelectLog(logId);
            }
          }}
          size="small"
          sx={{
            width: '100%',
            '& .MuiListItemText-root': {
              overflow: 'hidden',
            },
          }}
          MenuProps={{
            PaperProps: { sx: { maxHeight: '60vh' } },
          }}
        >
          {logs.map((log) => (
            <MenuItem
              key={log.id}
              value={log.id}
              sx={{
                width: promptHistoryWidth,
                position: 'relative',
                '&:hover .delete-button': {
                  opacity: 1,
                },
              }}
            >
              <Typography
                noWrap
                sx={{ width: `calc(${promptHistoryWidth}px - 40px)` }}
                variant="body2"
              >
                {log.displayText}
              </Typography>
              <IconButton
                className="delete-button"
                size="small"
                onClick={(e) => onDeleteLog(log.id, e)}
                sx={{
                  position: 'absolute',
                  right: 8,
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    color: theme.palette.error.main,
                  },
                }}
              >
                <Clear fontSize="small" />
              </IconButton>
            </MenuItem>
          ))}
        </Select>
        */}
      </FormControl>

      <Tooltip title={`Newer log (${commandKey} + ↑)`} arrow>
        <span>
          <IconButton
            ref={newerLogButtonRef}
            touchRippleRef={newerLogButtonTouchRippleRef}
            size="small"
            sx={{ width: 22, ml: 0.5 }}
            disabled={
              selectedLog === logs[0] || !selectedLog || logs.length === 0
            }
            onClick={onNextLog}
          >
            <KeyboardArrowUp />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={`Older log (${commandKey} + ↓)`} arrow>
        <span>
          <IconButton
            ref={olderLogButtonRef}
            touchRippleRef={olderLogButtonTouchRippleRef}
            size="small"
            sx={{ width: 22, mr: 0.5 }}
            disabled={selectedLog === logs[logs.length - 1]}
            onClick={onPreviousLog}
          >
            <KeyboardArrowDown />
          </IconButton>
        </span>
      </Tooltip>

      <FormControl>
        <InputLabel size="small" sx={{ fontSize: 14 }}>
          Syntax highlighting
        </InputLabel>
        <Select
          label="Syntax highlighting"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          size="small"
          sx={{
            right: 0,
            width: 150,
          }}
          MenuProps={{
            PaperProps: { sx: { maxHeight: '50vh' } },
          }}
        >
          {supportedLanguages.map((lang) => (
            <MenuItem key={lang.id} value={lang.id}>
              <Typography noWrap variant="body2">
                {lang.aliases?.[0] || lang.id}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
