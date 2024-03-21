const repoUrl = 'https://api.github.com/repos/Jun-Murakami/AI-Browser/releases/latest';

export const useCheckForUpdates = () => {
  const checkForUpdates = async (currentVersion: string | null) => {
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
      if (latestVersion > currentVersion) {
        const releasePageUrl = data.html_url; // リリースページのURLを取得
        return { latestVersion, releasePageUrl };
      } else {
        console.log('最新バージョンです');
        return null;
      }
    } catch (error) {
      console.error('更新のチェック中にエラーが発生しました:', error);
      return null;
    }
  };

  return checkForUpdates;
};
