import { useState, useRef, useEffect, useCallback } from 'react';
import { Allotment, type AllotmentHandle } from 'allotment';
import 'allotment/dist/style.css';
import { toast } from 'sonner';
import {
	EraseIcon,
	Split1Icon,
	Split2Icon,
	Split3Icon,
	Split4Icon,
	Split5Icon,
} from './Icons';
import {
	Box,
	Tab,
	Tabs,
	CircularProgress,
	Select,
	MenuItem,
	FormControl,
	InputLabel,
	IconButton,
	Button,
	Tooltip,
	Typography,
	Chip,
	TextField,
	Divider,
} from '@mui/material';
import type { TouchRippleActions } from '@mui/material/ButtonBase/TouchRipple';
import { useTheme } from '@mui/system';
import * as monaco from 'monaco-editor';
import {
	KeyboardArrowUp,
	KeyboardArrowDown,
	Send,
	ContentPaste,
	ReplayOutlined,
	Settings,
	Save,
	Clear,
	InfoOutlined,
} from '@mui/icons-material';
import { getSupportedLanguages } from './MonacoEditor';
import { MonacoEditors } from './MonacoEditors';
import { MaterialUISwitch } from './DarkModeSwitch';
import { useCheckForUpdates } from '../hooks/useCheckForUpdates';
import BrowserTab from './BrowserTab';
import { useResizeObserver } from '../hooks/useResizeObserver';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { LicenseDialog } from './LicenseDialog';

interface HomePageProps {
	darkMode: boolean;
	setDarkMode: (darkMode: boolean) => void;
}

interface Log {
	id: number;
	text: string;
	displayText: string;
}

const truncateText = (text: string, maxLength = 100) => {
	if (text.length <= maxLength) return text;
	return `${text.substring(0, maxLength)}...`;
};

export const HomePage = ({ darkMode, setDarkMode }: HomePageProps) => {
	const [currentVersion, setCurrentVersion] = useState<string | null>(null);
	const [latestVersion, setLatestVersion] = useState<string | null>(null);
	const [releasePageUrl, setReleasePageUrl] = useState<string | null>(null);
	const [browserTabs, setBrowserTabs] = useState<
		Array<{ label: string; id: string; index: number }>
	>([]);
	const [isInitialized, setIsInitialized] = useState(false);
	const [browserIndex, setBrowserIndex] = useState(0);
	const [browserUrls, setBrowserUrls] = useState<string[]>([]);
	const [browserLoadings, setBrowserLoadings] = useState<boolean[]>([]);
	const [enabledBrowsers, setEnabledBrowsers] = useState<
		Record<string, boolean>
	>({});
	const [isEditingBrowserShow, setIsEditingBrowserShow] = useState(false);
	const [editorIndex, setEditorIndex] = useState(0);
	const [language, setLanguage] = useState('plaintext');
	const [fontSize, setFontSize] = useState(15);
	const [logs, setLogs] = useState<Log[]>([]);
	const [selectedLog, setSelectedLog] = useState<Log | null>(null);
	const [editor1Value, setEditor1Value] = useState('');
	const [editor2Value, setEditor2Value] = useState('');
	const [editor3Value, setEditor3Value] = useState('');
	const [editor4Value, setEditor4Value] = useState('');
	const [editor5Value, setEditor5Value] = useState('');
	const [browserIndexTimestamp, setBrowserIndexTimestamp] = useState(
		new Date().getTime(),
	);
	const [preferredSize, setPreferredSize] = useState(500);
	const [commandKey, setCommandKey] = useState('Ctrl');
	const [osInfo, setOsInfo] = useState('');
	const [isChipVisible, setIsChipVisible] = useState(false);
	const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);

	const checkForUpdates = useCheckForUpdates();

	const theme = useTheme();

	const {
		ref: browserRef,
		width: browserWidth,
		height: browserHeight,
	} = useResizeObserver<HTMLDivElement>();
	const { ref: promptHistoryRef, width: promptHistoryWidth } =
		useResizeObserver<HTMLSelectElement>();

	const sendButtonRef = useRef<HTMLButtonElement>(null);
	const copyButtonRef = useRef<HTMLButtonElement>(null);
	const clearButtonRef = useRef<HTMLButtonElement>(null);
	const saveButtonRef = useRef<HTMLButtonElement>(null);
	const newerLogButtonRef = useRef<HTMLButtonElement>(null);
	const olderLogButtonRef = useRef<HTMLButtonElement>(null);

	const sendButtonTouchRippleRef = useRef<TouchRippleActions>(null);
	const copyButtonTouchRippleRef = useRef<TouchRippleActions>(null);
	const clearButtonTouchRippleRef = useRef<TouchRippleActions>(null);
	const saveButtonTouchRippleRef = useRef<TouchRippleActions>(null);
	const newerLogButtonTouchRippleRef = useRef<TouchRippleActions>(null);
	const olderLogButtonTouchRippleRef = useRef<TouchRippleActions>(null);

	const editorSplitRef = useRef<AllotmentHandle | null>(null);
	const editorPaneRef = useRef<HTMLDivElement>(null);

	// ブラウザのサイズが変更されたらメインプロセスに通知
	useEffect(() => {
		if (!browserWidth || !browserHeight) {
			return;
		}
		window.electron.sendBrowserSizeToMain({
			width: browserWidth,
			height: browserHeight,
		});
	}, [browserWidth, browserHeight]);

	// ブラウザタブが切り替わったらメインプロセスに通知
	const handleBrowserTabChange = useCallback(
		(_: React.SyntheticEvent, index: number) => {
			setBrowserIndex(index);
			window.electron.sendBrowserTabIndexToMain(index);
		},
		[],
	);

	// エディタのタブが切り替わったらメインプロセスに通知
	const handleEditorTabChange = useCallback(
		(_: React.SyntheticEvent, index: number) => {
			setEditorIndex(index);
			window.electron.sendEditorModeToMain(index);
		},
		[],
	);

	// ブラウザタブが切り替わったらメインプロセスに通知(Monaco Editorコマンド由来)
	useEffect(() => {
		if (!enabledBrowsers || !browserIndexTimestamp || !browserTabs.length) {
			return;
		}
		setBrowserIndex((prev) => {
			const enabledIndices = browserTabs
				.filter((tab) => enabledBrowsers[tab.id])
				.map((tab) => tab.index);

			if (!enabledIndices.length) {
				return prev;
			}

			const currentIndex = enabledIndices.indexOf(prev);
			const nextIndex = (currentIndex + 1) % enabledIndices.length;
			const newBrowserIndex = enabledIndices[nextIndex] ?? 0;

			window.electron.sendBrowserTabIndexToMain(newBrowserIndex);
			return newBrowserIndex;
		});
	}, [browserIndexTimestamp, enabledBrowsers, browserTabs]);

	// 初期設定を取得
	useEffect(() => {
		// ローディング状態を監視
		window.electron.onUpdateLoadingStatus((status) => {
			setBrowserLoadings((prev) => {
				const newLoadings = [...prev];
				newLoadings[status.index] = status.isLoading;
				return newLoadings;
			});
		});

		// スクリプトエラーを監視
		window.electron.onScriptError((error) => {
			toast.error(`${error.browser}: ${error.error}`);
		});

		window.electron
			.getInitialSettings()
			.then(async (settings) => {
				setCurrentVersion(settings.currentVersion);
				setBrowserTabs(settings.browsers);
				setEnabledBrowsers(settings.enabledBrowsers);
				setBrowserIndex(
					settings.browsers.length > 0 ? settings.browsers.length - 1 : 0,
				);
				setDarkMode(settings.isDarkMode);
				setEditorIndex(settings.editorMode);
				setPreferredSize(settings.browserWidth);
				setIsInitialized(true);
				setTimeout(() => {
					editorSplitRef.current?.reset();
				}, 100);
				const logsWithDisplay = settings.logs.map((log) => ({
					...log,
					displayText: truncateText(log.text),
				}));
				setLogs(logsWithDisplay);
				if (settings.logs.length === 0) {
					setEditor1Value('Type your message here.');
				}
				setLanguage(settings.language);
				setFontSize(settings.fontSize);
				// OS情報に基づいてコマンドキーを設定
				const commandKey = settings.osInfo === 'darwin' ? 'Cmd' : 'Ctrl';
				setCommandKey(commandKey);
				setOsInfo(settings.osInfo);
				const result = await checkForUpdates(settings.currentVersion);
				if (result) {
					setLatestVersion(result.latestVersion);
					setReleasePageUrl('https://jun-murakami.web.app/#aiBrowser');
					setIsChipVisible(true);
				}
				setTimeout(() => {
					monaco.editor.remeasureFonts(); // 一定時間後に呼び出す
				}, 500);
			})
			.catch((error) => {
				console.error(error);
			});

		// ブラウザのURLを監視
		window.electron.onUpdateUrls((newUrls) => {
			setBrowserUrls(newUrls);
		});

		// クリーンアップ
		return () => {
			window.electron.removeUpdateUrlsListener();
			window.electron.removeUpdateLoadingStatusListener();
			window.electron.removeScriptErrorListener();
		};
	}, [checkForUpdates, setDarkMode]);

	// エディターテキストを結合して取得
	const getCombinedEditorValue = useCallback(() => {
		const divider = '\n----\n';
		let combinedValue = '';
		if (editorIndex === 0) {
			combinedValue = editor1Value;
		} else if (editorIndex === 1) {
			combinedValue = editor1Value + divider + editor2Value;
		} else if (editorIndex === 2) {
			combinedValue =
				editor1Value + divider + editor2Value + divider + editor3Value;
		} else if (editorIndex === 3) {
			combinedValue =
				editor1Value +
				divider +
				editor2Value +
				divider +
				editor3Value +
				divider +
				editor4Value;
		} else {
			combinedValue =
				editor1Value +
				divider +
				editor2Value +
				divider +
				editor3Value +
				divider +
				editor4Value +
				divider +
				editor5Value;
		}
		// 空白のある行があればディバイダ―ごと削除
		combinedValue = combinedValue
			.split(divider)
			.filter((line) => line.trim() !== '')
			.join(divider);
		// 末尾のディバイダーを削除
		combinedValue = combinedValue.replace(new RegExp(`${divider}$`), '');
		return combinedValue;
	}, [
		editorIndex,
		editor1Value,
		editor2Value,
		editor3Value,
		editor4Value,
		editor5Value,
	]);

	// ログを追加
	const addLog = useCallback(
		(text: string) => {
			const newLog: Log = {
				id: logs.length > 0 ? logs[0].id + 1 : 1,
				text,
				displayText: truncateText(text),
			};

			if (logs.length > 0 && logs[0].text === text) {
				toast('Failed to add log. (Same prompt already exists.)');
				return;
			}

			if (logs.length >= 500) {
				const newLogs = logs.slice(0, 499);
				setLogs([newLog, ...newLogs]);
				setSelectedLog(null);
				return [newLog, ...newLogs];
			}

			setLogs([newLog, ...logs]);
			setSelectedLog(null);
			return [newLog, ...logs];
		},
		[logs],
	);

	// テキストを送信
	const handleSendButtonClick = (sendToAll: boolean) => {
		const combinedEditorValue = getCombinedEditorValue();
		if (combinedEditorValue.trim() === '') {
			toast('Failed to send. (Prompt is empty)');
			return;
		}

		window.electron.sendTextToMain(combinedEditorValue, sendToAll);
		const newLogs = addLog(combinedEditorValue);
		if (newLogs) {
			window.electron.sendLogsToMain(newLogs);
		}
		handleClearButtonClick();
	};

	// ログを保存
	const handleSaveButtonClick = () => {
		const combinedEditorValue = getCombinedEditorValue();
		if (combinedEditorValue.trim() === '') {
			toast('Failed to save. (Prompt is empty)');
			return;
		}
		const newLogs = addLog(combinedEditorValue);
		if (newLogs) {
			window.electron.sendLogsToMain(newLogs);
			toast('Log saved.');
		}
	};

	// 選択されたログが変更されたらエディターに反映
	const handleSelectedLogChange = (selectedId: number) => {
		const selected = logs.find((log) => log.id === selectedId);
		if (selected) {
			setSelectedLog(selected);
			const parts = selected.text.split('\n----\n');

			// すべてのエディターの値をリセット
			const setters = [
				setEditor1Value,
				setEditor2Value,
				setEditor3Value,
				setEditor4Value,
				setEditor5Value,
			];
			for (const setter of setters) {
				setter('');
			}

			// 選択されたエディター数に応じて値を設定
			for (let i = 0; i <= editorIndex; i++) {
				if (i === editorIndex) {
					// 最後のエディターには残りのすべての部分を結合して設定
					setters[i](parts.slice(i).join('\n----\n') || '');
				} else {
					// それ以外のエディターには対応する部分を設定
					setters[i](parts[i] || '');
				}
			}
		}
	};

	// 前のログを選択
	const handlePrevLogButtonClick = () => {
		if (selectedLog) {
			const index = logs.indexOf(selectedLog);
			if (index < logs.length - 1) {
				handleSelectedLogChange(logs[index + 1].id);
			}
		} else if (logs.length > 0) {
			handleSelectedLogChange(logs[0].id);
		}
	};

	// 次のログを選択
	const handleNextLogButtonClick = () => {
		if (selectedLog) {
			const index = logs.indexOf(selectedLog);
			if (index > 0) {
				handleSelectedLogChange(logs[index - 1].id);
			}
		} else if (logs.length > 0) {
			handleSelectedLogChange(logs[0].id);
		}
	};

	// クリアボタンがクリックされたらエディターをクリア
	const handleClearButtonClick = () => {
		setEditor1Value('');
		setEditor2Value('');
		setEditor3Value('');
		setEditor4Value('');
		setEditor5Value('');
		setSelectedLog(null);
		toast('Editor cleared.');
	};

	// コピーボタンがクリックされたらエディターの内容をクリップボードにコピー
	const handleCopyButtonClick = () => {
		const combinedEditorValue = getCombinedEditorValue();
		if (combinedEditorValue.trim() === '') {
			toast('Failed to copy. (Prompt is empty)');
			return;
		}
		navigator.clipboard.writeText(combinedEditorValue);
		toast('Copied to clipboard.');
	};

	// ログを削除
	const handleDeleteLog = (logId: number, event: React.MouseEvent) => {
		event.stopPropagation();
		const newLogs = logs.filter((log) => log.id !== logId);
		setLogs(newLogs);
		if (selectedLog?.id === logId) {
			setSelectedLog(null);
			handleClearButtonClick();
		}
		window.electron.sendLogsToMain(newLogs);
		toast('Log deleted.');
	};

	const fontSizeOptions = [
		5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
		25, 26, 27, 28, 29, 30,
	];

	// グローバルショートカットの設定
	useGlobalShortcuts({
		sendButtonRef,
		saveButtonRef,
		copyButtonRef,
		clearButtonRef,
		newerLogButtonRef,
		olderLogButtonRef,
		sendButtonTouchRippleRef,
		copyButtonTouchRippleRef,
		clearButtonTouchRippleRef,
		saveButtonTouchRippleRef,
		newerLogButtonTouchRippleRef,
		olderLogButtonTouchRippleRef,
		setBrowserIndexTimestamp,
		osInfo,
	});

	return (
		<Box
			sx={{ height: '100vh', borderTop: 1, borderColor: theme.palette.divider }}
			component="main"
		>
			<Allotment ref={editorSplitRef}>
				<Allotment.Pane minSize={400} preferredSize={preferredSize}>
					<Box sx={{ height: '100%' }}>
						<Box
							aria-label="Browser tabs container"
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								position: 'relative',
							}}
						>
							<Tooltip
								title="(Ctrl + Tab) to switch AI"
								placement="right"
								arrow
								slotProps={{
									popper: {
										modifiers: [
											{
												name: 'offset',
												options: {
													offset: [0, 40],
												},
											},
										],
									},
								}}
							>
								{isInitialized && browserTabs.length > 0 ? (
									<Box
										sx={{ position: 'relative', width: 'calc(100% - 48px)' }}
									>
										<Tabs
											value={browserIndex}
											onChange={handleBrowserTabChange}
											variant="scrollable"
											scrollButtons="auto"
											sx={{
												borderBottom: 1,
												borderColor: theme.palette.divider,
												'& .MuiTabs-scrollButtons': {
													'&.Mui-disabled': {
														opacity: 0.3,
													},
												},
											}}
											key="browser-tabs"
										>
											{browserTabs.map(({ label, id, index }) => (
												<BrowserTab
													key={index}
													isEditingBrowserShow={isEditingBrowserShow}
													enabled={enabledBrowsers[id]}
													setEnabledBrowsers={setEnabledBrowsers}
													index={index}
													label={label}
													loading={browserLoadings[index]}
													onClick={handleBrowserTabChange}
												/>
											))}
										</Tabs>
									</Box>
								) : (
									<Box
										sx={{
											borderBottom: 1,
											borderColor: theme.palette.divider,
											width: '100%',
											height: 48,
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
										}}
									>
										<CircularProgress size={24} />
									</Box>
								)}
							</Tooltip>
							<Box>
								<Tooltip title="Edit tabs" placement="right" arrow>
									<IconButton
										onClick={() =>
											setIsEditingBrowserShow(!isEditingBrowserShow)
										}
										sx={{
											color: isEditingBrowserShow
												? theme.palette.primary.main
												: theme.palette.text.secondary,
										}}
									>
										<Settings />
									</IconButton>
								</Tooltip>
							</Box>
						</Box>

						<Box sx={{ height: 57 }}>
							<Box
								sx={{
									height: '100%',
									p: 1,
									display: 'flex',
									alignItems: 'center',
									flexDirection: 'row',
								}}
							>
								<Tooltip title="Reload" placement="top" arrow>
									<IconButton
										onClick={() => window.electron.reloadCurrentView()}
									>
										<ReplayOutlined
											sx={{
												transform: 'scaleX(-1)',
												color: theme.palette.text.secondary,
											}}
										/>
									</IconButton>
								</Tooltip>
								<Tooltip title="Reload all tabs" placement="top" arrow>
									<IconButton
										onClick={() => window.electron.reloadAllViews()}
										sx={{ mr: 1 }}
									>
										<ReplayOutlined
											sx={{
												transform: 'scaleX(-1)',
												color: theme.palette.text.secondary,
											}}
										/>
										<Typography variant="subtitle2">all</Typography>
									</IconButton>
								</Tooltip>
								<TextField
									value={browserUrls[browserIndex] || ''}
									size="small"
									fullWidth
									sx={{
										'& fieldset': {
											borderColor:
												theme.palette.mode === 'dark'
													? 'rgba(255, 255, 255, 0.23) !important'
													: 'rgba(0, 0, 0, 0.23) !important',
										},
										'& input': { color: theme.palette.text.secondary },
									}}
									disabled
								/>
							</Box>
							<Divider />
						</Box>

						<Box
							sx={{ height: 'calc(100% - 100px)', textAlign: 'center' }}
							ref={browserRef}
						>
							<Box sx={{ height: '100%' }}>
								<CircularProgress sx={{ mt: 'calc(50% + 50px)' }} />
							</Box>
						</Box>
					</Box>
				</Allotment.Pane>
				<Allotment.Pane minSize={500}>
					<Box sx={{ height: '100%' }} ref={editorPaneRef}>
						{isChipVisible && (
							<Chip
								label={`Update? v${latestVersion}`}
								color="primary"
								onClick={() => {
									if (releasePageUrl) {
										window.electron.openExternalLink(releasePageUrl);
									}
								}}
								onDelete={() => setIsChipVisible(false)}
								sx={{
									position: 'absolute',
									top: 0,
									right: 0,
									m: 1,
									zIndex: 1000,
								}}
							/>
						)}
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								borderBottom: 1,
								borderColor: theme.palette.divider,
							}}
						>
							<Tabs
								value={editorIndex}
								onChange={handleEditorTabChange}
								sx={{ flex: 1 }}
							>
								<Tab
									value={0}
									icon={
										<Split1Icon
											sx={{
												fontSize: 22,
												color:
													editorIndex !== 0
														? theme.palette.action.disabled
														: undefined,
											}}
										/>
									}
								/>
								<Tab
									value={1}
									icon={
										<Split2Icon
											sx={{
												fontSize: 22,
												color:
													editorIndex !== 1
														? theme.palette.action.disabled
														: undefined,
											}}
										/>
									}
								/>
								<Tab
									value={2}
									icon={
										<Split3Icon
											sx={{
												fontSize: 22,
												color:
													editorIndex !== 2
														? theme.palette.action.disabled
														: undefined,
											}}
										/>
									}
								/>
								<Tab
									value={3}
									icon={
										<Split4Icon
											sx={{
												fontSize: 22,
												color:
													editorIndex !== 3
														? theme.palette.action.disabled
														: undefined,
											}}
										/>
									}
								/>
								<Tab
									value={4}
									icon={
										<Split5Icon
											sx={{
												fontSize: 22,
												color:
													editorIndex !== 4
														? theme.palette.action.disabled
														: undefined,
											}}
										/>
									}
								/>
							</Tabs>
							<Tooltip title="License Information" placement="left" arrow>
								<IconButton
									onClick={() => setIsLicenseDialogOpen(true)}
									size="small"
									sx={{ mr: 1, color: theme.palette.text.secondary }}
								>
									<InfoOutlined />
								</IconButton>
							</Tooltip>
						</Box>
						<Box sx={{ w: '100%', p: 1 }}>
							<FormControl sx={{ width: 'calc(100% - 202px)' }}>
								<InputLabel size="small" sx={{ fontSize: 14 }}>
									Logs
								</InputLabel>
								<Select
									ref={promptHistoryRef}
									label="Logs"
									value={selectedLog ? selectedLog.id : ''}
									onChange={(e) => {
										const log = logs.find((log) => log.id === e.target.value);
										if (log) {
											handleSelectedLogChange(log.id);
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
										PaperProps: { sx: { maxHeight: '30vh' } },
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
												sx={{ width: `calc(${promptHistoryWidth} - 40px)` }}
												variant="body2"
											>
												{log.displayText}
											</Typography>
											<IconButton
												className="delete-button"
												size="small"
												onClick={(e) => handleDeleteLog(log.id, e)}
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
							</FormControl>

							<Tooltip title={`Newer log (${commandKey} + ↑)`} arrow>
								<span>
									<IconButton
										ref={newerLogButtonRef}
										touchRippleRef={newerLogButtonTouchRippleRef}
										size="small"
										sx={{ width: 22, ml: 0.5 }}
										disabled={
											selectedLog === logs[0] ||
											!selectedLog ||
											logs.length === 0
										}
										onClick={handleNextLogButtonClick}
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
										onClick={handlePrevLogButtonClick}
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
									onChange={(e) => {
										setLanguage(e.target.value);
										window.electron.sendLanguageToMain(e.target.value);
									}}
									size="small"
									sx={{
										right: 0,
										width: 150,
									}}
									MenuProps={{
										PaperProps: { sx: { maxHeight: '50vh' } },
									}}
								>
									{getSupportedLanguages().map((language) => (
										<MenuItem key={language.id} value={language.id}>
											<Typography noWrap variant="body2">
												{language.aliases?.[0] || language.id}
											</Typography>
										</MenuItem>
									))}
								</Select>
							</FormControl>
						</Box>

						<MonacoEditors
							darkMode={darkMode}
							editorIndex={editorIndex}
							language={language}
							fontSize={fontSize}
							editor1Value={editor1Value}
							setEditor1Value={setEditor1Value}
							editor2Value={editor2Value}
							setEditor2Value={setEditor2Value}
							editor3Value={editor3Value}
							setEditor3Value={setEditor3Value}
							editor4Value={editor4Value}
							setEditor4Value={setEditor4Value}
							editor5Value={editor5Value}
							setEditor5Value={setEditor5Value}
							sendButtonRef={sendButtonRef}
							copyButtonRef={copyButtonRef}
							clearButtonRef={clearButtonRef}
							saveButtonRef={saveButtonRef}
							newerLogButtonRef={newerLogButtonRef}
							olderLogButtonRef={olderLogButtonRef}
							setBrowserIndexTimestamp={setBrowserIndexTimestamp}
							browserWidth={browserWidth}
							browserHeight={browserHeight}
							osInfo={osInfo}
						/>

						<Box
							sx={{
								height: '50px',
								borderTop: 1,
								borderColor: theme.palette.divider,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
							}}
						>
							<Box sx={{ display: 'flex', alignItems: 'center' }}>
								<FormControl>
									<InputLabel size="small" sx={{ fontSize: 15 }}>
										Font size
									</InputLabel>
									<Select
										label="Font size"
										value={fontSize}
										onChange={(e) => {
											setFontSize(e.target.value as number);
											window.electron.sendFontSizeToMain(
												e.target.value as number,
											);
										}}
										size="small"
										sx={{
											width: 80,
											mx: 1,
										}}
										MenuProps={{
											PaperProps: { sx: { maxHeight: '30vh' } },
										}}
									>
										{fontSizeOptions.map((size) => (
											<MenuItem key={size} value={size}>
												<Typography variant="body2">{size}</Typography>
											</MenuItem>
										))}
									</Select>
								</FormControl>
								<MaterialUISwitch
									checked={darkMode}
									onChange={() => {
										setDarkMode(!darkMode);
										window.electron.sendIsDarkModeToMain(!darkMode);
									}}
								/>
								<Tooltip title={`Clear (${commandKey} + Backspace)`} arrow>
									<Button
										ref={clearButtonRef}
										touchRippleRef={clearButtonTouchRippleRef}
										variant="outlined"
										size="small"
										sx={{ ml: 1 }}
										startIcon={<EraseIcon />}
										onClick={handleClearButtonClick}
									>
										Clear
									</Button>
								</Tooltip>
							</Box>
							<Box>
								<Tooltip title={`Save log (${commandKey} + S)`} arrow>
									<IconButton
										ref={saveButtonRef}
										touchRippleRef={saveButtonTouchRippleRef}
										color="primary"
										size="small"
										onClick={handleSaveButtonClick}
									>
										<Save />
									</IconButton>
								</Tooltip>
								<Tooltip
									title={`Copy to clipboard (${commandKey} + Shift + C)`}
									arrow
								>
									<IconButton
										ref={copyButtonRef}
										touchRippleRef={copyButtonTouchRippleRef}
										color="primary"
										size="small"
										sx={{ mr: 1 }}
										onClick={handleCopyButtonClick}
									>
										<ContentPaste />
									</IconButton>
								</Tooltip>
								{isInitialized &&
								browserTabs.length > 0 &&
								browserTabs[browserIndex] ? (
									<>
										<Tooltip
											title={`Send to ${browserTabs[browserIndex].label} (${commandKey} + Enter)`}
											arrow
										>
											<Button
												ref={sendButtonRef}
												touchRippleRef={sendButtonTouchRippleRef}
												variant="contained"
												sx={{ width: 100, mr: 1 }}
												startIcon={<Send sx={{ mr: -0.5 }} />}
												onClick={() => handleSendButtonClick(false)}
											>
												{browserTabs[browserIndex].label}
											</Button>
										</Tooltip>
										<Tooltip title="Send to all tabs" arrow>
											<Button
												variant="contained"
												sx={{ width: 40, mr: 1 }}
												startIcon={<Send sx={{ mr: -0.5 }} />}
												onClick={() => handleSendButtonClick(true)}
											>
												All
											</Button>
										</Tooltip>
									</>
								) : (
									<>
										<Button
											ref={sendButtonRef}
											variant="contained"
											sx={{ width: 100, mr: 1 }}
											startIcon={<Send sx={{ mr: -0.5 }} />}
											disabled
										>
											Send
										</Button>
										<Button
											variant="contained"
											sx={{ width: 40, mr: 1 }}
											startIcon={<Send sx={{ mr: -0.5 }} />}
											disabled
										>
											All
										</Button>
									</>
								)}
							</Box>
						</Box>
					</Box>
					<LicenseDialog
						currentVersion={currentVersion}
						open={isLicenseDialogOpen}
						onClose={() => setIsLicenseDialogOpen(false)}
					/>
				</Allotment.Pane>
			</Allotment>
		</Box>
	);
};
