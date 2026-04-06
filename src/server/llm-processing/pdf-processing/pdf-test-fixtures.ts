const escapePdfText = (value: string): string => {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/\(/g, '\\(')
		.replace(/\)/g, '\\)')
		.replace(/\r\n?/g, '\n');
};

export const buildTextContentStream = (
	lines: Array<string | string[]>
): string => {
	const commands: string[] = ['BT', '/F1 12 Tf', '1 0 0 1 72 720 Tm'];
	let isFirstLine = true;

	for (const line of lines) {
		if (!isFirstLine) {
			commands.push('0 -18 Td');
		}
		isFirstLine = false;

		if (typeof line === 'string') {
			commands.push(`(${escapePdfText(line)}) Tj`);
			continue;
		}

		line.forEach((fragment, index) => {
			if (index > 0) {
				commands.push('80 0 Td');
			}
			commands.push(`(${escapePdfText(fragment)}) Tj`);
		});
	}

	commands.push('ET');
	return commands.join('\n');
};

export const buildPdfFixtureFromContentStreams = (
	pageContentStreams: string[]
): Uint8Array => {
	if (pageContentStreams.length === 0) {
		throw new Error('Se requiere al menos una pagina para construir el fixture PDF.');
	}

	const objectContents = new Map<number, string>();
	const catalogId = 1;
	const pagesId = 2;
	const fontId = 3;
	const pageIds = pageContentStreams.map((_, index) => 4 + index * 2);
	const contentIds = pageContentStreams.map((_, index) => 5 + index * 2);
	const maxObjectId = contentIds.at(-1) ?? fontId;

	objectContents.set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
	objectContents.set(
		pagesId,
		`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
	);
	objectContents.set(fontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

	pageIds.forEach((pageId, index) => {
		const contentId = contentIds[index];
		objectContents.set(
			pageId,
			`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
		);

		const contentStream = pageContentStreams[index];
		objectContents.set(
			contentId,
			`<< /Length ${Buffer.byteLength(contentStream, 'utf-8')} >>\nstream\n${contentStream}\nendstream`
		);
	});

	let pdfDocument = '%PDF-1.4\n';
	const offsets: number[] = [0];

	for (let objectId = 1; objectId <= maxObjectId; objectId += 1) {
		const objectBody = objectContents.get(objectId);
		if (!objectBody) {
			throw new Error(`Falta el objeto ${objectId} en el fixture PDF.`);
		}

		offsets[objectId] = Buffer.byteLength(pdfDocument, 'utf-8');
		pdfDocument += `${objectId} 0 obj\n${objectBody}\nendobj\n`;
	}

	const xrefOffset = Buffer.byteLength(pdfDocument, 'utf-8');
	pdfDocument += `xref\n0 ${maxObjectId + 1}\n`;
	pdfDocument += '0000000000 65535 f \n';

	for (let objectId = 1; objectId <= maxObjectId; objectId += 1) {
		pdfDocument += `${String(offsets[objectId]).padStart(10, '0')} 00000 n \n`;
	}

	pdfDocument += `trailer\n<< /Size ${maxObjectId + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

	return new TextEncoder().encode(pdfDocument);
};

export const buildPdfFixture = (pages: string[]): Uint8Array => {
	return buildPdfFixtureFromContentStreams(
		pages.map((pageText) =>
			buildTextContentStream(pageText.length > 0 ? pageText.split('\n') : [''])
		)
	);
};

export const createPdfFileFixture = (pages: string[], fileName = 'fixture.pdf'): File => {
	return new File([buildPdfFixture(pages)], fileName, {
		type: 'application/pdf'
	});
};
