import { FastTransformInterceptor } from '../src';
import { mockDtoMetadata, setupInterceptor, runInterceptor } from './setup';
import { NoCheck, NoOut, NoCheckPrimitives } from '../src';

describe('FastTransformInterceptor - Decorators', () => {
    beforeEach(() => {
        FastTransformInterceptor.clearCache();
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

    it('should handle multiple @NoCheck decorators', async () => {
        class MultiNoCheckDto {
            @NoCheck()
            field1: any;
            @NoCheck()
            field2: any;
        }

        mockDtoMetadata(MultiNoCheckDto, {
            field1: { type: () => Object },
            field2: { type: () => Object },
        });

        const [interceptor] = setupInterceptor(MultiNoCheckDto);
        const result = await runInterceptor(interceptor, {
            field1: { a: 1, b: 'two' },
            field2: [1, '2', true],
        });

        expect(result).toEqual({
            field1: { a: 1, b: 'two' },
            field2: [1, '2', true],
        });
    });
});