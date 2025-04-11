import { useCallback } from 'react';

const repoUrl = 'https://api.github.com/repos/Jun-Murakami/AI-Browser/releases/latest';

// バージョン番号を比較する関数
const compareVersions = (version1: string, version2: string): number => {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  
  return 0;
};

export const useCheckForUpdates = () => {
  const checkForUpdates = useCallback(async (currentVersion: string | null) => {
    try {
      if (!currentVersion) {
        console.error('バージョン情報が見つかりません');
        return null;
      }
      const response = await fetch(repoUrl);
      const data = await response.json();
      if (!data) {
        console.error('データが見つかりません');
        return null;
      }
      const latestVersion = data.tag_name.replace('v', '');
      
      // 新しい比較関数を使用
      if (compareVersions(latestVersion, currentVersion) > 0) {
        const releasePageUrl = data.html_url; // リリースページのURLを取得
        return { latestVersion, releasePageUrl };
      }
      console.log('最新バージョンです');
      return null;
    } catch (error) {
      console.error('更新のチェック中にエラーが発生しました:', error);
      return null;
    }
  },
  []
  );

  return checkForUpdates;
};
