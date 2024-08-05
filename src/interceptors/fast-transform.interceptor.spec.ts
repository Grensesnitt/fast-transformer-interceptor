import { FastTransformInterceptor } from './fast-transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import {NO_CHECK_KEY, NoCheck} from '../decorators/no-check.decorator';
import {NO_OUT_KEY, NoOut} from '../decorators/no-out.decorator';
import {NO_CHECK_PRIMITIVES_KEY, NoCheckPrimitives} from '../decorators/no-check-primitives.decorator';

// Helper function to mock DTO metadata
function mockDtoMetadata(dto: any, metadata: Record<string, any>) {
    (dto as any)._OPENAPI_METADATA_FACTORY = () => metadata;
}

// Helper function to create a mock execution context
function createMockExecutionContext(): ExecutionContext {
    return {
        getHandler: () => {},
        getClass: () => {},
    } as ExecutionContext;
}

// Helper function to create a mock call handler
function createMockCallHandler(data: any): CallHandler {
    return {
        handle: () => of(data),
    } as CallHandler;
}

// Helper function to set up the interceptor and mock the reflector
function setupInterceptor(dtoType: any): [FastTransformInterceptor, jest.Mock] {
    const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue({ type: dtoType }),
    } as any;
    const interceptor = new FastTransformInterceptor({ reflector, debug: false });
    return [interceptor, reflector.getAllAndOverride];
}

// Helper function to run the interceptor and get the result
async function runInterceptor(interceptor: FastTransformInterceptor, inputData: any) {
    const mockExecutionContext = createMockExecutionContext();
    const mockCallHandler = createMockCallHandler(inputData);
    return await interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise();
}

describe('FastTransformInterceptor', () => {
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

    it('should respect @NoCheck decorator', async () => {
        class FlexibleDto {
            @NoCheck()
            data: any;
        }

        mockDtoMetadata(FlexibleDto, {
            data: { type: () => Object },
        });

        const [interceptor] = setupInterceptor(FlexibleDto);
        const result = await runInterceptor(interceptor, { data: { foo: 'bar', baz: 123 } });

        expect(result).toEqual({ data: { foo: 'bar', baz: 123 } });
    });

    it('should respect @NoOut decorator', async () => {
        class UserDto {
            id: number;
            name: string;
            @NoOut()
            password: string;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            name: { type: () => String },
            password: { type: () => String },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, { id: 1, name: 'John Doe', password: 'secret' });

        expect(result).toEqual({ id: 1, name: 'John Doe' });
        expect(result).not.toHaveProperty('password');
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

    it('should respect @NoCheckPrimitives decorator', async () => {
        @NoCheckPrimitives()
        class PerformanceDto {
            id: number;
            name: string;
            createdAt: Date;
        }

        mockDtoMetadata(PerformanceDto, {
            id: { type: () => Number },
            name: { type: () => String },
            createdAt: { type: () => Date },
        });

        const [interceptor] = setupInterceptor(PerformanceDto);
        const result = await runInterceptor(interceptor, { id: '1', name: 42, createdAt: 'not-a-date' });

        expect(result).toEqual({ id: '1', name: 42, createdAt: 'not-a-date' });
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

    it('should allow null for nullable fields', async () => {
        class UserDto {
            id: number;
            name: string | null;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, nullable: true },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, { id: 1, name: null });

        expect(result).toEqual({ id: 1, name: null });
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

    it('should throw an error when required field is null', async () => {
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
        await expect(runInterceptor(interceptor, { id: 1, name: undefined })).rejects.toThrow();
    });

    it('should throw an error when a required field is undefined', async () => {
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

    it('should allow undefined for optional fields', async () => {
        class UserDto {
            id: number;
            name?: string;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, required: false },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, { id: 1 });

        expect(result).toEqual({ id: 1 });
    });

    it('should throw an error for undefined in a non-nullable field', async () => {
        class UserDto {
            id: number;
            name: string | null;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, required: true, nullable: false },
        });

        const [interceptor] = setupInterceptor(UserDto);
        await expect(runInterceptor(interceptor, { id: 1, name: undefined })).rejects.toThrow('Required field \'name\' cannot be undefined');
    });

    it('should handle undefined in nested objects', async () => {
        class AddressDto {
            street?: string;
            city: string;
        }

        class UserDto {
            id: number;
            address: AddressDto;
        }

        mockDtoMetadata(AddressDto, {
            street: { type: () => String, required: false },
            city: { type: () => String, required: true },
        });

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            address: { type: () => AddressDto, required: true },
        });

        const [interceptor] = setupInterceptor(UserDto);
        await expect(runInterceptor(interceptor, { id: 1, address: { city: undefined } })).rejects.toThrow('Required field \'city\' cannot be undefined');
    });

    it('should handle undefined in arrays', async () => {
        class UserDto {
            id: number;
            hobbies: string[];
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            hobbies: { type: () => [String], required: true },
        });

        const [interceptor] = setupInterceptor(UserDto);
        await expect(runInterceptor(interceptor, { id: 1, hobbies: [undefined, 'reading'] })).rejects.toThrow('Invalid value in array');
    });

    it('should respect @NoCheck decorator for undefined values', async () => {
        class UserDto {
            id: number;
            @NoCheck()
            name: string;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, required: true },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, { id: 1, name: undefined });

        expect(result).toEqual({ id: 1, name: undefined });
    });

    it('should handle combination of undefined, null, and defined values', async () => {
        class UserDto {
            id: number;
            name: string;
            email?: string | null;
            age?: number;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, required: true },
            email: { type: () => String, required: false, nullable: true },
            age: { type: () => Number, required: false },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, { id: 1, name: 'John', email: null });

        expect(result).toEqual({ id: 1, name: 'John', email: null });
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
        const result = await runInterceptor(interceptor, { id: 1, name: 'John', address: { street: 'Main St' } });

        expect(result).toEqual({ id: 1, name: 'John', address: { street: 'Main St' } });
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
        const result = await runInterceptor(interceptor, { id: 1, hobbies: ['reading', null, 'swimming'] });

        expect(result).toEqual({ id: 1, hobbies: ['reading', null, 'swimming'] });
    });

    it('should handle mixture of required and optional fields in nested objects', async () => {
        class AddressDto {
            street: string;
            city?: string;
            country: string;
        }

        class UserDto {
            id: number;
            name: string;
            address?: AddressDto;
        }

        mockDtoMetadata(AddressDto, {
            street: { type: () => String, required: true },
            city: { type: () => String, required: false },
            country: { type: () => String, required: true },
        });

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, required: true },
            address: { type: () => AddressDto, required: false },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            name: 'John',
            address: { street: 'Main St', country: 'USA' }
        });

        expect(result).toEqual({
            id: 1,
            name: 'John',
            address: { street: 'Main St', country: 'USA' }
        });
    });

    it('should handle null in optional fields', async () => {
        class UserDto {
            id: number;
            name: string;
            email?: string | null;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, required: true },
            email: { type: () => String, required: false, nullable: true },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, { id: 1, name: 'John', email: null });

        expect(result).toEqual({ id: 1, name: 'John', email: null });
    });

    it('should throw error when required field is null in nested object', async () => {
        class AddressDto {
            street: string;
            city: string;
        }

        class UserDto {
            id: number;
            address: AddressDto;
        }

        mockDtoMetadata(AddressDto, {
            street: { type: () => String, required: true },
            city: { type: () => String, required: true },
        });

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            address: { type: () => AddressDto, required: true },
        });

        const [interceptor] = setupInterceptor(UserDto);
        await expect(runInterceptor(interceptor, {
            id: 1,
            address: { street: 'Main St', city: null }
        })).rejects.toThrow();
    });

    it('should handle @NoCheck with null and undefined', async () => {
        class UserDto {
            id: number;
            @NoCheck()
            data: any;
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            data: { type: () => Object },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result1 = await runInterceptor(interceptor, { id: 1, data: null });
        const result2 = await runInterceptor(interceptor, { id: 1, data: undefined });

        expect(result1).toEqual({ id: 1, data: null });
        expect(result2).toEqual({ id: 1, data: undefined });
    });

    it('should handle complex nested structure with optionals', async () => {
        class AddressDto {
            street?: string;
            city: string;
        }

        class CompanyDto {
            name: string;
            address?: AddressDto;
        }

        class UserDto {
            id: number;
            name: string;
            company?: CompanyDto | null;
        }

        mockDtoMetadata(AddressDto, {
            street: { type: () => String, required: false },
            city: { type: () => String, required: true },
        });

        mockDtoMetadata(CompanyDto, {
            name: { type: () => String, required: true },
            address: { type: () => AddressDto, required: false },
        });

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, required: true },
            company: { type: () => CompanyDto, required: false, nullable: true },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            name: 'John',
            company: {
                name: 'ACME',
                address: { city: 'New York' }
            }
        });

        expect(result).toEqual({
            id: 1,
            name: 'John',
            company: {
                name: 'ACME',
                address: { city: 'New York' }
            }
        });
    });

    it('should handle array of optional complex objects', async () => {
        class AddressDto {
            street?: string;
            city: string;
        }

        class UserDto {
            id: number;
            name: string;
            addresses?: (AddressDto | null)[];
        }

        mockDtoMetadata(AddressDto, {
            street: { type: () => String, required: false },
            city: { type: () => String, required: true },
        });

        mockDtoMetadata(UserDto, {
            id: { type: () => Number, required: true },
            name: { type: () => String, required: true },
            addresses: { type: () => [AddressDto], required: false, nullable: true },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            name: 'John',
            addresses: [
                { city: 'New York' },
                null,
                { street: 'Main St', city: 'Boston' }
            ]
        });

        expect(result).toEqual({
            id: 1,
            name: 'John',
            addresses: [
                { city: 'New York' },
                null,
                { street: 'Main St', city: 'Boston' }
            ]
        });
    });

    it('should transform a UserDto with nested address object', async () => {
        class UserDto {
            id: number;
            name: string;
            address: {
                city: string;
            };
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            name: { type: () => String },
            address: {
                type: () => ({
                    city: { type: () => String }
                })
            }
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            name: 'John Doe',
            address: { city: 'New York', country: 'USA' }
        });

        expect(result).toEqual({
            id: 1,
            name: 'John Doe',
            address: { city: 'New York' }
        });
    });

    it('should throw an error when nested object is missing', async () => {
        class UserDto {
            id: number;
            name: string;
            address: {
                city: string;
            };
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            name: { type: () => String },
            address: {
                type: () => ({
                    city: { type: () => String }
                })
            }
        });

        const [interceptor] = setupInterceptor(UserDto);
        await expect(runInterceptor(interceptor, {
            id: 1,
            name: 'John Doe'
        })).rejects.toThrow();
    });

    it('should throw an error when nested field is missing', async () => {
        class UserDto {
            id: number;
            name: string;
            address: {
                city: string;
            };
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            name: { type: () => String },
            address: {
                type: () => ({
                    city: { type: () => String, required: true }
                })
            }
        });

        const [interceptor] = setupInterceptor(UserDto);
        await expect(runInterceptor(interceptor, {
            id: 1,
            name: 'John Doe',
            address: {}
        })).rejects.toThrow();
    });

    it('should handle optional nested fields', async () => {
        class UserDto {
            id: number;
            name: string;
            address?: {
                city?: string;
                street: string;
            };
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            name: { type: () => String },
            address: {
                type: () => ({
                    city: { type: () => String, required: false },
                    street: { type: () => String }
                }),
                required: false
            }
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            name: 'John Doe',
            address: { street: 'Main St' }
        });

        expect(result).toEqual({
            id: 1,
            name: 'John Doe',
            address: { street: 'Main St' }
        });
    });

    it('should handle deeply nested objects', async () => {
        class UserDto {
            id: number;
            name: string;
            address: {
                city: string;
                geo: {
                    lat: number;
                    lng: number;
                };
            };
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            name: { type: () => String },
            address: {
                type: () => ({
                    city: { type: () => String },
                    geo: {
                        type: () => ({
                            lat: { type: () => Number },
                            lng: { type: () => Number }
                        })
                    }
                })
            }
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            name: 'John Doe',
            address: {
                city: 'New York',
                geo: { lat: 40.7128, lng: -74.0060, elevation: 10 }
            }
        });

        expect(result).toEqual({
            id: 1,
            name: 'John Doe',
            address: {
                city: 'New York',
                geo: { lat: 40.7128, lng: -74.0060 }
            }
        });
    });

    it('should throw an error for invalid nested field types', async () => {
        class UserDto {
            id: number;
            name: string;
            address: {
                city: string;
                zipCode: number;
            };
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            name: { type: () => String },
            address: {
                type: () => ({
                    city: { type: () => String },
                    zipCode: { type: () => Number }
                })
            }
        });

        const [interceptor] = setupInterceptor(UserDto);
        await expect(runInterceptor(interceptor, {
            id: 1,
            name: 'John Doe',
            address: { city: 'New York', zipCode: '10001' }
        })).rejects.toThrow();
    });

    it('should handle transformation of Date objects', async () => {
        class EventDto {
            id: number;
            name: string;
            date: Date;
        }

        mockDtoMetadata(EventDto, {
            id: { type: () => Number },
            name: { type: () => String },
            date: { type: () => Date },
        });

        const [interceptor] = setupInterceptor(EventDto);
        const testDate = new Date('2023-05-01T12:00:00Z');
        const result = await runInterceptor(interceptor, { id: 1, name: 'Test Event', date: testDate });

        expect(result).toEqual({ id: 1, name: 'Test Event', date: testDate });
    });

    it('should throw an error for invalid Date objects', async () => {
        class EventDto {
            id: number;
            name: string;
            date: Date;
        }

        mockDtoMetadata(EventDto, {
            id: { type: () => Number },
            name: { type: () => String },
            date: { type: () => Date },
        });

        const [interceptor] = setupInterceptor(EventDto);
        await expect(runInterceptor(interceptor, { id: 1, name: 'Test Event', date: 'not-a-date' })).rejects.toThrow();
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

    it('should throw an error for invalid BigInt values', async () => {
        class BigNumberDto {
            id: number;
            bigValue: bigint;
        }

        mockDtoMetadata(BigNumberDto, {
            id: { type: () => Number },
            bigValue: { type: () => BigInt },
        });

        const [interceptor] = setupInterceptor(BigNumberDto);
        await expect(runInterceptor(interceptor, { id: 1, bigValue: 'not-a-bigint' })).rejects.toThrow();
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

    it('should throw an error for invalid Symbol values', async () => {
        class SymbolDto {
            id: number;
            symbolValue: symbol;
        }

        mockDtoMetadata(SymbolDto, {
            id: { type: () => Number },
            symbolValue: { type: () => Symbol },
        });

        const [interceptor] = setupInterceptor(SymbolDto);
        await expect(runInterceptor(interceptor, { id: 1, symbolValue: 'not-a-symbol' })).rejects.toThrow();
    });

    it('should throw an error for invalid nested arrays', async () => {
        class NestedArrayDto {
            id: number;
            matrix: number[][];
        }

        mockDtoMetadata(NestedArrayDto, {
            id: { type: () => Number },
            matrix: { type: () => [[Number]] },
        });

        const [interceptor] = setupInterceptor(NestedArrayDto);
        await expect(runInterceptor(interceptor, { id: 1, matrix: [[1, 2], ['3', 4]] })).rejects.toThrow();
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

    it('should handle transformation with multiple @NoCheck decorators', async () => {
        class FlexibleDto {
            id: number;
            @NoCheck()
            data1: any;
            @NoCheck()
            data2: any;
        }

        mockDtoMetadata(FlexibleDto, {
            id: { type: () => Number },
            data1: { type: () => Object },
            data2: { type: () => Object },
        });

        const [interceptor] = setupInterceptor(FlexibleDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            data1: { foo: 'bar', baz: 123 },
            data2: [1, 'two', { three: 3 }],
        });

        expect(result).toEqual({
            id: 1,
            data1: { foo: 'bar', baz: 123 },
            data2: [1, 'two', { three: 3 }],
        });
    });

    it('should handle transformation with a mix of @NoCheck and regular properties', async () => {
        class MixedDto {
            id: number;
            name: string;
            @NoCheck()
            flexibleData: any;
            age: number;
        }

        mockDtoMetadata(MixedDto, {
            id: { type: () => Number },
            name: { type: () => String },
            flexibleData: { type: () => Object },
            age: { type: () => Number },
        });

        const [interceptor] = setupInterceptor(MixedDto);
        const result = await runInterceptor(interceptor, {
            id: 1,
            name: 'John Doe',
            flexibleData: { key1: 'value1', key2: [1, 2, 3] },
            age: '30',
        });

        expect(result).toEqual({
            id: 1,
            name: 'John Doe',
            flexibleData: { key1: 'value1', key2: [1, 2, 3] },
            age: 30,
        });
    });

    it('should handle transformation with @NoCheckPrimitives decorator', async () => {
        @NoCheckPrimitives()
        class NoPrimitiveChecksDto {
            id: number;
            name: string;
            age: number;
            isActive: boolean;
        }

        mockDtoMetadata(NoPrimitiveChecksDto, {
            id: { type: () => Number },
            name: { type: () => String },
            age: { type: () => Number },
            isActive: { type: () => Boolean },
        });

        const [interceptor] = setupInterceptor(NoPrimitiveChecksDto);
        const result = await runInterceptor(interceptor, {
            id: '1',
            name: 42,
            age: 'thirty',
            isActive: 1,
        });

        expect(result).toEqual({
            id: '1',
            name: 42,
            age: 'thirty',
            isActive: 1,
        });
    });

    it('should handle transformation with @NoCheckPrimitives and nested objects', async () => {
        @NoCheckPrimitives()
        class UserDto {
            id: number;
            name: string;
            address: {
                street: string;
                city: string;
            };
        }

        mockDtoMetadata(UserDto, {
            id: { type: () => Number },
            name: { type: () => String },
            address: {
                type: () => ({
                    street: { type: () => String },
                    city: { type: () => String },
                }),
            },
        });

        const [interceptor] = setupInterceptor(UserDto);
        const result = await runInterceptor(interceptor, {
            id: '1',
            name: 42,
            address: {
                street: 123,
                city: true,
            },
        });

        expect(result).toEqual({
            id: '1',
            name: 42,
            address: {
                street: 123,
                city: true,
            },
        });
    });
});