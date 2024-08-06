import { FastTransformInterceptor } from '../src';
import { mockDtoMetadata, setupInterceptor, runInterceptor } from './setup';

describe('FastTransformInterceptor - Error Handling', () => {
    beforeEach(() => {
        FastTransformInterceptor.clearCache();
    });

    it('should throw an error for missing required fields', async () => {
        class UserDto {
            id: number;
            name: string;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, required: true },
        });

        const [interceptor] = setupInterceptor(UserDto);
        await expect(runInterceptor(interceptor, { id: 1 })).rejects.toThrow();
    });

    it('should throw an error for null on non-nullable fields', async () => {
        class UserDto {
            id: number;
            name: string;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, required: true },
        });

        const [interceptor] = setupInterceptor(UserDto);
        await expect(runInterceptor(interceptor, { id: 1, name: null })).rejects.toThrow();
    });

    it('should throw an error when required field is undefined', async () => {
        class UserDto {
            id: number;
            name: string;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, required: true },
        });

        const [interceptor] = setupInterceptor(UserDto);
        await expect(runInterceptor(interceptor, { id: 1, name: undefined })).rejects.toThrow('Required field \'name\' cannot be undefined');
    });
});