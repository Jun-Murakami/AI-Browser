import { useState } from 'react';
import React from 'react';

const Versions: React.FC = () => {
  const [versions] = useState(window.electron.process.versions);

  return (
    <ul className='versions'>
      <li className='electron-version'>Electron v{versions.electron}</li>
      <li className='chrome-version'>Chromium v{versions.chrome}</li>
      <li className='node-version'>Node v{versions.node}</li>
    </ul>
  );
};

export default Versions;
