import { FastTransformInterceptor } from '../src';
import { mockDtoMetadata, setupInterceptor, runInterceptor } from './setup';

describe('FastTransformInterceptor - Optional Fields', () => {
    beforeEach(() => {
        FastTransformInterceptor.clearCache();
    });

    it('should handle optional fields', async () => {
        class UserDto {
            id: number;
            name: string;
            age?: number;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, required: true },
            age: { type: () => Number, required: false },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, { id: 1, name: 'John Doe' });

        expect(result).toEqual({ id: 1, name: 'John Doe' });
    });

    it('should handle combination of required, nullable, and optional fields', async () => {
        class UserDto {
            id: number;
            name: string;
            email: string | null;
            age?: number;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, required: true },
            email: { type: () => String, nullable: true },
            age: { type: () => Number, required: false },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            name: 'John Doe',
            email: null,
            extra: 'field'
        });

        expect(result).toEqual({
            id: 1,
            name: 'John Doe',
            email: null
        });
    });

    it('should handle deeply nested optional fields', async () => {
        class AddressDto {
            street?: string;
            city?: string;
        }

        class UserDto {
            id: number;
            name: string;
            address?: AddressDto;
        }

        mockDtoMetadata(AddressDto, {
            street: { type: () => String, required: false },
            city: { type: () => String, required: false },
        });

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, required: true },
            address: { type: () => AddressDto, required: false },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            name: 'John Doe',
            address: { street: 'Main St' },
        });

        expect(result).toEqual({
            id: 1,
            name: 'John Doe',
            address: { street: 'Main St' },
        });
    });

    it('should handle arrays with optional elements', async () => {
        class UserDto {
            id: number;
            hobbies?: (string | null)[];
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            hobbies: { type: () => [String], required: false, nullable: true },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            hobbies: ['reading', null, 'swimming'],
        });

        expect(result).toEqual({
            id: 1,
            hobbies: ['reading', null, 'swimming'],
        });
    });
});