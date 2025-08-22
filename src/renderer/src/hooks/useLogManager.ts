import { useCallback, useState } from 'react';
import { toast } from 'sonner';

interface Log {
  id: number;
  text: string;
  displayText: string;
}

interface UseLogManagerReturn {
  logs: Log[];
  selectedLog: Log | null;
  addLog: (text: string) => Log[] | undefined;
  deleteLog: (logId: number) => void;
  selectLog: (logId: number) => void;
  clearSelection: () => void;
  getNextLog: () => void;
  getPreviousLog: () => void;
  setLogs: (logs: Log[]) => void;
}

const truncateText = (text: string, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

export function useLogManager(): UseLogManagerReturn {
  const [logs, setLogs] = useState<Log[]>([]);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);

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

      let newLogs: Log[];
      if (logs.length >= 500) {
        newLogs = [newLog, ...logs.slice(0, 499)];
      } else {
        newLogs = [newLog, ...logs];
      }

      setLogs(newLogs);
      setSelectedLog(null);
      return newLogs;
    },
    [logs],
  );

  // ログを削除
  const deleteLog = useCallback(
    (logId: number) => {
      const newLogs = logs.filter((log) => log.id !== logId);
      setLogs(newLogs);
      if (selectedLog?.id === logId) {
        setSelectedLog(null);
      }
      window.electron.sendLogsToMain(newLogs);
      toast('Log deleted.');
    },
    [logs, selectedLog],
  );

  // ログを選択
  const selectLog = useCallback(
    (logId: number) => {
      const log = logs.find((log) => log.id === logId);
      if (log) {
        setSelectedLog(log);
      }
    },
    [logs],
  );

  // 選択をクリア
  const clearSelection = useCallback(() => {
    setSelectedLog(null);
  }, []);

  // 次のログを選択（新しいログ）
  const getNextLog = useCallback(() => {
    if (selectedLog) {
      const index = logs.indexOf(selectedLog);
      if (index > 0) {
        selectLog(logs[index - 1].id);
      }
    } else if (logs.length > 0) {
      selectLog(logs[0].id);
    }
  }, [selectedLog, logs, selectLog]);

  // 前のログを選択（古いログ）
  const getPreviousLog = useCallback(() => {
    if (selectedLog) {
      const index = logs.indexOf(selectedLog);
      if (index < logs.length - 1) {
        selectLog(logs[index + 1].id);
      }
    } else if (logs.length > 0) {
      selectLog(logs[0].id);
    }
  }, [selectedLog, logs, selectLog]);

  return {
    logs,
    selectedLog,
    addLog,
    deleteLog,
    selectLog,
    clearSelection,
    getNextLog,
    getPreviousLog,
    setLogs,
  };
}
