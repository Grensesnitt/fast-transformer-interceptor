import { FastTransformInterceptor } from '../src';
import { mockDtoMetadata, setupInterceptor, runInterceptor } from './setup';

describe('FastTransformInterceptor - Nested Objects', () => {
    beforeEach(() => {
        FastTransformInterceptor.clearCache();
    });

    it('should transform nested DTOs', async () => {
        class AddressDto {
            street: string;
            city: string;
        }

        class UserDto {
            id: number;
            name: string;
            address: AddressDto;
        }

        mockDtoMetadata(AddressDto, {
            street: { type: () => String },
            city: { type: () => String },
        });

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            name: { type: () => String },
            address: { type: () => AddressDto },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            name: 'John Doe',
            address: { street: 'Main St', city: 'New York', country: 'USA' },
        });

        expect(result).toEqual({
            id: 1,
            name: 'John Doe',
            address: { street: 'Main St', city: 'New York' },
        });
    });

    it('should handle deeply nested objects', async () => {
        class AddressDto {
            street: string;
            city: string;
        }

        class CompanyDto {
            name: string;
            address: AddressDto;
        }

        class UserDto {
            id: number;
            name: string;
            company: CompanyDto;
        }

        mockDtoMetadata(AddressDto, {
            street: { type: () => String },
            city: { type: () => String },
        });

        mockDtoMetadata(CompanyDto, {
            name: { type: () => String },
            address: { type: () => AddressDto },
        });

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            name: { type: () => String },
            company: { type: () => CompanyDto },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            name: 'John Doe',
            company: {
                name: 'ACME Corp',
                address: { street: 'Business Ave', city: 'Metropolis', country: 'USA' },
            },
        });

        expect(result).toEqual({
            id: 1,
            name: 'John Doe',
            company: {
                name: 'ACME Corp',
                address: { street: 'Business Ave', city: 'Metropolis' },
            },
        });
    });

    it('should handle arrays of nested objects', async () => {
        class AddressDto {
            street: string;
            city: string;
        }

        class UserDto {
            id: number;
            name: string;
            addresses: AddressDto[];
        }

        mockDtoMetadata(AddressDto, {
            street: { type: () => String },
            city: { type: () => String },
        });

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            name: { type: () => String },
            addresses: { type: () => [AddressDto] },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            name: 'John Doe',
            addresses: [
                { street: 'Main St', city: 'New York', country: 'USA' },
                { street: 'High St', city: 'London', postcode: 'SW1' },
            ],
        });

        expect(result).toEqual({
            id: 1,
            name: 'John Doe',
            addresses: [
                { street: 'Main St', city: 'New York' },
                { street: 'High St', city: 'London' },
            ],
        });
    });
});