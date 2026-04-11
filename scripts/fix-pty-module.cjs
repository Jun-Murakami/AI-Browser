#!/usr/bin/env node

/**
 * node-pty の postinstall チェックスクリプト
 *
 * node-pty >= 1.2.0-beta にはプリビルドバイナリが同梱されているため、
 * electron-rebuild やソースビルドは不要。
 * このスクリプトはプリビルドの存在を確認するだけ。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = os.platform();
const arch = os.arch();
const prebuildsDir = path.join(
  __dirname,
  '..',
  'node_modules',
  'node-pty',
  'prebuilds',
  `${platform}-${arch}`,
);

if (fs.existsSync(prebuildsDir)) {
  console.log(`node-pty prebuilds found for ${platform}-${arch}`);
} else {
  console.warn(
    `node-pty prebuilds not found for ${platform}-${arch}.`,
    'Native module may need to be built manually.',
  );
}
