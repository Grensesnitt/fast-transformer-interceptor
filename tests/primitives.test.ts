import { FastTransformInterceptor } from '../src';
import { mockDtoMetadata, setupInterceptor, runInterceptor } from './setup';

describe('FastTransformInterceptor - Primitives', () => {
    beforeEach(() => {
        FastTransformInterceptor.clearCache();
    });

    it('should handle primitive types correctly', async () => {
        class PrimitiveDto {
            numberField: number;
            stringField: string;
            booleanField: boolean;
            bigintField: bigint;
            symbolField: symbol;
        }

        mockDtoMetadata(PrimitiveDto, {
            numberField: { type: () => Number },
            stringField: { type: () => String },
            booleanField: { type: () => Boolean },
            bigintField: { type: () => BigInt },
            symbolField: { type: () => Symbol },
        });

        const [interceptor] = setupInterceptor(PrimitiveDto);
        const testSymbol = Symbol('test');
        const result = await runInterceptor(interceptor, {
            numberField: 42,
            stringField: 'hello',
            booleanField: true,
            bigintField: BigInt(9007199254740991),
            symbolField: testSymbol,
        });

        expect(result).toEqual({
            numberField: 42,
            stringField: 'hello',
            booleanField: true,
            bigintField: BigInt(9007199254740991),
            symbolField: testSymbol,
        });
    });

    it('should throw error for invalid primitive types', async () => {
        class InvalidPrimitiveDto {
            numberField: number;
            stringField: string;
            booleanField: boolean;
        }

        mockDtoMetadata(InvalidPrimitiveDto, {
            numberField: { type: () => Number },
            stringField: { type: () => String },
            booleanField: { type: () => Boolean },
        });

        const [interceptor] = setupInterceptor(InvalidPrimitiveDto);
        await expect(runInterceptor(interceptor, {
            numberField: 'not a number',
            stringField: 42,
            booleanField: 'not a boolean',
        })).rejects.toThrow();
    });

    it('should handle nullable primitive types', async () => {
        class NullablePrimitiveDto {
            optionalNumber: number | null;
            optionalString: string | null;
        }

        mockDtoMetadata(NullablePrimitiveDto, {
            optionalNumber: { type: () => Number, nullable: true },
            optionalString: { type: () => String, nullable: true },
        });

        const [interceptor] = setupInterceptor(NullablePrimitiveDto);
        const result = await runInterceptor(interceptor, {
            optionalNumber: null,
            optionalString: null,
        });

        expect(result).toEqual({
            optionalNumber: null,
            optionalString: null,
        });
    });

    it('should handle Date objects', async () => {
        class DateDto {
            dateField: Date;
        }

        mockDtoMetadata(DateDto, {
            dateField: { type: () => Date },
        });

        const [interceptor] = setupInterceptor(DateDto);
        const testDate = new Date('2023-05-01T12:00:00Z');
        const result = await runInterceptor(interceptor, {
            dateField: testDate,
        });

        expect(result.dateField).toBeInstanceOf(Date);
        expect(result.dateField.toISOString()).toBe(testDate.toISOString());
    });

    it('should throw error for invalid Date', async () => {
        class DateDto {
            dateField: Date;
        }

        mockDtoMetadata(DateDto, {
            dateField: { type: () => Date },
        });

        const [interceptor] = setupInterceptor(DateDto);
        await expect(runInterceptor(interceptor, {
            dateField: 'not a date',
        })).rejects.toThrow();
    });

    it('should handle optional primitive types', async () => {
        class OptionalPrimitiveDto {
            optionalNumber?: number;
            optionalString?: string;
        }

        mockDtoMetadata(OptionalPrimitiveDto, {
            optionalNumber: { type: () => Number, required: false },
            optionalString: { type: () => String, required: false },
        });

        const [interceptor] = setupInterceptor(OptionalPrimitiveDto);
        const result = await runInterceptor(interceptor, {
            optionalNumber: 42,
        });

        expect(result).toEqual({
            optionalNumber: 42,
        });
    });
});