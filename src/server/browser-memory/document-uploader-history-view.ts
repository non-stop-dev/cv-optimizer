import { toDisplayDate } from './document-uploader-shared';
import type { HistoryEntry } from './history-entry';

interface RenderHistoryParams {
	historyList: HTMLElement;
	historyEmpty: HTMLElement;
	historyClearButton: HTMLButtonElement;
	entries: HistoryEntry[];
}

export const renderHistoryList = ({
	historyList,
	historyEmpty,
	historyClearButton,
	entries
}: RenderHistoryParams): void => {
	historyList.innerHTML = '';
	historyEmpty.hidden = entries.length > 0;
	historyClearButton.disabled = entries.length === 0;

	for (const entry of entries) {
		const item = document.createElement('li');
		item.dataset.uploadHistoryItem = '';

		const meta = document.createElement('div');
		meta.dataset.historyMeta = '';

		const fileName = document.createElement('p');
		fileName.dataset.historyFile = '';
		fileName.textContent = entry.sourceFileName || entry.safeFileName || 'CV sin nombre';

		const info = document.createElement('p');
		info.dataset.historyInfo = '';
		const sizeLabel =
			typeof entry.inputSizeInBytes === 'number'
				? ` | ${(entry.inputSizeInBytes / 1024).toFixed(1)} KB`
				: '';
		info.textContent = `${(entry.format || 'txt').toUpperCase()} | ${toDisplayDate(entry.createdAt)}${sizeLabel}`;

		meta.append(fileName, info);

		const loadButton = document.createElement('button');
		loadButton.type = 'button';
		loadButton.dataset.historyLoadButton = '';
		loadButton.dataset.historyLoadId = entry.id;
		loadButton.textContent = 'Cargar version';

		item.append(meta, loadButton);
		historyList.appendChild(item);
	}
};
