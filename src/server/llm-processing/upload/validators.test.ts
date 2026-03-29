import { describe, expect, it } from 'vitest';

import { UploadSanitizationError } from './errors';
import { parseTargetPositionsFromFormData } from './validators';

describe('parseTargetPositionsFromFormData', () => {
	it('retorna arreglo vacio cuando no se envia el campo', () => {
		expect(parseTargetPositionsFromFormData(null)).toEqual([]);
		expect(parseTargetPositionsFromFormData('')).toEqual([]);
	});

	it('normaliza espacios y elimina duplicados por texto', () => {
		const positions = parseTargetPositionsFromFormData(
			JSON.stringify(['  Analista de datos  ', 'analista de datos', 'BI Analyst'])
		);

		expect(positions).toEqual(['Analista de datos', 'BI Analyst']);
	});

	it('lanza error cuando supera el maximo de tres posiciones unicas', () => {
		expect(() =>
			parseTargetPositionsFromFormData(
				JSON.stringify(['Analista de datos', 'BI Analyst', 'Data Engineer', 'Data Scientist'])
			)
		).toThrow(UploadSanitizationError);
	});

	it('lanza error cuando el payload no es JSON valido', () => {
		expect(() => parseTargetPositionsFromFormData('Analista de datos,BI Analyst')).toThrow(
			UploadSanitizationError
		);
	});

	it('lanza error cuando el payload JSON no es arreglo', () => {
		expect(() => parseTargetPositionsFromFormData(JSON.stringify({ role: 'Analista' }))).toThrow(
			UploadSanitizationError
		);
	});

	it('lanza error cuando una posicion no es string', () => {
		expect(() =>
			parseTargetPositionsFromFormData(JSON.stringify(['Analista', 101]))
		).toThrow(UploadSanitizationError);
	});

	it('lanza error cuando una posicion excede el limite de caracteres', () => {
		const veryLongPosition = 'a'.repeat(81);

		expect(() =>
			parseTargetPositionsFromFormData(JSON.stringify([veryLongPosition]))
		).toThrow(UploadSanitizationError);
	});
});
