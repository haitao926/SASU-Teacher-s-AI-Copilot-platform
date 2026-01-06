import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { icons as mdiData } from '@iconify-json/mdi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// List of icons used in the project (manually collected + generic ones)
const usedIcons = [
  // Group Icons
  'creation', 'bookshelf', 'file-document-edit', 'marker-check', 'chart-box',
  // Entry Icons & UI
  'account', 'account-group', 'account-group-outline', 'account-network', 'alert-circle', 'alert-circle-outline', 'alert-decagram',
  'application', 'arrow-left', 'brain', 
  'camera-iris', 'card-account-details-outline', 'chart-line', 'chart-line-variant',
  'chat-processing', 'checkbox-marked-circle-outline', 'check-circle', 'chevron-left', 'chevron-right',
  'cloud-upload', 'content-copy', 'cursor-default-click-outline',
  'delete-outline', 
  'face-man-profile', 'file-certificate', 'file-check-outline',
  'file-document-edit', 'file-document-multiple-outline', 'file-document-outline', 'file-document-refresh',
  'file-edit-outline', 'file-hidden', 'file-pdf-box', 'file-word', 'file-word-box', 'finance', 'folder-multiple-image',
  'folder-open', 'folder-zip', 
  'gesture-tap-button', 'graph', 
  'help-circle-outline', 'history',
  'image-auto-adjust', 'image-filter-center-focus', 'image-plus', 'information-outline',
  'library-shelves', 'lightbulb-on-outline', 'line-scan', 'loading', 
  'magnify', 'magnify-close', 'marker-check', 'math-integral-box',
  'message-outline', 'notebook-edit', 'notebook-edit-outline',
  'ocr', 
  'palette-swatch-outline', 'plus', 'poll', 'presentation', 'presentation-play', 'printer', 'puzzle-outline',
  'robot', 'robot-confused', 'robot-happy-outline',
  'school', 'star', 'star-outline', 'star-plus-outline', 
  'text-box-search-outline', 'text-recognition', 'tools',
  'account-school'
];

const outputData = {
  prefix: 'mdi',
  width: mdiData.width,
  height: mdiData.height,
  icons: {}
};

usedIcons.forEach(name => {
  if (mdiData.icons[name]) {
    outputData.icons[name] = mdiData.icons[name];
  } else {
    console.warn(`Icon not found: mdi:${name}`);
  }
});

// Write to src/assets/icons-bundle.json
const outputPath = path.resolve(__dirname, '../src/assets/icons-bundle.json');
fs.writeFileSync(outputPath, JSON.stringify(outputData));

console.log(`Bundled ${Object.keys(outputData.icons).length} icons to ${outputPath}`);
