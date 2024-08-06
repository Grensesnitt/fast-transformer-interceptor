import { FastTransformInterceptor } from '../src';
import { mockDtoMetadata, setupInterceptor, runInterceptor } from './setup';

describe('FastTransformInterceptor - Basic Transformation', () => {
    beforeEach(() => {
        FastTransformInterceptor.clearCache();
    });

    it('should transform a simple DTO', async () => {
        class UserDto {
            id: number;
            name: string;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            name: { type: () => String },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, { id: 1, name: 'John Doe', extra: 'field' });

        expect(result).toEqual({ id: 1, name: 'John Doe' });
    });

    it('should handle arrays of DTOs', async () => {
        class UserDto {
            id: number;
            name: string;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            name: { type: () => String },
        });

        const [interceptor] = setupInterceptor([UserDto]);
        const result = await runInterceptor(interceptor, [
            { id: 1, name: 'John Doe', extra: 'field' },
            { id: 2, name: 'Jane Doe', age: 30 },
        ]);

        expect(result).toEqual([
            { id: 1, name: 'John Doe' },
            { id: 2, name: 'Jane Doe' },
        ]);
    });

    it('should handle nullable types', async () => {
        class UserDto {
            id: number;
            name: string | null;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            name: { type: () => String, nullable: true },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, { id: 1, name: null });

        expect(result).toEqual({ id: 1, name: null });
    });
});