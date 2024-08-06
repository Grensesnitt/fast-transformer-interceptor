import { FastTransformInterceptor } from '../src';
import { mockDtoMetadata, setupInterceptor, runInterceptor } from './setup';

describe('FastTransformInterceptor - Edge Cases', () => {
    beforeEach(() => {
        FastTransformInterceptor.clearCache();
    });

    it('should handle empty objects', async () => {
        class EmptyDto {}

        mockDtoMetadata(EmptyDto, {});

        const [interceptor] = setupInterceptor(EmptyDto);
        const result = await runInterceptor(interceptor, {});

        expect(result).toEqual({});
    });

    it('should handle very large objects', async () => {
        class LargeDto {
            [key: string]: number;
        }

        const metadata: Record<string, any> = {};
        for (let i = 0; i < 1000; i++) {
            metadata[`field${i}`] = { type: () => Number };
        }

        mockDtoMetadata(LargeDto, metadata);

        const [interceptor] = setupInterceptor(LargeDto);
        const largeObject: Record<string, number> = {};
        for (let i = 0; i < 1000; i++) {
            largeObject[`field${i}`] = i;
        }

        const result = await runInterceptor(interceptor, largeObject);

        expect(Object.keys(result).length).toBe(1000);
        expect(result.field0).toBe(0);
        expect(result.field999).toBe(999);
    });

    it('should handle transformation of complex nested structures', async () => {
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
            companies: CompanyDto[];
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
            companies: { type: () => [CompanyDto] },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            name: 'John Doe',
            companies: [
                {
                    name: 'Company A',
                    address: { street: 'Street A', city: 'City A', country: 'Country A' },
                },
                {
                    name: 'Company B',
                    address: { street: 'Street B', city: 'City B', zipCode: 12345 },
                },
            ],
        });

        expect(result).toEqual({
            id: 1,
            name: 'John Doe',
            companies: [
                {
                    name: 'Company A',
                    address: { street: 'Street A', city: 'City A' },
                },
                {
                    name: 'Company B',
                    address: { street: 'Street B', city: 'City B' },
                },
            ],
        });
    });
});