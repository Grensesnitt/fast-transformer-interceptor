import { FastTransformInterceptor } from '../src';
import { mockDtoMetadata, setupInterceptor, runInterceptor } from './setup';

describe('FastTransformInterceptor - Array Handling', () => {
    beforeEach(() => {
        FastTransformInterceptor.clearCache();
    });

    it('should handle arrays of primitive types', async () => {
        class ArrayDto {
            numbers: number[];
            strings: string[];
        }

        mockDtoMetadata(ArrayDto, {
            numbers: { type: () => [Number] },
            strings: { type: () => [String] },
        });

        const [interceptor] = setupInterceptor(ArrayDto);
        const result = await runInterceptor(interceptor, {
            numbers: [1, 2, 3],
            strings: ['a', 'b', 'c'],
        });

        expect(result).toEqual({
            numbers: [1, 2, 3],
            strings: ['a', 'b', 'c'],
        });
    });

    it('should handle arrays of complex types', async () => {
        class ItemDto {
            id: number;
            name: string;
        }

        class ArrayDto {
            items: ItemDto[];
        }

        mockDtoMetadata(ItemDto, {
            id: { type: () => Number },
            name: { type: () => String },
        });

        mockDtoMetadata(ArrayDto, {
            items: { type: () => [ItemDto] },
        });

        const [interceptor] = setupInterceptor(ArrayDto);
        const result = await runInterceptor(interceptor, {
            items: [
                { id: 1, name: 'Item 1', extra: 'field' },
                { id: 2, name: 'Item 2' },
            ],
        });

        expect(result).toEqual({
            items: [
                { id: 1, name: 'Item 1' },
                { id: 2, name: 'Item 2' },
            ],
        });
    });

    it('should throw an error for invalid nested arrays', async () => {
        class NestedArrayDto {
            matrix: number[][];
        }

        mockDtoMetadata(NestedArrayDto, {
            matrix: { type: () => [[Number]] },
        });

        const [interceptor] = setupInterceptor(NestedArrayDto);
        await expect(runInterceptor(interceptor, {
            matrix: [[1, 2], ['3', 4]],
        })).rejects.toThrow();
    });
});