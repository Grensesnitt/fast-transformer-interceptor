import { FastTransformInterceptor } from '../src';
import { mockDtoMetadata, setupInterceptor, runInterceptor } from './setup';

describe('FastTransformInterceptor - Complex Types', () => {
    beforeEach(() => {
        FastTransformInterceptor.clearCache();
    });

    it('should handle enum types', async () => {
        enum UserRole {
            Admin = 'ADMIN',
            User = 'USER',
        }

        class UserDto {
            id: number;
            role: UserRole;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            role: { enum: UserRole },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, { id: 1, role: 'ADMIN' });

        expect(result).toEqual({ id: 1, role: 'ADMIN' });
    });

    it('should throw an error for invalid enum values', async () => {
        enum UserRole {
            Admin = 'ADMIN',
            User = 'USER',
        }

        class UserDto {
            id: number;
            role: UserRole;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            role: { enum: UserRole },
        });

        const [interceptor] = setupInterceptor(UserDto);
        await expect(runInterceptor(interceptor, { id: 1, role: 'INVALID_ROLE' })).rejects.toThrow();
    });

    it('should handle date types', async () => {
        class EventDto {
            id: number;
            date: Date;
        }

        mockDtoMetadata(EventDto, {
            id: { type: () => Number },
            date: { type: () => Date },
        });

        const [interceptor] = setupInterceptor(EventDto);
        const testDate = new Date('2023-05-01T12:00:00Z');
        const result = await runInterceptor(interceptor, { id: 1, date: testDate });

        expect(result).toEqual({ id: 1, date: testDate });
    });

    it('should throw an error for invalid date', async () => {
        class EventDto {
            id: number;
            date: Date;
        }

        mockDtoMetadata(EventDto, {
            id: { type: () => Number },
            date: { type: () => Date },
        });

        const [interceptor] = setupInterceptor(EventDto);
        await expect(runInterceptor(interceptor, { id: 1, date: 'not-a-date' })).rejects.toThrow();
    });

    it('should handle BigInt values', async () => {
        class BigNumberDto {
            id: number;
            bigValue: bigint;
        }

        mockDtoMetadata(BigNumberDto, {
            id: { type: () => Number },
            bigValue: { type: () => BigInt },
        });

        const [interceptor] = setupInterceptor(BigNumberDto);
        const result = await runInterceptor(interceptor, { id: 1, bigValue: BigInt('9007199254740991') });

        expect(result).toEqual({ id: 1, bigValue: BigInt('9007199254740991') });
    });

    it('should handle Symbol values', async () => {
        class SymbolDto {
            id: number;
            symbolValue: symbol;
        }

        mockDtoMetadata(SymbolDto, {
            id: { type: () => Number },
            symbolValue: { type: () => Symbol },
        });

        const [interceptor] = setupInterceptor(SymbolDto);
        const testSymbol = Symbol('test');
        const result = await runInterceptor(interceptor, { id: 1, symbolValue: testSymbol });

        expect(result).toEqual({ id: 1, symbolValue: testSymbol });
    });
});